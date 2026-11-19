<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const amplitude = ref(0.5)
const wireframe = ref(false)
const stats = ref('')

let T: any = null
let stage: any = null
let geometry: any = null
let mesh: any = null
let basePositions: Float32Array | null = null
let positionAttr: any = null

const SEGMENTS = 48
const SIZE = 6

function buildGeometry(THREE: any) {
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let iy = 0; iy <= SEGMENTS; iy++) {
    for (let ix = 0; ix <= SEGMENTS; ix++) {
      const u = ix / SEGMENTS
      const v = iy / SEGMENTS
      const x = (u - 0.5) * SIZE
      const z = (v - 0.5) * SIZE
      positions.push(x, 0, z)
      uvs.push(u, v)
      // 顶点色：按高度渐变，可直接被 vertexColors 使用
      const shade = 0.35 + v * 0.5
      colors.push(0.14 + shade * 0.2, 0.55 + shade * 0.3, 0.85)
    }
  }

  for (let iy = 0; iy < SEGMENTS; iy++) {
    for (let ix = 0; ix < SEGMENTS; ix++) {
      const a = iy * (SEGMENTS + 1) + ix
      const b = a + 1
      const c = a + SEGMENTS + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setIndex(indices)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}

function wave(time: number) {
  if (!geometry || !basePositions) return
  const array = positionAttr.array as Float32Array
  for (let i = 0; i < array.length; i += 3) {
    const x = basePositions[i]
    const z = basePositions[i + 2]
    array[i + 1] =
      Math.sin(x * 1.2 + time) * amplitude.value * 0.5 +
      Math.cos(z * 1.6 + time * 0.8) * amplitude.value * 0.4
  }
  // 改完顶点必须置脏，否则 GPU 侧还是旧数据
  positionAttr.needsUpdate = true
  geometry.computeVertexNormals()
}

function applyAmplitude(value: any) {
  if (!T || !geometry) return
  wave(stage?.clock.elapsedTime ?? 0)
  void value
}

function applyWireframe(value: any) {
  if (mesh) mesh.material.wireframe = value
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 4.4, 7.6], background: '#0a1a28' })
  const { scene, camera } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(5, 8, 4)
  scene.add(key)

  geometry = buildGeometry(THREE)
  positionAttr = geometry.getAttribute('position')
  // 顶点数据每帧变化 → DynamicDrawUsage 让驱动选择更新的存储策略
  positionAttr.setUsage(THREE.DynamicDrawUsage)
  basePositions = new Float32Array(positionAttr.array as Float32Array)
  stats.value = `顶点 ${positionAttr.count.toLocaleString()} · 三角形 ${(geometry.index.count / 3).toLocaleString()} · 属性 position/color/uv/index`

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.25,
      roughness: 0.4,
      wireframe: wireframe.value,
      side: THREE.DoubleSide,
    }),
  )
  scene.add(mesh)

  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(SIZE, SIZE, SIZE)),
    new THREE.LineBasicMaterial({ color: 0x1e4b66 }),
  )
  box.position.y = -SIZE / 2
  scene.add(box)

  stage.onFrame(() => {
    wave(stage.clock.elapsedTime)
  })

  return () => {
    stage.dispose()
    stage = null
    geometry = null
    mesh = null
    positionAttr = null
    basePositions = null
    T = null
  }
}

const intro: string[] = [
  '`BufferGeometry` 是 three 里所有几何体的底层表示：一组「属性（attribute）」+ 可选的「索引（index）」。`position` 是顶点坐标（每 3 个浮点一个顶点），`normal` 是法线，`uv` 是纹理坐标，`color` 是顶点色；`index` 用整数下标复用顶点，48×48 的网格只需 2401 个顶点就能画出 4608 个三角形。',
  '内置几何体（Box、Sphere…）都是 `BufferGeometry` 的子类，参数化只是为了方便。手写几何体的流程是：算数组 → `setAttribute` 包装成 `BufferAttribute` → `setIndex` 建索引 → `computeVertexNormals()` 算法线。属性名不是随便起的：`position`、`normal`、`uv` 会被内置材质自动识别，自定义属性名则需要在着色器里手动声明。',
  '需要每帧改顶点时，注意两点：`attribute.setUsage(THREE.DynamicDrawUsage)` 提示驱动这是动态数据；改完必须 `attribute.needsUpdate = true`，否则 GPU 拿到的还是旧缓冲。`computeVertexNormals()` 是 O(三角形数) 的 CPU 计算，几万面以上的动态网格应该放到顶点着色器里做位移。',
]

