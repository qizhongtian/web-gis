<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

type Op = 'union' | 'intersect' | 'subtract'

const op = ref<Op>('subtract')
const resolution = ref(30)
const showSource = ref(true)
const stats = ref('')

let T: any = null
let stage: any = null
let controls: any = null
let result: any = null
let sourceA: any = null
let sourceB: any = null

// 体素化布尔：用解析式判断「点在不在实体内」，再按集合运算取舍格子
const HALF = 2.6
const SPHERE = { c: [-0.55, 0.15, 0], r: 1.75 }
const BOX = { c: [0.55, 0, 0], size: [2.4, 2.4, 2.4], rotY: 0.5 }

function inSphere(x: number, y: number, z: number) {
  const dx = x - SPHERE.c[0]
  const dy = y - SPHERE.c[1]
  const dz = z - SPHERE.c[2]
  return dx * dx + dy * dy + dz * dz <= SPHERE.r * SPHERE.r
}

function inBox(x: number, y: number, z: number) {
  const dx = x - BOX.c[0]
  const dy = y - BOX.c[1]
  const dz = z - BOX.c[2]
  // 反旋转到盒子局部坐标再比半边长
  const cos = Math.cos(-BOX.rotY)
  const sin = Math.sin(-BOX.rotY)
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  return (
    Math.abs(lx) <= BOX.size[0] / 2 &&
    Math.abs(dy) <= BOX.size[1] / 2 &&
    Math.abs(lz) <= BOX.size[2] / 2
  )
}

function keep(a: boolean, b: boolean) {
  if (op.value === 'union') return a || b
  if (op.value === 'intersect') return a && b
  return a && !b
}

function build() {
  if (!stage || !T) return
  const THREE = T

  if (result) {
    stage.scene.remove(result)
    result.geometry.dispose()
    result.material.dispose()
    result = null
  }

  const res = resolution.value
  const step = (HALF * 2) / res
  const positions: number[] = []
  const start = -HALF + step / 2

  // 第一遍只收集位置：InstancedMesh 的 count 必须提前确定
  for (let i = 0; i < res; i++) {
    const x = start + i * step
    for (let j = 0; j < res; j++) {
      const y = start + j * step
      for (let k = 0; k < res; k++) {
        const z = start + k * step
        if (keep(inSphere(x, y, z), inBox(x, y, z))) positions.push(x, y, z)
      }
    }
  }

  const count = positions.length / 3
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.45, roughness: 0.32 })
  result = new THREE.InstancedMesh(geometry, material, Math.max(count, 1))
  result.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const dummy = new THREE.Object3D()
  const s = step * 0.92
  for (let i = 0; i < count; i++) {
    dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    result.setMatrixAt(i, dummy.matrix)
  }
  result.instanceMatrix.needsUpdate = true
  result.count = count
  result.computeBoundingSphere()
  stage.scene.add(result)

  const ratio = ((count / (res * res * res)) * 100).toFixed(2)
  stats.value = `网格 ${res}³ · 实心 ${count.toLocaleString()} · 占比 ${ratio}%`
}

function apply() {
  build()
  if (sourceA) sourceA.visible = showSource.value
  if (sourceB) sourceB.visible = showSource.value
}

function applySource() {
  if (sourceA) sourceA.visible = showSource.value
  if (sourceB) sourceB.visible = showSource.value
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [6.2, 5.2, 8.2], background: '#0b1220' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xc7e2ff, 0x0b1220, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(6, 10, 6)
  scene.add(key)

  const grid = new THREE.GridHelper(16, 16, 0x1e3a5f, 0x14293f)
  grid.position.y = -2.7
  scene.add(grid)

  // 原始体用线框显示，方便对照运算结果
  const wire = (geo: any, color: number) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.22 }),
    )
    scene.add(m)
    return m
  }

  sourceA = wire(new THREE.SphereGeometry(SPHERE.r, 24, 16), 0xfacc15)
  sourceA.position.set(...SPHERE.c)
  sourceB = wire(new THREE.BoxGeometry(...BOX.size), 0x22d3ee)
  sourceB.position.set(...BOX.c)
  sourceB.rotation.y = BOX.rotY

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.update()

  build()

  stage.onFrame(() => controls?.update())

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    result = null
    sourceA = null
    sourceB = null
    T = null
  }
}

const intro: string[] = [
  'three.js 没有内置布尔运算（CSG）。官方的 `Geometry` 系列只有生成器与变换工具，所有「A 减 B」「A 交 B」的效果都来自第三方库：`three-bvh-csg`（目前维护最活跃，基于 BVH 加速）、`three-csg-ts`（老牌 `csg.js` 的 TS 移植）、以及 wasm 方向 `manifold-3d`。它们的工作方式都是把三角面切成小片，再按「在实体内部 / 外部」筛选并重新缝合。',
  '本页没有引入外部库，而是用「体素化」近似演示集合运算的本质：把空间切成 res³ 个小格子，用解析式判断每个格子中心是否在球 / 长方体内部，然后按 `union`（或）、`intersect`（与）、`subtract`（与非）决定保留，最后用 `InstancedMesh` 把保留下来的格子画成小方块。它直观、绝不产生自相交面，代价是表面是阶梯状的，分辨率越高越接近真实布尔，但格子数按三次方增长。',
  '真实 CSG 也要面对同样的取舍：结果的面数往往比输入多几倍，接缝处顶点重复、法线断裂、UV 与顶点色基本丢失，且输入必须是「封闭流形」（不能有破洞、不能自相交）。因此生产环境通常只对低模做布尔，或者把布尔放在建模软件 / 服务端完成，前端只加载结果。',
]

