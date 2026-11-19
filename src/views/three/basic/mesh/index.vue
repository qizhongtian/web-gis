<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const showBox = ref(false)
const materialMode = ref<'standard' | 'normal'>('standard')
const stats = ref('')

let T: any = null
let stage: any = null
let tower: any = null
let radar: any = null
let helper: any = null
let normalMaterial: any = null
let originalMaterials: any[] = []

function applyBox(value: any) {
  if (helper) helper.visible = value
}

function applyMaterial() {
  if (!tower) return
  tower.traverse((obj: any) => {
    if (!obj.isMesh) return
    if (materialMode.value === 'normal') {
      obj.material = normalMaterial
    } else {
      const index = obj.userData.matIndex ?? 0
      obj.material = originalMaterials[index] ?? originalMaterials[0]
    }
  })
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [5, 4.2, 7], background: '#0a1a28' })
  const { scene } = stage

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 8, 6)
  scene.add(key)
  const rim = new THREE.PointLight(0x22d3ee, 30, 20)
  rim.position.set(-4, 3, -4)
  scene.add(rim)

  const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.32 })
  const body = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.4, roughness: 0.35 })
  const glow = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.3 })
  originalMaterials = [steel, body, glow]
  normalMaterial = new THREE.MeshNormalMaterial()

  // 一栋「信号塔」由多个 Mesh 组成，全部挂在一个 Group 下
  tower = new THREE.Group()
  tower.name = 'tower'

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.25, 48), steel)
  base.position.y = 0.12
  base.userData.matIndex = 0
  tower.add(base)

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.5, 4.6, 24, 1, true),
    steel,
  )
  trunk.position.y = 2.5
  trunk.userData.matIndex = 0
  tower.add(trunk)

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.12, 0.045, 8, 32), glow)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 1.4 + i * 1.15
    ring.userData.matIndex = 2
    tower.add(ring)
  }

  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 32), body)
  cabin.position.y = 4.2
  cabin.userData.matIndex = 1
  tower.add(cabin)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), glow)
  head.position.y = 4.85
  head.userData.matIndex = 2
  tower.add(head)

  // 雷达：单独一个 Group，方便每帧只旋转它
  radar = new THREE.Group()
  radar.position.y = 4.2
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.6), body)
  dish.rotation.x = Math.PI / 2
  dish.position.z = 0.5
  dish.material = body.clone()
  dish.material.side = THREE.DoubleSide
  dish.userData.matIndex = 1
  radar.add(dish)
  tower.add(radar)

  scene.add(tower)

  helper = new THREE.BoxHelper(tower, 0xf97316)
  helper.visible = showBox.value
  scene.add(helper)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f2b40, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  let meshes = 0
  tower.traverse((obj: any) => {
    if (obj.isMesh) meshes++
  })
  stats.value = `Group 内 ${meshes} 个 Mesh · 共享 3 个材质`

  stage.onFrame((dt: number) => {
    radar.rotation.y += dt * 1.2
  })

  return () => {
    stage.dispose()
    stage = null
    tower = null
    radar = null
    helper = null
    normalMaterial = null
    originalMaterials = []
    T = null
  }
}

const intro: string[] = [
  '`Mesh` = 几何体（形状数据）+ 材质（怎么着色）+ 变换（在哪）。它本身没有「子物体」的概念，但继承自 `Object3D`，所以任何 Mesh 都可以当父节点挂别的 Mesh——把塔身、雷达、灯环分层挂载，就能独立旋转雷达而不影响塔身。',
  '一条模型常见的组织方式是：`Group`（整栋楼/整台设备）→ `Mesh`（各部件）→ 子 `Mesh`（装饰件）。层级带来两个好处：一是变换可以批量处理，二是删除 / 显隐 / 换材质可以按子树递归。代价是每多一个 Mesh 就多一次 DrawCall，所以「几百个小零件」的模型要合并或实例化。',
  '`Mesh` 上的常用开关：`visible`（跳过渲染但保留在场景图）、`frustumCulled`（视锥裁剪）、`renderOrder`（透明物体绘制顺序）、`castShadow / receiveShadow`（是否参与阴影）、`material.side`（单/双面）。调试时把材质临时换成 `MeshNormalMaterial` 或 `MeshBasicMaterial`，可以快速区分「几何体没生成」和「材质/灯光有问题」。',
]

