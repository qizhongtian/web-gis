/**
 * 天气特效着色器库（GLSL ES 3.00 / Cesium 后处理阶段）
 *
 * 每个导出的都是完整片段着色器，约定：
 * - 输入：`colorTexture`（上一步合成的场景颜色）、`v_textureCoordinates`
 * - 输出：`out_FragColor`（必须不透明，alpha 会被后处理链忽略）
 * - 动态参数用 uniform 传入，由 hooks 侧以「函数」形式每帧求值
 *
 * 所有效果都是屏幕空间的，不依赖粒子几何体，因此不随相机缩放出现穿模 / 稀疏问题。
 */

/** 公共工具：哈希、值噪声、FBM、按宽高比校正的 uv */
const COMMON = /* glsl */ `
uniform sampler2D colorTexture;

in vec2 v_textureCoordinates;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

// 屏幕坐标按宽高比拉伸，避免雨丝 / 雪花被拉扁
vec2 aspectUV() {
  float aspect = czm_viewport.z / max(czm_viewport.w, 1.0);
  return vec2(v_textureCoordinates.x * aspect, v_textureCoordinates.y);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}
`

function build(body: string) {
  return `${COMMON}\n${body}`
}

/**
 * 雨：三层泪滴形雨滴，自上而下坠落并随风向漂移，
 * 强度只控制雨滴大小与疏密；画面整体叠加一层水汽蓝灰色。
 */
