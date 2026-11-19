<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const count = ref(3000)
const mode = ref<'separate' | 'instanced' | 'merged'>('separate')
const stats = ref('')
const fpsText = ref('0')

let T: any = null
let stage: any = null
let group: any = null
let material: any = null
let frames = 0
let elapsed = 0
let buildToken = 0

function clearGroup() {
  if (!group) return
  stage.scene.remove(group)
  group.traverse((obj: any) => {
    // 共享的 geometry / material 只需释放一次，这里统一处理
    obj.geometry?.dispose?.()
    obj.material?.dispose?.()
  })
  group = null
}

async function build() {
  if (!stage || !T) return
  const THREE = T
  const token = ++buildToken
  clearGroup()

  const total = count.value
  const side = Math.ceil(Math.sqrt(total))
  const gap = 0.36
  const half = (side * gap) / 2

  material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.35, roughness: 0.4 })
  group = new THREE.Group()

  if (mode.value === 'separate') {
    const geometry = new THREE.BoxGeometry(0.22, 0.4, 0.22)
    for (let i = 0; i < total; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set((i % side) * gap - half, 0.2, Math.floor(i / side) * gap - half)
      group.add(mesh)
    }
  } else if (mode.value === 'instanced') {
    const geometry = new THREE.BoxGeometry(0.22, 0.4, 0.22)
    const instanced = new THREE.InstancedMesh(geometry, material, total)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < total; i++) {
      dummy.position.set((i % side) * gap - half, 0.2, Math.floor(i / side) * gap - half)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    }
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingSphere()
    group.add(instanced)
  } else {
    // 合并几何：顶点全部烘进一个大 BufferGeometry，只剩一次绘制
    const { mergeGeometries } = await loadThreeAddon('BufferGeometryUtils')
    if (token !== buildToken || !stage) return

    const source = new THREE.BoxGeometry(0.22, 0.4, 0.22)
    const list: any[] = []
    for (let i = 0; i < total; i++) {
      const geo = source.clone()
      geo.translate((i % side) * gap - half, 0.2, Math.floor(i / side) * gap - half)
      list.push(geo)
    }
    const merged = mergeGeometries(list, false)
    list.forEach((geo) => geo.dispose())
    source.dispose()
    if (!merged) return
    group.add(new THREE.Mesh(merged, material))
  }

  stage.scene.add(group)
  updateStats()
}

function updateStats() {
  if (!stage) return
  const info = stage.renderer.info.render
  const label = mode.value === 'separate' ? '独立 Mesh' : mode.value === 'instanced' ? 'InstancedMesh' : '合并几何'
  stats.value = `${label} · DrawCall ${info.calls} · 三角 ${info.triangles.toLocaleString()}`
}

function apply() {
  build()
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 12, 16], background: '#080d14' })
  const { scene, camera } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(8, 14, 8)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  build()

  stage.onFrame((dt: number) => {
    frames++
    elapsed += dt
    if (elapsed >= 0.5) {
      fpsText.value = (frames / elapsed).toFixed(0)
      frames = 0
      elapsed = 0
      updateStats()
    }
    if (group) group.rotation.y += dt * 0.12
  })

  return () => {
    buildToken++
    stage.dispose()
    stage = null
    group = null
    material = null
    T = null
  }
}

const intro: string[] = [
  'DrawCall 是一次「CPU 通知 GPU 画一批东西」的调用。每次调用都要做状态检查、uniform 上传、绑定缓冲，CPU 侧成本约几微秒；几千次就会吃掉整帧预算。WebGL 的瓶颈绝大多数时候在这里，而不是 GPU 算不动。示例里同样数量的方块，独立 Mesh 是 N 次绘制，实例化与合并几何都是 1 次——差距会直接体现在 FPS 上。',
  '两种「合批」的适用场景不同。`InstancedMesh` 要求几何体与材质完全相同，每个实例只有变换和颜色可以不同，适合树、路灯、车辆、粒子方块；`mergeGeometries` 把多个几何体烘成一个大的 `BufferGeometry`，适合静态且材质一致的建筑群、地形装饰，代价是失去单个物体的独立变换与剔除能力。',
  '合批不是万能的：材质不同（不同贴图、不同透明度）就无法共用一次绘制；合并后整块只有一个包围球，相机看到一角也会整块提交。另一个常被忽略的点是「材质切换」本身也打断合批——即使几何相同，不同材质实例也要分别绘制。',
]

