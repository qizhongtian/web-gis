<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const total = ref(12000)
const size = ref(2.2)
const speed = ref(0.5)
const scheme = ref<'aurora' | 'ember' | 'ice'>('aurora')

const SCHEMES: Record<string, [string, string, string]> = {
  aurora: ['#22d3ee', '#a855f7', '#052e2b'],
  ember: ['#fb923c', '#f43f5e', '#2a0a06'],
  ice: ['#e0f2fe', '#38bdf8', '#04121f'],
}

let T: any = null
let stage: any = null
let controls: any = null
let points: any = null
let geometry: any = null

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uPixelRatio;

  varying float vSeed;

  void main() {
    vec3 p = position;

    // 1. 每个粒子按自己的种子速度向上漂，mod 使其循环
    float range = 9.0;
    p.y = mod(p.y + uTime * uSpeed * (0.4 + aSeed * 1.4), range);

    // 2. 横向扰动，避免走直线
    p.x += sin(uTime * 0.8 + aSeed * 6.2831) * 0.5;
    p.z += cos(uTime * 0.7 + aSeed * 6.2831) * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // 3. 点大小：随距离衰减，并乘设备像素比保证高清屏一致
    gl_PointSize = uSize * aSize * uPixelRatio * (14.0 / -mv.z);

    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying float vSeed;

  void main() {
    // gl_PointCoord：点内部的 0~1 坐标（只有 Points 有）
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // 软边 + 中心高亮，避免方块状的硬边
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.22, 0.0, d);

    vec3 color = mix(uColorA, uColorB, vSeed);
    color += vec3(0.35) * core;

    gl_FragColor = vec4(color, glow * (0.45 + 0.55 * vSeed));
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T

  if (points) {
    stage.scene.remove(points)
    points.geometry.dispose()
    points.material.dispose()
  }

  const count = total.value
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 13
    positions[i * 3 + 1] = Math.random() * 9
    positions[i * 3 + 2] = (Math.random() - 0.5) * 13
    seeds[i] = Math.random()
    sizes[i] = 0.4 + Math.random() * 1.2
  }

  geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.computeBoundingSphere()

  const [a, b] = SCHEMES[scheme.value]
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: points?.material.uniforms.uTime.value ?? 0 },
      uSpeed: { value: speed.value },
      uSize: { value: size.value },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uColorA: { value: new THREE.Color(a) },
      uColorB: { value: new THREE.Color(b) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  points = new THREE.Points(geometry, material)
  // 顶点在着色器里被大幅漂移，包围球不可靠，直接关掉视锥裁剪
  points.frustumCulled = false
  stage.scene.add(points)
}

function apply() {
  if (!points) return
  const [a, b] = SCHEMES[scheme.value]
  const u = points.material.uniforms
  u.uSize.value = size.value
  u.uSpeed.value = speed.value
  u.uColorA.value.set(a)
  u.uColorB.value.set(b)
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 5.5, 14], background: '#03060b' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 3.6, 0)

  const grid = new THREE.GridHelper(20, 20, 0x0e2c3d, 0x081a24)
  grid.position.y = -0.02
  scene.add(grid)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 3.6, 0)
  controls.update()

  build()

  stage.onFrame((dt: number) => {
    controls?.update()
    if (points) points.material.uniforms.uTime.value += dt
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    points = null
    geometry = null
    T = null
  }
}

const intro: string[] = [
  '粒子系统在 three 里就是 `Points` + `PointsMaterial`，但要用自定义着色器就必须换成 `ShaderMaterial`。顶点阶段能拿到每个粒子的 `position` 和自己加的 `attribute`（本页的 `aSeed`、`aSize`），在这里算位移、算大小；片元阶段用 `gl_PointCoord` 在「点内部」画圆。一个 Points 只占一次 DrawCall，几万个粒子可以轻松实时。',
  '`gl_PointSize` 是最容易踩坑的地方。它单位是像素，写常量就意味着「屏幕像素固定大小」，远近不变；想有透视要自己除以 `-mvPosition.z`，再乘 `devicePixelRatio`（否则在 Retina 屏上点会小一半）。另外各家 GPU 对 `gl_PointSize` 有上限（常见 64~256），超了会被截断。',
  '透明度是第二个坑：粒子开了 `transparent` 就必须处理排序，几万个点按深度排序在 CPU 上不现实，所以通常直接 `depthWrite: false` + 叠加混合，让 GPU 按提交顺序混合。这样带来的副作用是粒子之间没有正确的遮挡关系，密集处会「越叠越亮」——对发光烟雾是优点，对雨滴、树叶就是缺陷。',
]

