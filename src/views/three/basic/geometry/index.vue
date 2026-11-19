<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const kind = ref('torusKnot')
const wireframe = ref(false)
const stats = ref('')

let T: any = null
let stage: any = null
let mesh: any = null

const FACTORY: Record<string, (THREE: any) => any> = {
  box: (T) => new T.BoxGeometry(2, 2, 2, 2, 2, 2),
  sphere: (T) => new T.SphereGeometry(1.3, 48, 32),
  cylinder: (T) => new T.CylinderGeometry(0.9, 0.9, 2.2, 48, 1, false),
  torus: (T) => new T.TorusGeometry(1.2, 0.4, 24, 64),
  torusKnot: (T) => new T.TorusKnotGeometry(1.1, 0.36, 200, 32),
  lathe: (T) => {
    const points = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      points.push(new T.Vector2(Math.sin(t * Math.PI) * 1.2 + 0.08, t * 2.4 - 1.2))
    }
    return new T.LatheGeometry(points, 48)
  },
  extrude: (T) => {
    const shape = new T.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(1.4, 0)
    shape.lineTo(1.4, 1.4)
    shape.lineTo(0.7, 2)
    shape.lineTo(0, 1.4)
    shape.closePath()
    return new T.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 })
  },
}

function readStats(geometry: any) {
  const position = geometry.getAttribute('position')
  const vertices = position ? position.count : 0
  const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3
  const groups = geometry.groups?.length ?? 0
  stats.value = `顶点 ${vertices.toLocaleString()} · 三角形 ${Math.round(triangles).toLocaleString()} · index ${geometry.index ? '有' : '无'} · groups ${groups}`
}

function rebuild() {
  if (!mesh || !T) return
  mesh.geometry.dispose()
  mesh.geometry = FACTORY[kind.value](T)
  readStats(mesh.geometry)
}

function applyWireframe(value: any) {
  if (mesh) mesh.material.wireframe = value
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [3.2, 2.4, 4.6], background: '#0a1a28' })

  stage.scene.add(new THREE.HemisphereLight(0xc7d2fe, 0x0b1220, 1.1))
  const dir = new THREE.DirectionalLight(0xffffff, 2.2)
  dir.position.set(4, 6, 5)
  stage.scene.add(dir)

  const geometry = FACTORY[kind.value](THREE)
  readStats(geometry)

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.35,
      roughness: 0.3,
      wireframe: wireframe.value,
      flatShading: false,
    }),
  )
  mesh.material.side = THREE.DoubleSide
  stage.scene.add(mesh)

  stage.onFrame((dt: number) => {
    mesh.rotation.y += dt * 0.4
  })

  return () => {
    stage.dispose()
    stage = null
    mesh = null
    T = null
  }
}

const intro: string[] = [
  'three 的几何体分两类：内置参数化几何体（`BoxGeometry`、`SphereGeometry`、`TorusKnotGeometry`、`LatheGeometry`、`ExtrudeGeometry` …）直接调参数生成；自定义几何体用 `BufferGeometry` 手写顶点数组。两者最终都是「顶点属性 + 索引」的缓冲区，「参数化」只是在 JS 侧算好再上传。',
  '几个参数决定平滑度与体积：`widthSegments / heightSegments`（球、圆柱）、`tubularSegments / radialSegments`（管状）、`curveSegments`（车削、放样）。分段越高越圆滑、三角形越多；TorusKnot 这类用 200 × 32 就上千三角面，几百个实例就会吃满 GPU，需要按屏幕尺寸动态选段数。',
  '几何体一旦创建就占显存：同一个几何体可以被多个 `Mesh` 共享（`new Mesh(geo, mat)` 复用同一份顶点数据），这不会复制显存，只会多一次 DrawCall；所以「大量相同形状」的核心优化是共享几何体 + 共享材质，再考虑合并或实例化。',
]