const blocks: CodeBlock[] = [
  {
    title: '生产方案：three-bvh-csg',
    desc: 'BVH 加速的 CSG，几万面以内可以实时',
    code: `import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'

const evaluator = new Evaluator()
evaluator.attributes = ['position', 'normal', 'uv'] // 想保留的属性

const a = new Brush(meshA.geometry)
const b = new Brush(meshB.geometry)
a.updateMatrixWorld()
b.updateMatrixWorld()

const result = evaluator.evaluate(a, b, SUBTRACTION) // ADDITION / INTERSECTION
result.geometry.computeVertexNormals()

scene.add(result)
// 旧结果必须 dispose，否则 GPU 里会堆积几何体`,
  },
  {
    title: '本页的体素近似',
    desc: '解析式判断 + 集合运算筛选格子',
    code: `const res = 30
const step = 5.2 / res
const cells = []

for (let i = 0; i < res; i++)
for (let j = 0; j < res; j++)
for (let k = 0; k < res; k++) {
  const x = -2.6 + (i + 0.5) * step
  const y = -2.6 + (j + 0.5) * step
  const z = -2.6 + (k + 0.5) * step

  const a = inSphere(x, y, z)
  const b = inBox(x, y, z)
  if (a && !b) cells.push(x, y, z)   // 差集
  // union: a || b   intersect: a && b
}

const mesh = new THREE.InstancedMesh(boxGeo, mat, cells.length / 3)`,
  },
  {
    title: '布尔之后要做的收尾',
    desc: '顶点数、法线、UV 与包围体都会变',
    code: `// 1. 面数可能翻数倍，先看三角形数量
const tris = result.geometry.index
  ? result.geometry.index.count / 3
  : result.geometry.attributes.position.count / 3

// 2. 接缝处法线断裂：整体重算一次
result.geometry.computeVertexNormals()

// 3. 布尔会丢 UV，需要重新投影或改用三平面映射
// material.map = null 时应改用 vertexColors / 三平面着色

// 4. 包围球/包围盒缓存失效，射线拾取与视锥裁剪都会出错
result.geometry.computeBoundingBox()
result.geometry.computeBoundingSphere()`,
  },
]

const notes: NoteItem[] = [
  {
    title: '输入必须是封闭流形',
    body: 'CSG 依赖「面朝外」的封闭实体。平面、破洞模型、单面墙体做布尔会得到空洞或整块消失。CAD 导出模型建议先做一遍法线与封闭性检查（如 `three-mesh-bvh` 的射线判定）。',
  },
  {
    title: '结果面数会膨胀',
    body: '两个 1 万面的模型相减，结果可能 2~4 万面，因为切割线附近大量三角面被细分。做地形挖洞、管道开孔这类需求，优先用贴图遮罩或模板缓冲替代真实 CSG。',
  },
  {
    title: '体素近似的成本是三次方',
    body: '本页 res=30 就是 2.7 万个判定，res=60 直接到 21.6 万，且结果全是不共面的小方块。它适合教学和「低精度碰撞体」，不适合当成品几何。',
  },
  {
    title: '矩阵要先烘进几何',
    body: '库处理的是几何体坐标，不是世界坐标。若物体带旋转缩放，先 `mesh.updateMatrixWorld()`，或 `geometry.applyMatrix4(mesh.matrixWorld)`，否则运算位置会错位。',
  },
]
</script>

<template>
  <DemoPage
    hint="布尔运算：three 无内置 CSG。这里用体素近似演示并集 / 交集 / 差集的判定逻辑，生产环境请用 three-bvh-csg。"
    :init="init"
  >
    <template #panel>
      <span class="label">运算</span>
      <el-radio-group v-model="op" size="small" @change="apply">
        <el-radio-button value="union">并集</el-radio-button>
        <el-radio-button value="intersect">交集</el-radio-button>
        <el-radio-button value="subtract">差集</el-radio-button>
      </el-radio-group>
      <span class="label">精度 {{ resolution }}³</span>
      <el-slider v-model="resolution" :min="12" :max="46" :step="2" class="!w-28" @change="apply" />
      <el-checkbox v-model="showSource" size="small" @change="applySource">显示原始体</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="布尔运算 / CSG"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="CSG 不是免费操作：面数、法线、UV、包围体都要重新处理。"
      />
    </template>
  </DemoPage>
</template>
