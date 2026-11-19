<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const speed = ref(1.2)
const rings = ref(4)
const targetCount = ref(9)
const angleText = ref('0°')

let T: any = null
let stage: any = null
let controls: any = null
let radar: any = null
let blipGroup: any = null
let blips: any[] = []

const RADIUS = 4.2

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
  uniform float uSpeed;
  uniform float uRings;
  uniform vec3 uColor;

  varying vec2 vUv;

  const float TAU = 6.28318530718;

  void main() {
    // 圆面 uv 是 0~1，映射到 [-1, 1] 后用极坐标判断
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;                    // 裁掉方形的四角

    float a = atan(p.y, p.x);                // 极角
    float sweep = mod(uTime * uSpeed, TAU);

    // 归一化到「距扫描线刚过去多久」：0 = 正被扫到
    float lag = mod(sweep - a, TAU);

    // 余辉：随角度滞后指数衰减
    float trail = exp(-lag * 2.0) * 0.55;
    // 主扫描线：极窄的亮边
    float beam = smoothstep(0.10, 0.0, lag) * 0.9;

    // 同心圆
    float ring = smoothstep(0.05, 0.0, abs(fract(r * uRings) - 0.5)) * 0.18;

    // 十字准线
    float cross = (smoothstep(0.006, 0.0, abs(p.x)) + smoothstep(0.006, 0.0, abs(p.y))) * 0.18;

    float vignette = smoothstep(1.0, 0.75, r);

    vec3 color = uColor * (trail + beam + ring + cross);
    // 底色由中心向外变暗
    color += uColor * 0.05 * (1.0 - r);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`

function buildRadar() {
  if (!stage || !T) return
  const THREE = T

  if (radar) {
    stage.scene.remove(radar)
    radar.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: radar?.material.uniforms.uTime.value ?? 0 },
      uSpeed: { value: speed.value },
      uRings: { value: rings.value },
      uColor: { value: new THREE.Color('#22c55e') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  })

  radar = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 96), material)
  radar.rotation.x = -Math.PI / 2
  radar.position.y = 0.02
  stage.scene.add(radar)

  // 外圈
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(RADIUS - 0.03, RADIUS, 96),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  )
  outer.rotation.x = -Math.PI / 2
  radar.add(outer)
}

function buildBlips() {
  if (!stage || !T) return
  const THREE = T

  if (blipGroup) {
    stage.scene.remove(blipGroup)
    blipGroup.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
  }

  blipGroup = new THREE.Group()
  stage.scene.add(blipGroup)
  blips = []

  for (let i = 0; i < targetCount.value; i++) {
    const r = (0.25 + Math.random() * 0.68) * RADIUS
    const worldAngle = Math.random() * Math.PI * 2
    const x = Math.cos(worldAngle) * r
    const z = Math.sin(worldAngle) * r

    const material = new THREE.MeshBasicMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const blip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), material)
    blip.position.set(x, 0.12, z)
    // 记录着色器里的极角：平面局部 (x, -y) → 世界 (x, -z)
    blip.userData.angle = Math.atan2(-z, x)
    blipGroup.add(blip)
    blips.push(blip)
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 7.2, 7.4], background: '#03080a' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0x22c55e, 0x020604, 0.5))

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 0, 0)
  controls.update()

  buildRadar()
  buildBlips()

  stage.onFrame((dt: number) => {
    controls?.update()
    if (!radar) return

    const uniforms = radar.material.uniforms
    uniforms.uTime.value += dt
    uniforms.uSpeed.value = speed.value

    const sweep = (uniforms.uTime.value * speed.value) % (Math.PI * 2)
    const degree = `${Math.round((sweep * 180) / Math.PI)}°`
    if (degree !== angleText.value) angleText.value = degree

    // 目标点是否被扫到：CPU 只做「角度差」判断，重活全在片元里
    for (const blip of blips) {
      let lag = sweep - blip.userData.angle
      lag = ((lag % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const hit = Math.exp(-lag * 1.8)
      blip.material.opacity = 0.18 + hit * 0.82
      const s = 0.7 + hit * 0.9
      blip.scale.setScalar(s)
    }
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    radar = null
    blipGroup = null
    blips = []
    T = null
  }
}

function applyRadar() {
  if (!radar) return
  radar.material.uniforms.uRings.value = rings.value
}

function applyBlips() {
  buildBlips()
}

const intro: string[] = [
  '雷达扫描是极坐标着色器的典型应用：把平面 uv 映射到 [-1,1]，`length(p)` 得到半径、`atan(p.y, p.x)` 得到极角，一切「以中心旋转」的图案都变成「极角的一个函数」。扫描线就是当前相位 `mod(uTime * speed, 2π)`，余辉则是「当前相位减去像素极角」的差值再做指数衰减。',
  '`mod(sweep - angle, 2π)` 这一步负责把角度差归一到 [0, 2π)，保证扫描线转回起点时余辉不会从负值跳变。`exp(-lag * k)` 比 `1 - lag/π` 更接近真实余辉，因为亮度衰减是乘法式的；k 越大余辉越短。',
  '目标点的闪烁没有交给着色器，而是 CPU 每帧用同样的角度差算出 `exp(-lag)`，再改 `opacity` 与缩放。少量目标（十几个）这样做完全够用；如果要点亮上万个点，就该把目标角度写进 `attribute`，在顶点着色器里按 `uSweep` 算亮度。',
]

const blocks: CodeBlock[] = [
  {
    title: '极坐标 + 扫描余辉',
    desc: 'radial / angular 两个量就够画完整雷达',
    code: `vec2 p = vUv * 2.0 - 1.0;
float r = length(p);
if (r > 1.0) discard;

float a = atan(p.y, p.x);
float sweep = mod(uTime * uSpeed, 6.2831853);
float lag = mod(sweep - a, 6.2831853);   // 0 = 刚扫过

float trail = exp(-lag * 2.0) * 0.55;    // 余辉
float beam  = smoothstep(0.10, 0.0, lag) * 0.9;  // 扫描线

float ring = smoothstep(0.05, 0.0, abs(fract(r * uRings) - 0.5)) * 0.18;
gl_FragColor = vec4(uColor * (trail + beam + ring), 1.0);`,
  },
  {
    title: 'CPU 侧同步目标闪烁',
    desc: '不上万的点，CPU 直接算角度差最省事',
    code: `const sweep = (time * speed) % (Math.PI * 2)

for (const blip of blips) {
  let lag = sweep - blip.userData.angle
  lag = ((lag % TAU) + TAU) % TAU            // 归一到 0~2π
  const hit = Math.exp(-lag * 1.8)

  blip.material.opacity = 0.18 + hit * 0.82  // 每个点独立材质
  blip.scale.setScalar(0.7 + hit * 0.9)
}`,
  },
  {
    title: '上千个目标就交给 GPU',
    desc: '角度写进 attribute，顶点阶段算亮度',
    code: `// 每个点一个角度 attribute
geometry.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1))