const blocks: CodeBlock[] = [
  {
    title: '实例化：一份几何 + 一份材质',
    desc: '变换写进 instanceMatrix，一次绘制',
    code: `const geometry = new THREE.BoxGeometry(0.22, 0.4, 0.22)
const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })

const mesh = new THREE.InstancedMesh(geometry, material, count)
const dummy = new THREE.Object3D()

for (let i = 0; i < count; i++) {
  dummy.position.set(x, 0.2, z)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}

mesh.instanceMatrix.needsUpdate = true
scene.add(mesh)   // DrawCall = 1`,
  },
  {
    title: '合并几何：顶点烘成一份',
    desc: '适合静态、同材质的批量物体',
    code: `import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const source = new THREE.BoxGeometry(0.22, 0.4, 0.22)
const list = []

for (let i = 0; i < count; i++) {
  const geo = source.clone()
  geo.translate(x, 0.2, z)     // 位移烘进顶点
  list.push(geo)
}

const merged = mergeGeometries(list, false)   // false = 不分组
list.forEach((g) => g.dispose())
scene.add(new THREE.Mesh(merged, material))   // DrawCall = 1`,
  },
  {
    title: '检查真实开销',
    desc: 'renderer.info 是最直接的观测点',
    code: `renderer.info.autoReset = false   // 想自己控制统计周期时

function measure() {
  renderer.render(scene, camera)
  const { calls, triangles, points } = renderer.info.render
  const { geometries, textures } = renderer.info.memory
  console.log({ calls, triangles, points, geometries, textures })
  renderer.info.reset()
}

// 经验值：
// 桌面端 calls < 1000 比较安全
// 移动端 calls < 200 更稳妥`,
  },
]

const notes: NoteItem[] = [
  {
    title: '不同材质无法合批',
    body: '合批的前提是材质能被复用。每个物体都 `new MeshStandardMaterial()` 会让 DrawCall 等于物体数量，还额外增加着色器编译与显存占用。能共用就共用，需要差异用 `vertexColors` 或实例色表达。',
  },
  {
    title: '合并后失去独立剔除',
    body: '合并几何只有一个包围球，相机只看到一角，整个合并体也会被提交；远处的、被遮挡的物体都白画。大场景把合并按「区块」拆分（如按 200×200 米分块），兼顾合批与剔除。',
  },
  {
    title: '实例化不能单独换贴图',
    body: '所有实例共享一份材质，想给不同实例不同贴图只能上「纹理图集 + 实例属性索引 uv 偏移」，或者拆成多个 InstancedMesh。颜色可以用 `setColorAt` 单独控制。',
  },
  {
    title: '合并不是免费的',
    body: '合并是 CPU 上的一次性开销（示例合并 8000 个约百毫秒级），且合并后的几何体顶点数不变，显存占用反而更大（重复顶点无法共享）。动态场景不要反复合并。',
  },
]
</script>

<template>
  <DemoPage
    hint="DrawCall：同样数量的方块，独立 Mesh / InstancedMesh / 合并几何三条路线的提交次数与帧率差异。"
    :init="init"
  >
    <template #panel>
      <el-radio-group v-model="mode" size="small" @change="apply">
        <el-radio-button value="separate">独立 Mesh</el-radio-button>
        <el-radio-button value="instanced">实例化</el-radio-button>
        <el-radio-button value="merged">合并几何</el-radio-button>
      </el-radio-group>
      <span class="label">数量 {{ count }}</span>
      <el-slider v-model="count" :min="500" :max="8000" :step="500" class="!w-32" @change="apply" />
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
      <el-tag size="small" effect="plain">{{ fpsText }} FPS</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="DrawCall 优化"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="WebGL 的瓶颈常常在 CPU 提交，而不是 GPU 算力。"
      />
    </template>
  </DemoPage>
</template>
