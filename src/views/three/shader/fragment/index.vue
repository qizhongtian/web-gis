<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const mode = ref<'checker' | 'stripe' | 'polar' | 'noise'>('polar')
const scale = ref(8)
const speed = ref(1)
const palette = ref<'cool' | 'warm' | 'neon'>('neon')

const MODE: Record<string, number> = { checker: 0, stripe: 1, polar: 2, noise: 3 }

const PALETTES: Record<string, [string, string, string]> = {
  cool: ['#0f172a', '#0ea5e9', '#e0f2fe'],
  warm: ['#1c1017', '#f97316', '#fde68a'],
  neon: ['#0a0118', '#d946ef', '#22d3ee'],
}

let T: any = null
let stage: any = null
let material: any = null

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uMode;
  uniform float uScale;
  uniform vec3 uBg;
  uniform vec3 uMain;
  uniform vec3 uAccent;

  varying vec2 vUv;

  // 经典一维哈希：同一输入永远同一输出，适合做噪点
  float hash(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 color = uBg;

    if (uMode < 0.5) {
      // 棋盘：floor 分格 → 奇偶判断
      vec2 cell = floor(vUv * uScale);
      float checker = mod(cell.x + cell.y, 2.0);
      color = mix(uBg, uMain, checker);
      // 格子边框
      vec2 g = abs(fract(vUv * uScale) - 0.5);
      color = mix(color, uAccent, (1.0 - smoothstep(0.0, 0.04, min(g.x, g.y))) * 0.5);

    } else if (uMode < 1.5) {
      // 斜条纹：正弦 + smoothstep 得到软边
      float s = sin((vUv.x + vUv.y) * uScale * 3.1416 + uTime * 2.0);
      float band = smoothstep(-0.2, 0.8, s);
      color = mix(uBg, uMain, band);
      color += uAccent * pow(band, 4.0) * 0.5;

    } else if (uMode < 2.5) {
      // 极坐标：半径做同心圆，角度做扇形分割
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      float a = atan(p.y, p.x);

      float rings = sin(r * uScale * 3.1416 - uTime * 3.0);
      color = mix(uBg, uMain, smoothstep(-0.3, 0.6, rings) * (1.0 - r * 0.5));

      float spokes = smoothstep(0.85, 1.0, cos(a * 12.0));
      color = mix(color, uAccent, spokes * (1.0 - r) * 0.35);

      // 中心点亮
      color += uAccent * smoothstep(0.35, 0.0, r) * 0.8;

    } else {
      // 噪点：分格随机 + 按时间刷新
      vec2 cell = floor(vUv * uScale);
      float n = hash(cell + floor(uTime * 8.0));
      color = mix(uBg, uMain, step(0.72, n));
      color = mix(color, uAccent, step(0.95, n));
    }

    // 统一暗角，让图案不贴边
    vec2 d = vUv - 0.5;
    color *= 1.0 - dot(d, d) * 1.1;

    gl_FragColor = vec4(color, 1.0);
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T
  const [bg, main, accent] = PALETTES[palette.value]

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: material?.uniforms.uTime.value ?? 0 },
      uMode: { value: MODE[mode.value] },
      uScale: { value: scale.value },
      uBg: { value: new THREE.Color(bg) },
      uMain: { value: new THREE.Color(main) },
      uAccent: { value: new THREE.Color(accent) },
    },
    vertexShader,
    fragmentShader,
  })

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), material)
  stage.scene.add(plane)
}

function apply() {
  if (!material) return
  const [bg, main, accent] = PALETTES[palette.value]
  material.uniforms.uMode.value = MODE[mode.value]
  material.uniforms.uScale.value = scale.value
  material.uniforms.uBg.value.set(bg)
  material.uniforms.uMain.value.set(main)
  material.uniforms.uAccent.value.set(accent)
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 0, 5.6], background: '#05070d' })
  stage.camera.lookAt(0, 0, 0)

  build()

  stage.onFrame((dt: number) => {
    if (!material) return
    material.uniforms.uTime.value += dt * speed.value
  })

  return () => {
    stage.dispose()
    stage = null
    material = null
    T = null
  }
}

const intro: string[] = [
  '片元着色器决定每个像素的最终颜色。它拿到的输入是顶点阶段插值下来的 `varying`（本页就是 `vUv`），以及各种 uniform。GPU 会把一个绘制调用拆成成千上万个片元并行执行，所以这里写分支要谨慎：本页用 `uMode` 做 4 选 1，同一帧内所有像素走同一分支，还能接受；如果分支由像素坐标决定，就会造成 warp 内发散。',
  '几个最高频的工具函数：`fract()` 取小数部分，天然产生周期图案；`floor()` 分格；`mod(x, 2.0)` 判奇偶；`smoothstep(a, b, x)` 把区间映射成 0~1 且带软边（比 `step` 更适合做抗锯齿）；`atan(y, x)` 得到极角，是做雷达、圆环、涟漪的关键。本页四种图案全部由它们组合出来。',
  '片元着色器的性能取决于「屏幕覆盖面积 × 每像素指令数」。一个全屏的复杂噪声（如 8 层 fbm）在 4K 屏上就是 800 万像素 × 几十次采样，移动端会直接卡死。优化方向是降分辨率渲染再放大、预计算成纹理，或者用 `discard` 提前退出（但 `discard` 会禁用 early-z，反而可能更慢）。',
]

