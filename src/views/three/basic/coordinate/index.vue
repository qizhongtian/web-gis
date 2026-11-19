<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const rx = ref(0)
const ry = ref(0)
const rz = ref(0)
const order = ref<'XYZ' | 'YXZ' | 'ZXY'>('XYZ')
const localText = ref('局部 (2.00, 0.00, 0.00)')
const worldText = ref('世界 (1.41, 0.00, 1.41)')

let T: any = null
let stage: any = null
let target: any = null
const tmp = { v: null as any }

function updateWorld() {
  if (!T || !target) return
  target.getWorldPosition(tmp.v)
  worldText.value = `世界 (${tmp.v.x.toFixed(2)}, ${tmp.v.y.toFixed(2)}, ${tmp.v.z.toFixed(2)})`
  const p = target.position
  localText.value = `局部 (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`
}

function applyRotation() {
  if (!target) return
  const d = Math.PI / 180
  target.rotation.set(rx.value * d, ry.value * d, rz.value * d, order.value)
  target.updateMatrixWorld(true)
  updateWorld()
}

function applyOrder(value: 'XYZ' | 'YXZ' | 'ZXY') {
  order.value = value
  applyRotation()
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  tmp.v = new THREE.Vector3()
  stage = createStage(THREE, el, { position: [7, 5.5, 8], background: '#0a1a28' })
  const { scene } = stage

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const dir = new THREE.DirectionalLight(0xffffff, 2)
  dir.position.set(6, 9, 4)
  scene.add(dir)

  scene.add(new THREE.AxesHelper(3)) // 红 X / 绿 Y / 蓝 Z
  const grid = new THREE.GridHelper(12, 12, 0x2b4a63, 0x1b3347)
  scene.add(grid)

  // 父节点：绕 Y 轴转 45°，代表「工地基准方向」或「模型自身坐标系」
  const pivot = new THREE.Group()
  pivot.rotation.y = Math.PI / 4
  scene.add(pivot)

  const pivotBox = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.06, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25 }),
  )
  pivot.add(pivotBox)
  pivot.add(new THREE.AxesHelper(2))

  // 子节点：局部坐标固定在 (2, 0, 0)，世界坐标随父节点旋转变化
  target = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.4, roughness: 0.35 }),
  )
  target.position.set(2, 0.45, 0)
  pivot.add(target)

  const localAxes = new THREE.AxesHelper(1.2)
  target.add(localAxes)

  target.updateMatrixWorld(true)
  updateWorld()

  return () => {
    stage.dispose()
    stage = null
    target = null
    T = null
    tmp.v = null
  }
}

const intro: string[] = [
  'three 默认是右手系 + Y 轴向上 + 单位米：+X 向右、+Y 向上、+Z 指向屏幕外（相机默认在 +Z 看向原点），`AxesHelper` 的三根轴就是 红 X / 绿 Y / 蓝 Z。GIS 数据普遍是 Z 轴向上（ENU / 工程坐标），把模型接进来时通常要绕 X 轴 `-90°` 转一次，否则「站着的楼」会躺在地上。',
  '每个 `Object3D` 有两套坐标：`position` / `rotation` / `scale` 是相对父节点的局部坐标，`matrixWorld` 才是世界坐标。父节点一变，子节点的世界矩阵要等 `updateMatrixWorld()`（渲染前会自动做）才更新，所以脚本里读 `getWorldPosition()` 前要确保矩阵已是最新。',
  '旋转有三种表达：`Euler`（三元角 + 旋转顺序，直观但有万向节死锁）、`Quaternion`（四元数，插值与组合更稳定，three 内部用它算矩阵）、`Matrix4`（最终形态）。`rotation` 与 `quaternion` 是双向同步的，给其中一个赋值另一个会自动更新；但 `rotation.order` 决定欧拉角的组合顺序，`XYZ` 与 `YXZ` 在同样角度下姿态完全不同。',
]