const blocks: CodeBlock[] = [
  {
    title: '内置几何体与分段参数',
    desc: '分段数 = 平滑度，也 = 三角形数量',
    code: `// 球：widthSegments × heightSegments 决定三角面数量
const sphere = new THREE.SphereGeometry(1.3, 48, 32)

// 管状：沿曲线 200 段 × 截面 32 段
const knot = new THREE.TorusKnotGeometry(1.1, 0.36, 200, 32)

// 车削：一条 2D 轮廓绕 Y 轴旋转
const profile = [new THREE.Vector2(0.1, -1.2), new THREE.Vector2(1.2, 0)]
const lathe = new THREE.LatheGeometry(profile, 48)

// 挤出：2D Shape 沿 Z 方向拉伸
const shape = new THREE.Shape()
shape.moveTo(0, 0); shape.lineTo(1.4, 0); shape.lineTo(1.4, 1.4)
shape.closePath()
const extrude = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true })`,
  },
  {
    title: '几何体数据：属性与索引',
    desc: 'position / normal / uv 都是 Float32 属性，index 决定三角形复用',
    code: `const geo = new THREE.BoxGeometry(1, 1, 1)

geo.getAttribute('position').count      // 顶点数（8 个角 + 重复点）
geo.index.count / 3                     // 三角形数
geo.groups.length                       // 多材质分组数

// 更换几何体时先释放旧的，否则显存缓慢增长
mesh.geometry.dispose()
mesh.geometry = new THREE.SphereGeometry(1, 32, 24)`,
  },
  {
    title: '共享几何体与材质',
    desc: '多个 Mesh 共享同一份几何体不会复制显存，但仍是多次 DrawCall',
    code: `const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0x22d3ee })

for (let i = 0; i < 50; i++) {
  const mesh = new THREE.Mesh(geometry, material)   // 共享
  mesh.position.x = i * 1.4
  scene.add(mesh)
}
// 50 个 Mesh → 50 次 DrawCall，要压到 1 次用 InstancedMesh`,
  },
]

const notes: NoteItem[] = [
  {
    title: '分段数按屏幕占比给',
    body: '一个占屏 200px 的球用 96×64 分段纯属浪费。远处物体降到 16×12，靠近再换高模（`THREE.LOD`）；TorusKnot 这类装饰模型可以直接用低分段 + 法线贴图。',
  },
  {
    title: '换几何体必须 dispose 旧的',
    body: '`mesh.geometry = newGeo` 只是换引用，旧几何体的 VBO 还在显存里。`renderer.info.memory.geometries` 持续上涨就是漏了 `dispose()`。材质与纹理同理。',
  },
  {
    title: 'flatShading 与法线',
    body: '`flatShading: true` 用面法线，立方体风格更硬；默认用顶点法线，平滑但低分段会出现棱角。自定义几何体没传 `normal` 时要 `computeVertexNormals()`，否则光照全黑。',
  },
  {
    title: 'ExtrudeGeometry 的三角面很多',
    body: '带 bevel 的挤出几何体三角形数迅速膨胀，多个叠加容易掉帧。静态且重复的形状可以 `mergeGeometries` 合并，或先在建模软件里做减面。',
  },
]
</script>

<template>
  <DemoPage hint="几何体 Geometry：内置参数化几何体、分段数、顶点/三角形统计与线框观察。" :init="init">
    <template #panel>
      <el-select v-model="kind" size="small" class="!w-32" @change="rebuild">
        <el-option label="立方体 Box" value="box" />
        <el-option label="球体 Sphere" value="sphere" />
        <el-option label="圆柱 Cylinder" value="cylinder" />
        <el-option label="圆环 Torus" value="torus" />
        <el-option label="环面结 Knot" value="torusKnot" />
        <el-option label="车削 Lathe" value="lathe" />
        <el-option label="挤出 Extrude" value="extrude" />
      </el-select>

      <el-checkbox v-model="wireframe" size="small" @change="applyWireframe">线框</el-checkbox>
      <el-tag size="small" type="info" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="几何体 Geometry"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="几何体的两个关键数字：三角形数（性能）与是否共享（显存）。"
      />
    </template>
  </DemoPage>
</template>
