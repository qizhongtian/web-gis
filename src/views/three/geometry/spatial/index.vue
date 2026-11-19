<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const count = ref(1200)
const useIndex = ref(true)
const showNodes = ref(false)
const stats = ref('')

let T: any = null
let stage: any = null
let controls: any = null
let group: any = null
let octree: any = null
let nodeLines: any = null
let helper: any = null
let hitLine: any = null
let meshes: any[] = []

let pointer = { x: 0, y: 0, inside: false }
let acc = 0
let avgBrute = 0
let avgIndex = 0

/**
 * 最小八叉树：只做「插入 + 射线查询」两件事
 * 思路：节点若是叶子且物品过多就切成 8 个子盒；
 * 物体的包围球中心落在哪个子盒就下沉到哪一层，跨界物体留在父节点。
 */
class OctreeNode {
  th: any
  box: any
  depth: number
  items: any[] = []
  children: OctreeNode[] | null = null

  constructor(th: any, box: any, depth = 0) {
    this.th = th
    this.box = box
    this.depth = depth
  }

  insert(mesh: any) {
    if (this.children) {
      for (const child of this.children) {
        if (child.box.containsPoint(mesh.position)) {
          child.insert(mesh)
          return
        }
      }
      // 正好压在分割面上的物体：留在父节点，避免漏查
      this.items.push(mesh)
      return
    }

    this.items.push(mesh)
    if (this.items.length > 8 && this.depth < 6) this.split()
  }

  split() {
    const THREE = this.th
    const { min, max } = this.box
    const center = this.box.getCenter(new THREE.Vector3())
    const halves: any[] = []

    for (let i = 0; i < 8; i++) {
      const useMaxX = (i & 1) !== 0
      const useMaxY = (i & 2) !== 0
      const useMaxZ = (i & 4) !== 0
      halves.push(
        new THREE.Box3(
          new THREE.Vector3(useMaxX ? center.x : min.x, useMaxY ? center.y : min.y, useMaxZ ? center.z : min.z),
          new THREE.Vector3(useMaxX ? max.x : center.x, useMaxY ? max.y : center.y, useMaxZ ? max.z : center.z),
        ),
      )
    }

    this.children = halves.map((box) => new OctreeNode(this.th, box, this.depth + 1))

    const pending = this.items
    this.items = []
    for (const mesh of pending) {
      let placed = false
      for (const child of this.children) {
        if (child.box.containsPoint(mesh.position)) {
          child.insert(mesh)
          placed = true
          break
        }
      }
      if (!placed) this.items.push(mesh)
    }
  }

  /** 盒子与射线不相交就整枝剪掉，这是加速的全部来源 */
  raycast(raycaster: any, out: any[], counter: { tested: number }) {
    if (!raycaster.ray.intersectsBox(this.box)) return

    if (this.children) {
      for (const child of this.children) child.raycast(raycaster, out, counter)
    }

    for (const mesh of this.items) {
      counter.tested++
      mesh.raycast(raycaster, out)
    }
  }

  collectBoxes(boxes: any[], maxDepth: number) {
    if (this.depth > maxDepth) return
    boxes.push(this.box)
    this.children?.forEach((child) => child.collectBoxes(boxes, maxDepth))
  }
}

/** 把一堆 Box3 转成一条 LineSegments（一次 DrawCall 画完整棵树） */
function boxesToLines(THREE: any, boxes: any[]) {
  const positions: number[] = []
  const corners = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ]
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]

  for (const box of boxes) {
    const pts = corners.map(([x, y, z]) =>
      new THREE.Vector3(
        x ? box.max.x : box.min.x,
        y ? box.max.y : box.min.y,
        z ? box.max.z : box.min.z,
      ),
    )
    for (const [a, b] of edges) positions.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22 }),
  )
}

function clearScene() {
  if (group) {
    group.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
    stage.scene.remove(group)
    group = null
  }
  if (nodeLines) {
    stage.scene.remove(nodeLines)
    nodeLines.geometry.dispose()
    nodeLines.material.dispose()
    nodeLines = null
  }
  meshes = []
  octree = null
}

