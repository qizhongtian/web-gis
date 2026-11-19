<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const ndcText = ref('NDC (-, -)')
const worldText = ref('点击地面读取世界坐标')
const screenText = ref('指针位置 (-, -)')

let stage: any = null
let raycaster: any = null
let pointer: any = null
let ground: any = null
let labels: HTMLElement[] = []
let anchors: any[] = []
let tmp: any = null
let host: HTMLElement | null = null

const ANCHORS = [
  { text: 'A · 塔基', x: -3.2, y: 1.2, z: 0 },
  { text: 'B · 塔身', x: 0, y: 3.4, z: -1.6 },
  { text: 'C · 塔顶', x: 3.2, y: 1.2, z: 1.4 },
]

function makeLabel(text: string) {
  const node = document.createElement('div')
  node.textContent = text
  node.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'padding:2px 6px',
    'border-radius:4px',
    'background:rgba(37,99,235,0.88)',
    'color:#fff',
    'font-size:11px',
    'line-height:1.4',
    'white-space:nowrap',
    'pointer-events:none',
    'will-change:transform',
  ].join(';')
  host?.appendChild(node)
  labels.push(node)
  return node
}

function init(THREE: any, el: HTMLElement) {
  host = el
  tmp = new THREE.Vector3()
  stage = createStage(THREE, el, { position: [6, 5, 8], background: '#0a1a28' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 1.2, 0)

  stage.onFrame(() => {
    camera.lookAt(0, 1.2, 0)
  })

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(5, 8, 6)
  scene.add(key)

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const grid = new THREE.GridHelper(16, 16, 0x24506e, 0x16324a)
  grid.position.y = 0.002
  scene.add(grid)

  // 三个「兴趣点」，DOM 标签通过 project 跟随
  ANCHORS.forEach((item) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, item.y, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.35, roughness: 0.4 }),
    )
    mesh.position.set(item.x, item.y / 2, item.z)
    scene.add(mesh)

    const anchor = new THREE.Object3D()
    anchor.position.set(item.x, item.y + 0.35, item.z)
    scene.add(anchor)
    anchors.push({ anchor, label: makeLabel(item.text) })
  })

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  const canvas = renderer.domElement
  const onMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1
    screenText.value = `指针 (${Math.round(event.clientX - rect.left)}, ${Math.round(event.clientY - rect.top)})`
    ndcText.value = `NDC (${nx.toFixed(3)}, ${ny.toFixed(3)})`
  }

  const onClick = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(ground, false)[0]
    worldText.value = hit
      ? `世界 (${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)})`
      : '未命中地面'
  }

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerdown', onClick)

  // 每帧把世界坐标投影成屏幕坐标，驱动 DOM 标签
  stage.onFrame(() => {
    const w = el.clientWidth
    const h = el.clientHeight
    camera.updateMatrixWorld()
    anchors.forEach(({ anchor, label }) => {
      tmp.copy(anchor.position).project(camera)
      const visible = tmp.z > -1 && tmp.z < 1
      label.style.display = visible ? 'block' : 'none'
      if (!visible) return
      const x = (tmp.x * 0.5 + 0.5) * w
      const y = (-tmp.y * 0.5 + 0.5) * h
      label.style.transform = `translate(-50%, -140%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    })
  })

  return () => {
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerdown', onClick)
    labels.forEach((node) => node.remove())
    labels = []
    anchors = []
    stage.dispose()
    stage = null
    raycaster = null
    pointer = null
    ground = null
    tmp = null
    host = null
  }
}

const intro: string[] = [
  '三维到二维有两条常用路径：`Vector3.project(camera)` 把世界坐标乘上「视图 × 投影」矩阵得到 NDC（范围 -1~1），再换算成 CSS 像素就能定位 DOM 标签；反过来 `Vector3.unproject(camera)` 把 NDC 反投影成世界坐标，配合射线就能回答「鼠标指着地面上的哪一点」。',
  '换算公式要背下来：`cssX = (ndc.x * 0.5 + 0.5) * width`，`cssY = (-ndc.y * 0.5 + 0.5) * height`（注意 Y 轴翻转），其中 `width/height` 必须是 CSS 显示尺寸，不是 `drawingBuffer` 尺寸——`setPixelRatio` 只影响绘制分辨率，不影响 DOM 坐标。',
  '`project()` 的结果还有 z：z 在 -1~1 表示落在近远裁剪面之间，z > 1 表示在相机背后或远平面之外。相机背后投影出的屏幕坐标会「镜像」到画面里，标签必须在 z 越界时隐藏，否则会出现「物体在身后，标签却跑到屏幕另一侧」的经典 bug。',
]

const blocks: CodeBlock[] = [
  {
    title: '世界坐标 → 屏幕坐标（DOM 标签跟随）',
    desc: 'project 得到 NDC，再换算成容器内的 CSS 像素',
    code: `const v = new THREE.Vector3()

function updateLabel(anchor, labelEl) {
  v.copy(anchor.position).project(camera)   // 世界 → NDC
  const behind = v.z < -1 || v.z > 1
  labelEl.style.display = behind ? 'none' : 'block'
  if (behind) return

  const x = (v.x * 0.5 + 0.5) * el.clientWidth
  const y = (-v.y * 0.5 + 0.5) * el.clientHeight
  labelEl.style.transform = 'translate(-50%, -140%) translate(' + x + 'px, ' + y + 'px)'
}`,
  },
  {
    title: '屏幕坐标 → 世界坐标',
    desc: '先转 NDC，再反投影；要具体落点就与平面求交',
    code: `const rect = canvas.getBoundingClientRect()
const ndc = new THREE.Vector2(
  ((event.clientX - rect.left) / rect.width) * 2 - 1,
  -((event.clientY - rect.top) / rect.height) * 2 + 1,
)

// 方式一：反投影到近平面上的点
const nearPoint = new THREE.Vector3(ndc.x, ndc.y, -1).unproject(camera)

// 方式二（更常用）：射线与地面求交，拿到真实落点
const raycaster = new THREE.Raycaster()
raycaster.setFromCamera(ndc, camera)
const hit = raycaster.intersectObject(groundPlane, false)[0]
if (hit) console.log(hit.point)`,
  },
  {
    title: '与「地平平面」求交（无需地面网格）',
    desc: '用数学平面代替 Mesh，性能好且不受遮挡影响',
    code: `const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)   // y = 0
const target = new THREE.Vector3()
const ray = new THREE.Raycaster()
ray.setFromCamera(ndc, camera)

if (ray.ray.intersectPlane(plane, target)) {
  marker.position.copy(target)
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '标签跳动先查 z 越界',
    body: '相机背后的点 `project()` 也会给出 NDC，坐标会翻到画面另一侧。必须用 `z` 判断是否在近远裁剪面之间，越界就隐藏标签。',
  },
  {
    title: '矩阵要新鲜',
    body: '`project / unproject / Raycaster` 都依赖 `camera.matrixWorldInverse`。刚改完相机位置就立刻换算，先 `camera.updateMatrixWorld()`，或把换算放到渲染之后。',
  },
  {
    title: 'CSS 尺寸 ≠ 绘制尺寸',
    body: '`setPixelRatio(2)` 时 `canvas.width` 是 CSS 宽度的 2 倍。DOM 标签与鼠标坐标一律以 `getBoundingClientRect()` 为准，否则高 DPR 屏上会偏一半。',
  },
  {
    title: '平面求交比 Mesh 求交更稳',
    body: '用数学平面 `Plane` 求交不受地面网格边界、透明遮挡影响，也更快。需要「贴在起伏地形上」时，再改成对地形 / mesh 做 Raycaster。',
  },
]
</script>

<template>
  <DemoPage hint="坐标转换：世界坐标 project 成屏幕坐标驱动 DOM 标签，点击反投影读取地面落点。" :init="init">
    <template #panel>
      <el-tag size="small" type="info" effect="plain">{{ screenText }}</el-tag>
      <el-tag size="small" type="info" effect="plain">{{ ndcText }}</el-tag>
      <el-tag size="small" type="success" effect="plain">{{ worldText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="坐标转换"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="project / unproject 的坑：Y 轴翻转、CSS 尺寸、z 越界、矩阵没刷新。"
      />
    </template>
  </DemoPage>
</template>