export const RAIN_SHADER = build(/* glsl */ `
uniform float u_time;
uniform float u_intensity;

/**
 * 雨滴：下圆上尖的竖向水滴轮廓（越往上越窄），返回近似带符号距离。
 * s 为归一化局部坐标（+y 向上），横半径 1.0，tall 为竖向拉长倍数。
 * 用光滑的宽度缩放代替「圆头 + 细尾」的拼接，轮廓没有接缝也没有毛细尾巴。
 */
float sdDrop(vec2 s, float tall) {
  float taper = 1.0 - 0.55 * clamp((s.y + 0.6) / 2.2, 0.0, 1.0);
  return length(vec2(s.x / max(taper, 0.08), s.y / tall)) - 1.0;
}

float rainLayer(vec2 p, float scale, float speed, float radius, float density, float wind) {
  p *= scale;
  p.y += u_time * speed;               // 屏幕 +y 向上，坐标上移即雨滴向下落
  p.x -= u_time * speed * wind;        // 随风横向漂移

  vec2 id = floor(p);
  vec2 f = fract(p);

  float rnd = hash12(id);
  // 抖动到格子中心之外，避免雨滴排成整齐的网格
  vec2 center = vec2(0.5) + (vec2(hash12(id + 3.71), hash12(id + 7.13)) - 0.5) * vec2(0.9, 0.55);

  // 顺着风向倾斜
  float ang = wind * 2.2;
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 q = f - center;
  q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);

  // 每滴大小、长细比都随机，避免复制粘贴感
  vec2 s = q / max(radius, 0.0001) / (0.85 + 0.35 * hash12(id + 9.13));
  float tall = mix(1.45, 1.95, hash12(id + 13.7));

  float d = sdDrop(s, tall);

  // 一个像素在归一化坐标里的长度，用于 1px 抗锯齿（边缘不会糊成一团）
  float px = max(fwidth(s.x), fwidth(s.y) / max(tall, 0.001));
  float aa = max(px * 0.9, 0.0006);
  float body = 1.0 - smoothstep(-aa, aa, d);

  // 上半部渐淡：水滴上方比下方通透
  float shade = mix(1.0, 0.55, smoothstep(-0.8, 1.4, s.y));

  // 边缘更亮、内部略透，模拟水珠的高光与折射
  float rim = smoothstep(-0.5, 0.0, d);

  return clamp(body * shade * mix(0.55, 1.0, rim), 0.0, 1.0) * step(rnd, density);
}

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec2 p = aspectUV();
  float k = clamp(u_intensity, 0.2, 2.0);

  // 强度 -> 雨滴大小 + 疏密（不参与透明度）
  float level = clamp((k - 0.2) / 1.8, 0.0, 1.0);
  float sizeMul = mix(0.85, 1.60, level);
  float density = mix(0.16, 0.55, level);

  float amount = 0.0;
  amount = max(amount, rainLayer(p, 16.0, 2.6, 0.070 * sizeMul, density * 0.90, 0.16));
  amount = max(amount, rainLayer(p + vec2(7.3, 11.7), 28.0, 3.4, 0.060 * sizeMul, density * 0.75, 0.16));
  amount = max(amount, rainLayer(p + vec2(23.1, 5.9), 46.0, 4.2, 0.052 * sizeMul, density * 0.60, 0.16));

  vec3 rainColor = vec3(0.86, 0.92, 1.0);
  vec3 color = mix(scene.rgb, scene.rgb * vec3(0.86, 0.90, 0.97), 0.45);
  color = mix(color, rainColor, clamp(amount, 0.0, 1.0) * 0.78);
  color += rainColor * 0.03 * smoothstep(0.2, 1.0, v_textureCoordinates.y);

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 雪：三层六角雪花（主臂 + 两对侧枝 + 中心核），纵向漂落 + 横向正弦摆动，
 * 每片雪花随机朝向，按距离远近区分大小与速度。
 */
export const SNOW_SHADER = build(/* glsl */ `
uniform float u_time;
uniform float u_intensity;

// 点到线段的距离，用于把雪花的臂 / 枝画成细线
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

// 六角雪花：把极角折叠到 1/6 扇区，得到一条臂 + 两对侧枝
// q：相对雪花中心的坐标，半径 1.0 为雪花外缘；thick：线条粗细
float snowflake(vec2 q, float thick) {
  float r = length(q);
  if (r > 1.25) return 0.0;

  float sector = 1.0471976;                              // PI / 3
  float a = abs(mod(atan(q.y, q.x) + sector * 0.5, sector) - sector * 0.5);
  vec2 s = vec2(cos(a), sin(a)) * r;                     // s.x 沿臂，s.y 为偏移

  float d = segDist(s, vec2(0.08, 0.0), vec2(1.0, 0.0));            // 主臂
  d = min(d, segDist(s, vec2(0.40, 0.0), vec2(0.60, 0.26)));         // 内侧侧枝
  d = min(d, segDist(s, vec2(0.66, 0.0), vec2(0.82, 0.20)));         // 外侧侧枝
  d = min(d, length(s) - 0.16);                                      // 中心核

  float line = 1.0 - smoothstep(thick * 0.45, thick, d);
  // 越靠近外缘越淡，臂端自然收细
  line *= 1.0 - 0.5 * smoothstep(0.6, 1.0, r);
  float halo = (1.0 - smoothstep(0.0, 1.0, r)) * 0.16;
  return clamp(line + halo, 0.0, 1.0);
}

float snowLayer(vec2 p, float scale, float speed, float size, float density, float thick) {
  p *= scale;
  p.y += u_time * speed;               // 屏幕 +y 向上，坐标上移即雪花向下落
  p.x += sin(p.y * 0.55 + u_time * 0.4) * 0.12;

  vec2 id = floor(p);
  vec2 f = fract(p);

  float rnd = hash12(id);
  vec2 center = vec2(0.5) + (vec2(hash12(id + 5.31), hash12(id + 8.73)) - 0.5) * 0.2;
  vec2 q = (f - center) / size;

  // 每片雪花随机旋转，避免所有花瓣排成同一角度
  float ang = rnd * 6.2831853;
  float cs = cos(ang);
  float sn = sin(ang);
  q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);

  // 大小随机浮动，避免所有雪花一样大
  q /= 0.85 + 0.3 * hash12(id + 1.73);

  float flake = snowflake(q, thick);
  return flake * step(rnd, density);
}

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec2 p = aspectUV();
  float k = clamp(u_intensity, 0.2, 2.0);

  // 强度 -> 雪花大小 + 疏密（不参与透明度）
  float level = clamp((k - 0.2) / 1.8, 0.0, 1.0);
  float sizeMul = mix(0.65, 1.50, level);
  float density = mix(0.08, 0.45, level);

  float amount = 0.0;
  amount = max(amount, snowLayer(p, 10.0, 0.22, 0.17 * sizeMul, density * 0.90, 0.110));
  amount = max(amount, snowLayer(p + vec2(3.7, 9.1), 19.0, 0.38, 0.17 * sizeMul, density * 0.75, 0.120));
  amount = max(amount, snowLayer(p + vec2(17.3, 2.9), 34.0, 0.55, 0.17 * sizeMul, density * 0.55, 0.130));

  vec3 color = mix(scene.rgb, vec3(1.0), clamp(amount, 0.0, 1.0));
  color = mix(color, color * vec3(0.94, 0.97, 1.0), 0.18);

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 沙尘：沿风向滚动的高频条纹 + 低频沙幕，整体偏暖黄色。
 */