function build() {
  if (!stage || !T) return
  const THREE = T
  clearScene()

  const total = count.value
  const side = Math.ceil(Math.sqrt(total))
  const gap = 0.55
  const half = (side * gap) / 2
  const geometry = new THREE.BoxGeometry(0.34, 1, 0.34)
  const material = new THREE.MeshStandardMaterial({ color: 0x2f6f9f, metalness: 0.3, roughness: 0.45 })

  group = new THREE.Group()

  for (let i = 0; i < total; i++) {
    const x = (i % side) * gap - half
    const z = Math.floor(i / side) * gap - half
    const dist = Math.hypot(x, z)
    const height = 0.35 + Math.max(0, 1 - dist / (half * 1.15)) * (0.6 + Math.random() * 1.4)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, height / 2, z)
    mesh.scale.y = height
    mesh.updateMatrixWorld()
    group.add(mesh)
    meshes.push(mesh)
    // 每个物体共用同一份材质，避免 1000+ 个材质把 DrawCall 压力混进拾取对比
  }
  stage.scene.add(group)

  // 建树：根盒要完整包住所有物体
  const rootBox = new THREE.Box3(
    new THREE.Vector3(-half - 1, -0.2, -half - 1),
    new THREE.Vector3(half + 1, 4, half + 1),
  )
  octree = new OctreeNode(THREE, rootBox, 0)
  for (const mesh of meshes) octree.insert(mesh)

  rebuildNodeLines()
  updateStats(0, 0, 0, 0)
}

function rebuildNodeLines() {
  if (nodeLines) {
    stage.scene.remove(nodeLines)
    nodeLines.geometry.dispose()
    nodeLines.material.dispose()
    nodeLines = null
  }
  if (!showNodes.value || !octree) return
  const boxes: any[] = []
  octree.collectBoxes(boxes, 2)
  nodeLines = boxesToLines(T, boxes)
  stage.scene.add(nodeLines)
}

function applyNodes() {
  rebuildNodeLines()
}

function updateStats(bruteMs: number, bruteCount: number, indexMs: number, indexCount: number) {
  avgBrute = avgBrute ? avgBrute * 0.8 + bruteMs * 0.2 : bruteMs
  avgIndex = avgIndex ? avgIndex * 0.8 + indexMs * 0.2 : indexMs
  stats.value = `暴力 ${bruteCount} 次 · ${avgBrute.toFixed(2)}ms ｜ 索引 ${indexCount} 次 · ${avgIndex.toFixed(2)}ms`
}

function pick() {
  if (!stage || !meshes.length) return
  const THREE = T
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(pointer.x, pointer.y)
  raycaster.setFromCamera(ndc, stage.camera)

  const counter = { tested: 0 }
  let hit: any = null

  let t0 = performance.now()
  if (useIndex.value && octree) {
    const hits: any[] = []
    octree.raycast(raycaster, hits, counter)
    // 节点盒相交不代表三角面相交，距离排序后取最近的有效命中
    const valid = hits.filter((h: any) => h.distance >= raycaster.near && h.distance <= raycaster.far)
    valid.sort((a: any, b: any) => a.distance - b.distance)
    hit = valid[0] ?? null
  } else {
    const hits: any[] = []
    for (const mesh of meshes) {
      counter.tested++
      mesh.raycast(raycaster, hits)
    }
    hits.sort((a: any, b: any) => a.distance - b.distance)
    hit = hits[0] ?? null
  }
  const cost = performance.now() - t0

  // 对照组：同一帧内跑另一条路径，方便对比
  const counter2 = { tested: 0 }
  const t1 = performance.now()
  if (useIndex.value) {
    const hits: any[] = []
    for (const mesh of meshes) {
      counter2.tested++
      mesh.raycast(raycaster, hits)
    }
  } else if (octree) {
    octree.raycast(raycaster, [], counter2)
  }
  const cost2 = performance.now() - t1

  const bruteCount = useIndex.value ? counter2.tested : counter.tested
  const bruteMs = useIndex.value ? cost2 : cost
  const indexCount = useIndex.value ? counter.tested : counter2.tested
  const indexMs = useIndex.value ? cost : cost2
  updateStats(bruteMs, bruteCount, indexMs, indexCount)

  if (hit?.object) {
    helper.visible = true
    helper.setFromObject(hit.object)
    const end = raycaster.ray.at(hit.distance, new THREE.Vector3())
    hitLine.geometry.setFromPoints([raycaster.ray.origin.clone(), end])
    hitLine.visible = true
  } else {
    helper.visible = false
    hitLine.visible = false
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 14, 20], background: '#0a1522' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0.8, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.3))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(10, 18, 8)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0c1e2e, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  helper = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), 0xf97316)
  helper.visible = false
  scene.add(helper)

  hitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.7 }),
  )
  hitLine.visible = false
  scene.add(hitLine)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 0.8, 0)
  controls.update()

  build()

  const onPointerMove = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      inside: true,
    }
  }
  const onLeave = () => {
    pointer.inside = false
    helper.visible = false
    hitLine.visible = false
  }
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerleave', onLeave)

  stage.onFrame((dt: number) => {
    controls?.update()
    // 每帧算太浪费，10Hz 足够观察数值
    acc += dt
    if (acc < 0.1) return
    acc = 0
    if (!pointer.inside) return

    pick()
  })

  return () => {
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    renderer.domElement.removeEventListener('pointerleave', onLeave)
    controls?.dispose()
    controls = null
    clearScene()
    stage.dispose()
    stage = null
    helper = null
    hitLine = null
    T = null
  }
}