// 顶点着色器
attribute float aAngle;
uniform float uSweep;
varying float vGlow;

void main() {
  float lag = mod(uSweep - aAngle, 6.2831853);
  vGlow = exp(-lag * 1.8);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (4.0 + vGlow * 10.0) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'discard 与透明的取舍',
    body: '这里用 `discard` 裁掉方形的四角，代价是失去 early-z；因为整块面不参与遮挡，影响不大。若雷达叠在地形上，改回圆形几何 + `transparent` 更稳。',
  },
  {
    title: '余辉要跟扫描方向一致',
    body: '`mod(sweep - a, 2π)` 是「顺时针扫描」的写法；反向旋转要改成 `mod(a - sweep, 2π)`。方向反了会表现为余辉跑到扫描线前面。',
  },
  {
    title: 'DoubleSide 与 y 轴位置',
    body: '平面绕 X 轴转 -90° 后法线朝上，相机从下方看会被背面剔除。给雷达加 `side: THREE.DoubleSide`，或把 `rotation.x` 反过来，同时记得抬高 `position.y` 防止与地面 z-fighting。',
  },
  {
    title: 'uTime 别用 Date.now()',
    body: '`Date.now() * 0.001` 在低帧率下会让扫描线跳格。用 `clock.getDelta()` 累加，或 `clock.getElapsedTime()`，才能与其它动画保持同一时间轴。',
  },
]
</script>

<template>
  <DemoPage
    hint="扫描特效：极坐标 + mod 相位 + 指数余辉，几十行片元着色器做出雷达扫掠与目标点亮。"
    :init="init"
  >
    <template #panel>
      <span class="label">速度 {{ speed.toFixed(1) }}</span>
      <el-slider v-model="speed" :min="0.2" :max="4" :step="0.1" class="!w-28" />
      <span class="label">同心圆 {{ rings }}</span>
      <el-slider v-model="rings" :min="1" :max="8" :step="1" class="!w-24" @change="applyRadar" />
      <span class="label">目标 {{ targetCount }}</span>
      <el-slider v-model="targetCount" :min="0" :max="24" :step="1" class="!w-24" @change="applyBlips" />
      <el-tag size="small" type="success" effect="plain">扫描角 {{ angleText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="扫描 Shader"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="极坐标是所有旋转类特效（雷达、涟漪、螺旋）的通用入口。"
      />
    </template>
  </DemoPage>
</template>