const blocks: CodeBlock[] = [
  {
    title: '自定义 attribute',
    desc: '位置之外再塞种子与大小，全部上传一次',
    code: `const count = 12000
const positions = new Float32Array(count * 3)
const seeds = new Float32Array(count)
const sizes = new Float32Array(count)

for (let i = 0; i < count; i++) {
  positions[i * 3 + 0] = (Math.random() - 0.5) * 13
  positions[i * 3 + 1] = Math.random() * 9
  positions[i * 3 + 2] = (Math.random() - 0.5) * 13
  seeds[i] = Math.random()
  sizes[i] = 0.4 + Math.random() * 1.2
}

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))`,
  },
  {
    title: '顶点阶段漂移 + 点大小',
    desc: 'mod 循环、sin 扰动、透视衰减',
    code: `attribute float aSeed;
attribute float aSize;

uniform float uTime;
uniform float uSpeed;
uniform float uSize;
uniform float uPixelRatio;

void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * uSpeed * (0.4 + aSeed * 1.4), 9.0);
  p.x += sin(uTime * 0.8 + aSeed * 6.2831) * 0.5;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aSize * uPixelRatio * (14.0 / -mv.z);

  gl_Position = projectionMatrix * mv;
}`,
  },
  {
    title: '片元画圆',
    desc: 'gl_PointCoord 只有 Points 才有',
    code: `void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;              // 方形点裁成圆

  float glow = smoothstep(0.5, 0.0, d);   // 外圈柔和
  float core = smoothstep(0.22, 0.0, d);  // 中心更亮

  vec3 color = mix(uColorA, uColorB, vSeed) + vec3(0.35) * core;
  gl_FragColor = vec4(color, glow);
}

// 材质设置
new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,             // 避免粒子互相裁切
  blending: THREE.AdditiveBlending,
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: '点大小要乘像素比',
    body: '`gl_PointSize` 是物理像素。4K / Retina 屏上不乘 `devicePixelRatio`，粒子看起来会小一半；乘了又要记得上限（`renderer.setPixelRatio` 封顶 2）。',
  },
  {
    title: '透明排序无法靠 three 解决',
    body: '`Points` 只有一个渲染顺序，`renderOrder` 也只在对象之间生效。想让粒子有正确的前后遮挡，只能靠 `depthWrite: true` + 不透明，或者接受叠加发光的观感。',
  },
  {
    title: 'frustumCulled = false',
    body: '顶点在着色器里漂移后，CPU 端的 `boundingSphere` 已经不准，相机稍微移动就可能整片粒子消失。要么关掉视锥裁剪，要么手动把包围球放大到覆盖所有可能位置。',
  },
  {
    title: '点数不是越多越好',
    body: '每个粒子至少 1 个顶点 + 若干像素的片元开销。全屏铺满的大点（`gl_PointSize` 过百）会迅速吃满填充率，先在低端机上看 `renderer.info.render` 再决定数量。',
  },
]
</script>

<template>
  <DemoPage
    hint="粒子 Shader：一个 Points 一次 DrawCall，位移与大小全在顶点阶段算，片元用 gl_PointCoord 画柔光圆点。"
    :init="init"
  >
    <template #panel>
      <span class="label">粒子 {{ total.toLocaleString() }}</span>
      <el-slider v-model="total" :min="1000" :max="40000" :step="1000" class="!w-32" @change="build" />
      <span class="label">大小 {{ size.toFixed(1) }}</span>
      <el-slider v-model="size" :min="0.5" :max="5" :step="0.1" class="!w-24" @change="apply" />
      <span class="label">速度 {{ speed.toFixed(1) }}</span>
      <el-slider v-model="speed" :min="0" :max="2" :step="0.1" class="!w-24" @change="apply" />
      <el-select v-model="scheme" size="small" class="!w-28" @change="apply">
        <el-option label="极光" value="aurora" />
        <el-option label="余烬" value="ember" />
        <el-option label="冰霜" value="ice" />
      </el-select>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="粒子 Shader"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="粒子的三个关键：点大小衰减、像素比、透明与深度写入。"
      />
    </template>
  </DemoPage>
</template>