const blocks: CodeBlock[] = [
  {
    title: '局部坐标与世界坐标',
    desc: '父节点旋转后，子节点的世界位置随之改变，但 position 不变',
    code: `const pivot = new THREE.Group()
pivot.rotation.y = Math.PI / 4
scene.add(pivot)

const box = new THREE.Mesh(geometry, material)
box.position.set(2, 0.45, 0)   // 局部坐标
pivot.add(box)

box.updateMatrixWorld(true)
const world = new THREE.Vector3()
box.getWorldPosition(world)     // ≈ (1.41, 0.45, 1.41)

// 反向：世界坐标 → 本节点局部坐标
const local = box.worldToLocal(world.clone())`,
  },
  {
    title: '欧拉角顺序与四元数',
    desc: 'rotation.order 决定组合顺序；动画 / 插值优先用四元数',
    code: `// 欧拉角：直观，但顺序不同姿态不同，且存在万向节死锁
mesh.rotation.set(
  THREE.MathUtils.degToRad(30),
  THREE.MathUtils.degToRad(45),
  THREE.MathUtils.degToRad(60),
  'YXZ',                      // 顺序：先 Y 再 X 再 Z
)

// 四元数：无死锁，适合 slerp 插值
const q1 = new THREE.Quaternion().setFromEuler(mesh.rotation)
const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
q1.slerp(q2, 0.2)
mesh.quaternion.copy(q1)`,
  },
  {
    title: 'GIS 的 Z-up 转 three 的 Y-up',
    desc: '整包数据绕 X 轴转 -90°，或给根节点套一层 Group 统一处理',
    code: `const root = new THREE.Group()
root.rotation.x = -Math.PI / 2   // Z-up → Y-up
root.add(geoJsonModels)          // 内部仍按 Z-up 建模

// 反过来把 three 坐标送进 GIS（经纬度 → 世界坐标）时，
// 通常还需要平移原点和缩放：1 米 vs 1 个单位要一致`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'Y-up 与 Z-up 是最常见的「躺平」原因',
    body: 'three 约定 Y 轴向上；Cesium / 大部分 BIM、GIS 数据是 Z 轴向上。模型导入后如果「躺在地上」，先查是不是少了 `rotation.x = -Math.PI / 2`，而不是去怀疑材质或相机。',
  },
  {
    title: '读世界坐标前要先刷新矩阵',
    body: '刚改完 `position` 立刻 `getWorldPosition()` 可能拿到旧值。手动调用 `updateMatrixWorld(true)`，或把读取放到渲染之后；渲染器每帧渲染前会刷新整棵树的矩阵。',
  },
  {
    title: '欧拉角顺序会改变结果',
    body: '`rotation.set(x, y, z, order)` 的第四个参数是顺序。`XYZ` 与 `YXZ` 在三个角都非零时姿态不同；做旋转动画时角度跨过 ±180° 会出现跳变，改用四元数 `slerp`。',
  },
  {
    title: '负缩放会翻转法线',
    body: '用 `scale.set(-1, 1, 1)` 做镜像时，三角形绕序反转、光照变黑。要么改用 `material.side = DoubleSide`，要么在几何体层面镜像后 `computeVertexNormals()`。',
  },
]
</script>

<template>
  <DemoPage hint="坐标系：局部 / 世界坐标、欧拉角旋转顺序，父节点 45° 旋转下的坐标换算。" :init="init">
    <template #panel>
      <span class="label">旋转顺序</span>
      <el-select :model-value="order" size="small" class="!w-20" @change="applyOrder">
        <el-option label="XYZ" value="XYZ" />
        <el-option label="YXZ" value="YXZ" />
        <el-option label="ZXY" value="ZXY" />
      </el-select>

      <span class="label">X {{ rx }}°</span>
      <el-slider v-model="rx" :min="-180" :max="180" class="!w-24" @input="applyRotation" />
      <span class="label">Y {{ ry }}°</span>
      <el-slider v-model="ry" :min="-180" :max="180" class="!w-24" @input="applyRotation" />
      <span class="label">Z {{ rz }}°</span>
      <el-slider v-model="rz" :min="-180" :max="180" class="!w-24" @input="applyRotation" />

      <el-tag size="small" type="info" effect="plain">{{ localText }}</el-tag>
      <el-tag size="small" type="warning" effect="plain">{{ worldText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="坐标系与变换"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="坐标问题优先怀疑「Y-up / Z-up」「矩阵没刷新」「旋转顺序」，而不是相机。"
      />
    </template>
  </DemoPage>
</template>
