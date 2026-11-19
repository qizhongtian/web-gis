<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const distance = ref(10)
const threshold = ref(1)
const autoDolly = ref(false)
const stats = ref('')

let T: any = null
let stage: any = null
let lod: any = null
let levels: any[] = []
let autoClock = 0
let statTimer = 0

function triCount(geometry: any) {
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
}

function build() {
  if (!stage || !T) return
  const THREE = T

  if (lod) {
    stage.scene.remove(lod)
    lod.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
    lod = null
    levels = []
  }

  lod = new THREE.LOD()
  lod.position.set(0, 1.2, 0)

  const specs = [
    { detail: 4, color: 0x38bdf8, name: '高模' },
    { detail: 2, color: 0xfbbf24, name: '中模' },
    { detail: 0, color: 0xf97316, name: '低模' },
  ]

  specs.forEach((spec) => {
    const geometry = new THREE.IcosahedronGeometry(1.2, spec.detail)
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: spec.color,
        metalness: 0.35,
        roughness: 0.35,
        flatShading: spec.detail === 0,
      }),
    )
    levels.push({ name: spec.name, triangles: triCount(geometry) })
    lod.addLevel(mesh, 0)
  })

  // 距离阈值可调：distance 是「从这一级开始切换到下一级」的相机距离
  lod.levels[0].distance = 0
  lod.levels[1].distance = 14 * threshold.value
  lod.levels[2].distance = 26 * threshold.value

  stage.scene.add(lod)
  applyDistance()
}

function applyDistance() {
  if (!stage) return
  const camera = stage.camera
  camera.position.set(0, 2.6, distance.value)
  camera.lookAt(0, 1.2, 0)
  updateStats()
}

function updateStats() {
  if (!lod) return
  const index = lod.getCurrentLevel()
  const level = levels[index]
  const info = stage.renderer.info.render
  const text = `${level?.name ?? '-'} · ${level ? level.triangles.toLocaleString() : 0} 三角 · 场景共 ${info.triangles.toLocaleString()}`
  if (text !== stats.value) stats.value = text
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.6, 10], background: '#080d14' })
  const { scene, camera } = stage
  camera.lookAt(0, 1.2, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(6, 10, 6)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(24, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.9 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // 地面距离刻度，方便对照切换距离
  for (let d = 10; d <= 40; d += 10) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x1e4d6b }),
    )
    bar.position.set(0, 0.01, -d)
    scene.add(bar)
  }

  build()

  stage.onFrame((dt: number) => {
    if (lod) lod.rotation.y += dt * 0.4
    if (autoDolly.value) {
      autoClock += dt * 0.35
      // 4 ~ 44 之间来回推拉
      distance.value = Math.round(24 + Math.sin(autoClock) * 20)
      applyDistance()
    }
    statTimer += dt
    if (statTimer > 0.3) {
      statTimer = 0
      updateStats()
    }
  })

  return () => {
    stage.dispose()
    stage = null
    lod = null
    levels = []
    T = null
  }
}

const intro: string[] = [
  'LOD（Level of Detail）的思路是「离得远就画得糙」。`THREE.LOD` 里挂多个层级的 Mesh，每级配一个「切换距离」；渲染时 three 会根据相机到物体的距离自动选层，只有当前层被绘制。示例里高模 5120 个三角形，低模只有 20 个，远处看起来几乎一样，但顶点开销差了两个数量级。',
  '`lod.addLevel(mesh, distance)` 的 distance 是「到这一级为止的距离」，数组必须按距离递增。`lod.autoUpdate` 默认 true，由 `WebGLRenderer` 在遍历场景时调用 `update(camera)`；如果场景里有成千上万个 LOD，每帧都算距离也会累积开销，可以按需关闭并手动调用。',
  'LOD 的难点不是 API，而是「怎么生成低模」。真实项目里高模来自美术，中低模靠减面工具（如 Blender 的 Decimate、Simplygon）离线生成，并要保证轮廓、UV、法线大体一致，否则切换时会「跳」。另一个常配合的手段是 Impostor（把远处物体烘成一张贴图），比低模还便宜。',
]