const blocks: CodeBlock[] = [
  {
    title: '极坐标图案',
    desc: 'atan 出角度，length 出半径，组成雷达感',
    code: `vec2 p = vUv - 0.5;          // 以中心为原点
float r = length(p) * 2.0;    // 半径，0 在中心
float a = atan(p.y, p.x);     // 极角，-π ~ π

float rings = sin(r * uScale * 3.1416 - uTime * 3.0);
vec3 color = mix(uBg, uMain, smoothstep(-0.3, 0.6, rings));

float spokes = smoothstep(0.85, 1.0, cos(a * 12.0));
color = mix(color, uAccent, spokes * (1.0 - r) * 0.35);`,
  },
  {
    title: '哈希噪点',
    desc: '无贴图的随机数：sin 哈希 + fract',
    code: `float hash(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 cell = floor(vUv * uScale);
float n = hash(cell + floor(uTime * 8.0));  // 每 1/8 秒刷新
vec3 color = mix(uBg, uMain, step(0.72, n));

// 想要平滑噪声 → 对 4 个格点插值；想要 fbm → 叠加多层`,
  },
  {
    title: 'smoothstep 做软边',
    desc: '比 step 多两条指令，换来抗锯齿',
    code: `// 硬边：像素级突变，远处闪烁
float hard = step(0.5, fract(vUv.x * 10.0));

// 软边：过渡区宽度与屏幕像素大致相关
float aa = fwidth(vUv.x * 10.0) * 1.5;
float soft = smoothstep(0.5 - aa, 0.5 + aa, fract(vUv.x * 10.0));

// fwidth 需要 GLSL3 / WebGL2，WebGL1 需 extension；
// three r152+ 默认 WebGL2，可直接用`,
  },
]

const notes: NoteItem[] = [
  {
    title: '分支尽量按 uniform 分',
    body: 'GPU 以 warp/wave 为单位执行，同一组线程走不同分支会两边都跑。按 uniform 分支（整屏一致）还好，按像素坐标分支才是真正的性能杀手。',
  },
  {
    title: 'discard 不一定是优化',
    body: '`discard` 会阻止 early-z 深度测试，且让 GPU 无法做某些合并。做圆形粒子（本页的极坐标圆）时，宁可用 `alpha` 混合也比大面积 discard 更稳。',
  },
  {
    title: 'uv 与像素不是一回事',
    body: '`vUv` 是 0~1 的插值参数，图案密度靠 `uScale` 乘出来。想在屏幕上做固定像素尺寸的图案（如扫描线），要传 `uResolution` 并用 `gl_FragCoord`。',
  },
  {
    title: '精度修饰符有用',
    body: '移动端片元默认 `mediump`，做 `sin(dot(...) * 43758.0)` 这类大数运算会失真出条纹。需要时在片元开头显式写 `precision highp float;`，代价是部分老设备变慢。',
  },
]
</script>

<template>
  <DemoPage
    hint="片元着色器：同一套 uv，用 fract / floor / smoothstep / atan 组合出棋盘、条纹、极坐标与噪点。"
    :init="init"
  >
    <template #panel>
      <el-radio-group v-model="mode" size="small" @change="apply">
        <el-radio-button value="checker">棋盘</el-radio-button>
        <el-radio-button value="stripe">条纹</el-radio-button>
        <el-radio-button value="polar">极坐标</el-radio-button>
        <el-radio-button value="noise">噪点</el-radio-button>
      </el-radio-group>
      <span class="label">密度 {{ scale }}</span>
      <el-slider v-model="scale" :min="2" :max="32" :step="1" class="!w-24" @change="apply" />
      <span class="label">速度 {{ speed.toFixed(1) }}</span>
      <el-slider v-model="speed" :min="0" :max="3" :step="0.1" class="!w-24" />
      <el-select v-model="palette" size="small" class="!w-24" @change="apply">
        <el-option label="霓虹" value="neon" />
        <el-option label="冷色" value="cool" />
        <el-option label="暖色" value="warm" />
      </el-select>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="片元着色器"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="片元着色器的成本 = 像素数 × 每像素指令数，全屏图案要克制。"
      />
    </template>
  </DemoPage>
</template>
