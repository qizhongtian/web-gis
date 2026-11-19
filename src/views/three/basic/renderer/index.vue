<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const pixelRatio = ref(2)
const exposure = ref(1)
const toneMapping = ref<'aces' | 'reinhard' | 'none'>('aces')
const stats = ref('等待首帧…')

let stage: any = null
let knot: any = null

const TONE: Record<string, string> = {
  aces: 'ACESFilmicToneMapping',
  reinhard: 'ReinhardToneMapping',
  none: 'NoToneMapping',
}

function applyPixelRatio(value: any) {
  if (!stage) return
  stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, value))
  stage.renderer.setSize(stage.el.clientWidth, stage.el.clientHeight)
}

function applyTone() {
  if (!stage) return
  const T = stage.THREE
  stage.renderer.toneMapping = T[TONE[toneMapping.value] as keyof typeof T]
  stage.renderer.toneMappingExposure = exposure.value
}

function applyExposure(value: any) {
  if (stage) stage.renderer.toneMappingExposure = value
}

function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { position: [0, 0.6, 7], background: '#0a1a28' })
  const renderer = stage.renderer

  // 关键渲染参数：像素比封顶、色彩空间、色调映射
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio.value))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE[TONE[toneMapping.value] as keyof typeof THREE]
  renderer.toneMappingExposure = exposure.value
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const { scene } = stage
  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 0.8))
  const key = new THREE.DirectionalLight(0xffffff, 3)
  key.position.set(4, 7, 5)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  scene.add(key)
  const rim = new THREE.PointLight(0x22d3ee, 40, 30)
  rim.position.set(-4, 2, -3)
  scene.add(rim)

  knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.5, 0.5, 220, 32),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.75, roughness: 0.22 }),
  )
  knot.castShadow = true
  scene.add(knot)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f2b40, roughness: 0.9, metalness: 0.1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.1
  floor.receiveShadow = true
  scene.add(floor)

  let acc = 0
  let frames = 0
  let maxCalls = 0
  stage.onFrame((dt: number) => {
    knot.rotation.y += dt * 0.5
    knot.rotation.x += dt * 0.2

    acc += dt
    frames++
    maxCalls = Math.max(maxCalls, renderer.info.render.calls)
    if (acc >= 0.5) {
      const fps = Math.round(frames / acc)
      stats.value = `${fps} FPS · calls ${renderer.info.render.calls}（峰值 ${maxCalls}）· 三角形 ${renderer.info.render.triangles.toLocaleString()} · 几何体 ${renderer.info.memory.geometries} · 纹理 ${renderer.info.memory.textures}`
      acc = 0
      frames = 0
    }
  })

  return () => {
    stage.dispose()
    stage = null
    knot = null
  }
}

const intro: string[] = [
  '`WebGLRenderer` 把场景 + 相机画成像素。它内部持有一个 WebGL 上下文，构造时可选的 `antialias`（MSAA）、`alpha`（透明画布）、`powerPreference`（`high-performance` 优先独显）都只能在创建时确定，运行时改不了；要换只能销毁重建。',
  '画质相关的三件套是：像素比 `setPixelRatio`、色彩空间 `outputColorSpace = SRGBColorSpace`、色调映射 `toneMapping` + `toneMappingExposure`。three r152 之后颜色管理默认开启，纹理要用 `SRGBColorSpace`（颜色贴图）或 `NoColorSpace`（法线/粗糙度等数据贴图），否则整体会发灰或过曝。',
  '性能诊断的入口是 `renderer.info`：`render.calls`（DrawCall 数）、`render.triangles`、`memory.geometries/textures`（GPU 上还活着的资源数）。`memory` 只增不减通常说明你 `dispose()` 漏了；`calls` 忽高忽低说明材质 / 几何体没有共享，几乎每个物体都在独立提交。',
]

const blocks: CodeBlock[] = [
  {
    title: '创建渲染器与尺寸',
    desc: 'antialias 只能在构造时决定；像素比按屏幕封顶 2 倍',
    code: `const renderer = new THREE.WebGLRenderer({
  antialias: true,          // MSAA，构造后不可改
  alpha: true,              // 透明画布，配合 CSS 背景
  powerPreference: 'high-performance',
})

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(el.clientWidth, el.clientHeight)
el.appendChild(renderer.domElement)

// 容器变化时（ResizeObserver 里）
renderer.setSize(w, h)`,
  },
  {
    title: '色彩空间与色调映射',
    desc: 'PBR 管线必须显式设置，否则颜色偏灰 / 过曝',
    code: `renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1

// 颜色贴图（albedo、UI 图）标记为 sRGB
colorTexture.colorSpace = THREE.SRGBColorSpace
// 数据贴图（normal / roughness / metalness / ao）保持线性
dataTexture.colorSpace = THREE.NoColorSpace`,
  },
  {
    title: '读取运行时指标',
    desc: 'info 每帧结束刷新；memory 是当前存活资源数',
    code: `renderer.render(scene, camera)

console.log({
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  points: renderer.info.render.points,
  geometries: renderer.info.memory.geometries,
  textures: renderer.info.memory.textures,
  programs: renderer.info.programs?.length,
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'pixelRatio 必须封顶',
    body: '手机 DPR 常见 3 ~ 4，`setPixelRatio(devicePixelRatio)` 会让像素量变成 9 ~ 16 倍，帧率直接腰斩。常规上限 2，超大屏或低端机可以降到 1.5。',
  },
  {
    title: 'antialias 与后处理冲突',
    body: '开启 `EffectComposer` 后，最终输出走的是 renderTarget，构造时的 MSAA 不再生效。要么让 composer 用带 `samples` 的 RenderTarget，要么最后加 `SMAAPass` / `FXAAPass`。',
  },
  {
    title: '透明画布与背景色',
    body: '`alpha: true` 时清屏 alpha 为 0，页面背景会透出来；`setClearColor(0x000000, 0)` 与 `scene.background = null` 等价。若要做「背景透明 + 只显示物体」的截图，还要注意 `preserveDrawingBuffer`（会掉性能，只在截图时开）。',
  },
  {
    title: '上下文丢失要兜底',
    body: '移动端后台切回、驱动重置会触发 `webglcontextlost`。监听 `renderer.domElement` 上的该事件，阻止默认行为并在 `webglcontextrestored` 时重建资源，否则画面会永久黑屏。',
  },
]
</script>

<template>
  <DemoPage hint="渲染器 Renderer：像素比、色调映射、阴影类型与 renderer.info 运行时指标。" :init="init">
    <template #panel>
      <span class="label">像素比上限</span>
      <el-slider v-model="pixelRatio" :min="0.5" :max="2" :step="0.5" class="!w-24" @input="applyPixelRatio" />

      <span class="label">色调映射</span>
      <el-select v-model="toneMapping" size="small" class="!w-28" @change="applyTone">
        <el-option label="ACES" value="aces" />
        <el-option label="Reinhard" value="reinhard" />
        <el-option label="None" value="none" />
      </el-select>

      <span class="label">曝光 {{ exposure.toFixed(1) }}</span>
      <el-slider v-model="exposure" :min="0.2" :max="2.5" :step="0.1" class="!w-24" @input="applyExposure" />

      <el-tag size="small" type="success" effect="plain" class="!ml-auto">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="渲染器 Renderer"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="renderer.info 是排查性能与泄漏的第一手数据，建议开发期常驻显示。"
      />
    </template>
  </DemoPage>
</template>