const blocks: CodeBlock[] = [
  {
    title: '手写网格几何体',
    desc: 'position / color / uv / index 四件套',
    code: `const positions = []
const uvs = []
const indices = []

for (let iy = 0; iy <= SEG; iy++) {
  for (let ix = 0; ix <= SEG; ix++) {
    const u = ix / SEG
    const v = iy / SEG
    positions.push((u - 0.5) * SIZE, 0, (v - 0.5) * SIZE)
    uvs.push(u, v)
  }
}

for (let iy = 0; iy < SEG; iy++) {
  for (let ix = 0; ix < SEG; ix++) {
    const a = iy * (SEG + 1) + ix
    const b = a + 1
    const c = a + SEG + 1
    const d = c + 1
    indices.push(a, c, b, b, c, d)   // 两个三角形一个格子
  }
}

const geo = new THREE.BufferGeometry()
geo.setIndex(indices)
geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
geo.computeVertexNormals()`,
  },
  {
    title: '动态更新顶点',
    desc: 'DynamicDrawUsage + needsUpdate，改完再算法线',
    code: `const attr = geometry.getAttribute('position')
attr.setUsage(THREE.DynamicDrawUsage)
const base = new Float32Array(attr.array)

function update(time) {
  const arr = attr.array
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i]
    const z = base[i + 2]
    arr[i + 1] = Math.sin(x * 1.2 + time) * 0.5
  }
  attr.needsUpdate = true          // 必须
  geometry.computeVertexNormals()
}`,
  },
  {
    title: '索引与局部绘制',
    desc: 'drawRange / groups 可以做分块渲染与多材质',
    code: `// 只画前 300 个索引（例如渐进加载的区域）
geometry.setDrawRange(0, 300)

// 多材质：按 groups 分段
geometry.clearGroups()
geometry.addGroup(0, 600, 0)      // 第 0 段用 material[0]
geometry.addGroup(600, 600, 1)
const mesh = new THREE.Mesh(geometry, [matA, matB])

// 计算包围球（视锥裁剪 / 射线拾取都依赖它）
geometry.computeBoundingSphere()`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'attribute 的 itemSize 要对',
    body: '`position` 是 3、`uv` 是 2、`skinWeight` 是 4，写错会让 GPU 按错误步长读取，表现为模型撕裂或全黑。缓冲区长度必须是 `count × itemSize`。',
  },
  {
    title: '索引类型与顶点上限',
    body: '顶点数超过 65535 时索引必须是 `Uint32BufferAttribute`（three 会自动选）。自定义几何体手动 `setIndex(new THREE.Uint16BufferAttribute(...))` 超限会静默出错。',
  },
  {
    title: '动态网格算力在 CPU',
    body: '每帧遍历几万顶点 + `computeVertexNormals` 会很吃 CPU。位移、波浪这类效果优先用顶点着色器（见 Shader 章节），CPU 只传一个时间 uniform。',
  },
  {
    title: '几何体是「共享资源」',
    body: '同一 `BufferGeometry` 可以给多个 Mesh 共用，`dispose()` 只需一次。删除 Mesh 时不要无脑释放几何体，先确认没有其它引用。',
  },
]
</script>

<template>
  <DemoPage hint="BufferGeometry：手写顶点 / 索引 / 顶点色，逐帧更新顶点与法线的完整流程。" :init="init">
    <template #panel>
      <span class="label">起伏 {{ amplitude.toFixed(2) }}</span>
      <el-slider v-model="amplitude" :min="0" :max="2" :step="0.05" class="!w-32" @input="applyAmplitude" />
      <el-checkbox v-model="wireframe" size="small" @change="applyWireframe">线框</el-checkbox>
      <el-tag size="small" type="info" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="BufferGeometry"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="手写几何体的顺序：数组 → attribute → index → 法线 → 包围球。"
      />
    </template>
  </DemoPage>
</template>