const blocks: CodeBlock[] = [
  {
    title: 'Mesh + Group 搭建层级模型',
    desc: '每个部件一个 Mesh，共用材质；雷达单独成组方便旋转',
    code: `const tower = new THREE.Group()
tower.name = 'tower'

const steel = new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.32 })
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 4.6, 24), steel)
trunk.position.y = 2.5
tower.add(trunk)

const radar = new THREE.Group()
radar.position.y = 4.2
tower.add(radar)

scene.add(tower)

// 每帧只转雷达
function render(dt) {
  radar.rotation.y += dt * 1.2
}`,
  },
  {
    title: '遍历、换材质、加包围盒',
    desc: 'BoxHelper 跟着物体走，适合快速确认尺寸与位置',
    code: `// 递归统计 / 批量修改
tower.traverse((obj) => {
  if (!obj.isMesh) return
  obj.castShadow = true
  obj.material = debugMaterial      // 调试：统一换成 Normal 材质
})

// 包围盒辅助线（会自动跟随目标更新）
const helper = new THREE.BoxHelper(tower, 0xf97316)
scene.add(helper)

// 或者取精确包围盒
const box = new THREE.Box3().setFromObject(tower)
console.log(box.min, box.max)`,
  },
  {
    title: '释放整棵子树',
    desc: '从父节点移除后逐个 dispose，材质共享时注意不要重复释放',
    code: `function disposeSubtree(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    mats.forEach((m) => m.dispose())
  })
  root.removeFromParent()
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'visible = false 仍然占内存',
    body: '隐藏只是跳过渲染，几何体 / 材质 / 纹理依旧在显存里。要真正省资源必须 `dispose()` 并 `remove()`；需要反复显隐的物体才用 `visible` 控制。',
  },
  {
    title: '一个 Mesh 一次 DrawCall',
    body: '模型由 200 个零件拼成就是 200 次 DrawCall，桌面端可能还好，移动端会明显掉帧。静态零件用 `mergeGeometries` 合并，重复零件用 `InstancedMesh`，同材质的多段几何体还可以用 `geometry.groups` + 材质数组。',
  },
  {
    title: 'BoxHelper 不是包围盒计算',
    body: '`BoxHelper` 用包围盒画线框，模型变形（骨骼动画、修改顶点）后需要 `helper.update()`。要精确碰撞用 `Box3.setFromObject()`，注意它默认按世界矩阵计算，旋转后的盒子会偏大。',
  },
  {
    title: '共享材质不要重复 dispose',
    body: '多个 Mesh 共用同一个材质实例时，遍历释放会对同一材质多次 `dispose()`（通常无害但不严谨）。更稳的做法是维护 `Set` 去重，或把材质统一交给资源管理器释放。',
  },
]
</script>

<template>
  <DemoPage hint="网格模型 Mesh：Group 分层组织多部件模型，包围盒辅助线与材质调试替换。" :init="init">
    <template #panel>
      <el-checkbox v-model="showBox" size="small" @change="applyBox">包围盒</el-checkbox>

      <span class="label">材质</span>
      <el-radio-group v-model="materialMode" size="small" @change="applyMaterial">
        <el-radio-button value="standard">标准</el-radio-button>
        <el-radio-button value="normal">法线调试</el-radio-button>
      </el-radio-group>

      <el-tag size="small" type="info" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="网格模型 Mesh"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="Mesh 的性能账很简单：一个 Mesh 一次 DrawCall，层级只影响变换，不影响批次数。"
      />
    </template>
  </DemoPage>
</template>