const blocks: CodeBlock[] = [
  {
    title: '构建 LOD',
    desc: '距离必须递增，切换由 renderer 自动完成',
    code: `const lod = new THREE.LOD()

lod.addLevel(new THREE.Mesh(highGeo, mat), 0)    // 近处
lod.addLevel(new THREE.Mesh(midGeo, mat), 14)    // 14 米外
lod.addLevel(new THREE.Mesh(lowGeo, mat), 26)    // 26 米外

scene.add(lod)

// 运行中查看当前层级
const index = lod.getCurrentLevel()

// 手动控制（会自动关闭 autoUpdate）
lod.autoUpdate = false
lod.update(camera)`,
  },
  {
    title: '统计三角形',
    desc: '对比「切了 LOD」到底省了多少',
    code: `function triCount(geometry) {
  return geometry.index
    ? geometry.index.count / 3
    : geometry.attributes.position.count / 3
}

// 渲染后读全局统计
renderer.render(scene, camera)
console.log(renderer.info.render.triangles)

// 球体细分与面数的量级关系：
// SphereGeometry(r, 64, 32) ≈ 4k 三角
// SphereGeometry(r, 16, 12) ≈ 350 三角
// SphereGeometry(r, 6, 4)   ≈ 30 三角`,
  },
  {
    title: '常与 LOD 搭配的手段',
    desc: '不止是换模型',
    code: `// 1. 远距离关阴影
lod.levels.forEach((level) => {
  level.object.castShadow = false
})

// 2. 远景批量化为 Impostor（贴图替身）
// 3. 配合视锥/遮挡剔除，LOD 只解决「画多细」
// 4. 用 LOD 切换做「渐进加载」：低模先上，高模到位后替换
if (highModelReady) {
  lod.levels[0].object = highMesh
  lod.levels[0].object.updateMatrix()
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '切换距离要按屏幕占比定',
    body: '固定 14 米、26 米只适合固定 FOV 与固定尺寸的物体。真实项目应按「物体包围球直径 / 相机距离」估算屏幕像素占比（约 100px、40px）再设阈值，否则有的物体一辈子不降级。',
  },
  {
    title: '切换会「跳」',
    body: '不同层级如果轮廓、光照差异大，切换瞬间非常明显。缓解方式：切点放在物体被遮挡/远景处，或做交叉淡入（同时渲染两层并调 opacity），后者会多一次绘制，注意权衡。',
  },
  {
    title: 'LOD 不能代替剔除',
    body: 'LOD 只降低单个物体的开销，物体数量本身没变。上万个物体照样要逐个做视锥判断与 DrawCall，仍需实例化 / 合批 / 空间划分来兜底。',
  },
  {
    title: '每个层级都是独立资源',
    body: '三级 LOD 意味着三份几何体都在显存里（虽然低模很小）。如果模型总量很大，要用「按需加载高模、离开后释放」的策略，而不是一次性把全部层级都加载进来。',
  },
]
</script>

<template>
  <DemoPage
    hint="LOD：同一物体三档精度，按相机距离自动切换。拖动距离滑块看三角形数量如何跳变。"
    :init="init"
  >
    <template #panel>
      <span class="label">相机距离 {{ distance }}</span>
      <el-slider v-model="distance" :min="4" :max="44" :step="1" class="!w-40" @change="applyDistance" />
      <span class="label">阈值 ×{{ threshold.toFixed(1) }}</span>
      <el-slider v-model="threshold" :min="0.4" :max="2" :step="0.1" class="!w-24" @change="build" />
      <el-checkbox v-model="autoDolly" size="small">自动推拉</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="LOD 分级"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="LOD 的关键是「切点定在哪」和「低模怎么来」，不是 API 本身。"
      />
    </template>
  </DemoPage>
</template>