export const SAND_SHADER = build(/* glsl */ `
uniform float u_time;
uniform float u_intensity;

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec2 p = aspectUV();
  float t = u_time;

  float band = fbm(vec2(p.x * 2.4 - t * 0.32, p.y * 5.2 + t * 0.06));
  float streak = fbm(vec2(p.x * 10.0 - t * 1.10, p.y * 1.6 + t * 0.10));
  float dust = smoothstep(0.42, 0.92, band * 0.60 + streak * 0.55);

  // 越靠近画面下方（近地面）沙尘越浓
  dust *= 0.45 + 0.55 * (1.0 - smoothstep(0.1, 1.0, v_textureCoordinates.y));

  float k = clamp(u_intensity, 0.2, 2.0);
  vec3 sand = vec3(0.84, 0.72, 0.50);
  vec3 graded = scene.rgb * vec3(1.04, 0.94, 0.80) + sand * 0.22;
  vec3 color = mix(scene.rgb, graded, clamp(dust * k, 0.0, 1.0) * 0.85);

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 雾霾：随密度增强的灰白雾幕 + 轻微去饱和，`u_density` 直接取 scene.fog.density。
 */
export const HAZE_SHADER = build(/* glsl */ `
uniform float u_time;
uniform float u_density;

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec2 p = aspectUV();

  float n = fbm(p * 1.6 + vec2(u_time * 0.015, u_time * 0.008));
  float k = clamp(u_density * 320.0, 0.0, 1.0);

  float veil = (0.28 + 0.62 * k) * (0.75 + 0.35 * n);
  float amount = clamp(veil * (0.35 + 0.65 * k), 0.0, 0.92);

  vec3 fogColor = vec3(0.76, 0.80, 0.85);
  vec3 color = mix(scene.rgb, fogColor, amount);
  color = mix(color, vec3(luma(color)), 0.25 * k);

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 云层：两层 FBM 噪声叠出团块感，随时间横向漂移，集中在画面上部。
 */
export const CLOUD_SHADER = build(/* glsl */ `
uniform float u_time;
uniform float u_cover;

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec2 p = aspectUV() * 1.15;
  float t = u_time * 0.010;

  // 两级噪声做域扭曲，得到成团的云块而不是细碎斑点
  float warp1 = fbm(p + vec2(t, t * 0.1));
  float warp2 = fbm(p * 1.8 - vec2(t * 1.4, 0.0) + warp1 * 1.2);
  float shape = fbm(p * 1.2 + vec2(warp1 * 1.5, warp2 * 1.2) + vec2(t * 0.8, 0.0));

  float cover = clamp(u_cover, 0.05, 1.0);
  float mask = smoothstep(0.50 - cover * 0.25, 0.85 - cover * 0.18, shape);

  // 大尺度空隙，避免整屏糊成一片雾
  float gap = fbm(p * 0.55 + vec2(-t * 0.5, t * 0.05));
  mask *= smoothstep(0.28, 0.72, gap * 0.9 + 0.15);

  // 云顶压在上半屏，向地平线方向变薄
  mask *= smoothstep(0.05, 0.55, v_textureCoordinates.y);

  // 云体：稀薄处偏灰蓝，浓密处接近纯白，浅色底图下也能看出层次
  float shade = smoothstep(0.30, 0.85, shape);
  vec3 cloudColor = mix(vec3(0.56, 0.61, 0.69), vec3(0.97, 0.98, 1.0), shade);
  vec3 color = mix(scene.rgb, cloudColor, clamp(mask * 0.95, 0.0, 0.95));
  color *= 1.0 - mask * 0.10;

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 闪电：由 hooks 侧按随机节奏推进 `u_flash`（0~1），着色器负责提亮 + 冷白偏色。
 */
export const LIGHTNING_SHADER = build(/* glsl */ `
uniform float u_flash;

void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  float f = clamp(u_flash, 0.0, 1.0);

  // 画面中心更亮，模拟云闪的散射
  float center = 1.0 - length(v_textureCoordinates - vec2(0.5)) * 0.8;
  vec3 bolt = vec3(0.82, 0.88, 1.0);

  vec3 color = scene.rgb * (1.0 + f * 2.2) + bolt * f * (0.35 + 0.4 * center);

  out_FragColor = vec4(color, 1.0);
}
`)

/**
 * 夜景：冷色调映射 + 压暗 + 暗部提蓝 + 暗角，替代早期「globelighting」的粗暴做法。
 */
export const NIGHT_SHADER = build(/* glsl */ `
void main() {
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  vec3 color = scene.rgb;
  float l = luma(color);

  vec3 cool = vec3(color.r * 0.68, color.g * 0.78, color.b * 0.98);
  cool = mix(vec3(l * 0.60, l * 0.72, l * 0.95), cool, 0.65);
  cool *= 0.78;
  cool += vec3(0.015, 0.025, 0.055) * (1.0 - l);

  // 暗角
  vec2 d = v_textureCoordinates - vec2(0.5);
  float vignette = 1.0 - 0.45 * dot(d, d) * 1.6;
  cool *= clamp(vignette, 0.55, 1.0);

  out_FragColor = vec4(cool, 1.0);
}
`)