const intro: string[] = [
  '射线拾取、碰撞检测、邻近查询本质上都是「在一堆物体里找出少数几个候选」。朴素做法是逐个测试：1000 个物体就让每个物体都算一遍。空间索引把空间切块，先判断「射线经过哪些块」，只对块里的物体做精确测试——这就是八叉树 / BVH / 均匀网格的共同思路，区别只在划分方式和检索规则。',
  '本页的八叉树每个节点是一个轴对齐包围盒：物品超过 8 个且深度未到上限就切成 8 个子盒，物品按中心点下沉；压在分割面上的物品留在父节点，否则射线查询会漏掉它们。查询时先用 `ray.intersectsBox(node.box)` 剪枝，不命中就整枝跳过，命中才下探到叶子的精确三角面测试。',
  '对静态场景，八叉树构建一次就能长期复用；对动态物体，每次移动都要删除再插入，通常改用 BVH（如 `three-mesh-bvh`，直接对三角面建树，能把百万面的拾取压到微秒级）或均匀网格哈希（移动只改一个挂链）。注意「节点盒相交」只说明可能有交集，最终仍需精确测试并按距离排序。',
]

const blocks: CodeBlock[] = [
  {
    title: '插入：按中心点下沉',
    desc: '超阈值就切成 8 个子盒，跨界物体留在父节点',
    code: `class OctreeNode {
  box: THREE.Box3
  items: Mesh[] = []
  children: OctreeNode[] | null = null

  insert(mesh: Mesh) {
    if (this.children) {
      const hit = this.children.find((c) => c.box.containsPoint(mesh.position))
      if (hit) return hit.insert(mesh)
      this.items.push(mesh)   // 压在分割面上，留在父节点
      return
    }

    this.items.push(mesh)
    if (this.items.length > 8 && depth < 6) this.split()
  }
}`,
  },
  {
    title: '查询：盒子剪枝 + 精测',
    desc: '不相交直接 return，命中叶子才测三角面',
    code: `raycast(raycaster, out, counter) {
  if (!raycaster.ray.intersectsBox(this.box)) return  // 整枝剪掉

  if (this.children) {
    for (const child of this.children) child.raycast(raycaster, out, counter)
  }

  for (const mesh of this.items) {
    counter.tested++
    mesh.raycast(raycaster, out)   // 精确测试，写入 out
  }
}

const hits = []
octree.raycast(raycaster, hits, { tested: 0 })
hits.sort((a, b) => a.distance - b.distance)
const first = hits[0]`,
  },
  {
    title: '现成方案：three-mesh-bvh',
    desc: '对三角面建 BVH，百万面也能实时拾取',
    code: `import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

mesh.geometry.computeBoundsTree()   // 建树一次
raycaster.firstHitOnly = true       // 只要最近命中，省掉排序

// 变更顶点后要重建或调用 refit()
mesh.geometry.boundsTree.refit()`,
  },
]

const notes: NoteItem[] = [
  {
    title: '节点盒相交 ≠ 命中',
    body: '`intersectsBox` 只说明射线穿过了这个区域，里面的物体可能一个都没被射中。必须回到三角面做精确测试，再按 `distance` 排序取最近的。',
  },
  {
    title: '分层密度决定效率',
    body: '物体全部挤在一个角落时，八叉树会严重失衡（有些分支空，有些分支很深）。均匀分布用八叉树 / 网格都行，极端不均匀更适合 BVH。',
  },
  {
    title: '动态物体不要重建整棵树',
    body: '重建是 O(n log n) 级别，每帧重建比暴力查询还慢。移动频繁的场景改用「均匀网格 + 每格挂链」，插入删除只动一个格子。',
  },
  {
    title: '别忘了包围体缓存',
    body: '`mesh.raycast` 依赖 `geometry.boundingSphere`；手动改过 position 属性后要 `computeBoundingSphere()`。八叉树插入用的是 `mesh.position`，父级换了变换要换算到同一坐标空间。',
  },
]
</script>

<template>
  <DemoPage
    hint="空间索引：3000 个物体逐个测 vs 八叉树剪枝。鼠标移到画布上对比两者耗时的数量级差异。"
    :init="init"
  >
    <template #panel>
      <span class="label">物体 {{ count }}</span>
      <el-slider v-model="count" :min="300" :max="3000" :step="100" class="!w-32" @change="build" />
      <el-checkbox v-model="useIndex" size="small">使用八叉树</el-checkbox>
      <el-checkbox v-model="showNodes" size="small" @change="applyNodes">显示分区</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="空间索引 / 八叉树"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="索引的唯一目的是「少测几个」，剪枝不命中就不要往下走。"
      />
    </template>
  </DemoPage>
</template>
