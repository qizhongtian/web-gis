<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const SEGMENTS = 300

const mainMs = ref('-')
const workerMs = ref('-')
const roundTrip = ref('-')
const fpsText = ref('0')
const busy = ref(false)

let T: any = null
let stage: any = null
let controls: any = null
let geometry: any = null
let worker: Worker | null = null
let spin: any = null
let frames = 0
let elapsed = 0

/**
 * Worker 里只做数学：输入格子尺寸与时间，输出高度数组。
 * 用 Blob 直接内联，避免为示例单独加一个构建入口。
 */
const workerSource = `
self.onmessage = function (event) {
  const { size, time } = event.data
  const count = (size + 1) * (size + 1)
  const heights = new Float32Array(count)

  const t0 = performance.now()
  let i = 0
  for (let y = 0; y <= size; y++) {
    const fz = (y / size) * 8 - 4
    for (let x = 0; x <= size; x++) {
      const fx = (x / size) * 8 - 4
      let h = Math.sin(fx * 1.4 + time) * Math.cos(fz * 1.1 + time * 0.7) * 0.45
      h += Math.sin((fx + fz) * 2.7 + time * 1.3) * 0.16
      h += Math.cos(Math.hypot(fx, fz) * 1.9 - time) * 0.22
      heights[i++] = h
    }
  }
  const ms = performance.now() - t0

  // 第二个参数是 transferable：数组所有权移交给主线程，零拷贝
  self.postMessage({ heights, ms }, [heights.buffer])
}
`

function computeOnMain(size: number, time: number) {
  const t0 = performance.now()
  const count = (size + 1) * (size + 1)
  const heights = new Float32Array(count)

  let i = 0
  for (let y = 0; y <= size; y++) {
    const fz = (y / size) * 8 - 4
    for (let x = 0; x <= size; x++) {
      const fx = (x / size) * 8 - 4
      let h = Math.sin(fx * 1.4 + time) * Math.cos(fz * 1.1 + time * 0.7) * 0.45
      h += Math.sin((fx + fz) * 2.7 + time * 1.3) * 0.16
      h += Math.cos(Math.hypot(fx, fz) * 1.9 - time) * 0.22
      heights[i++] = h
    }
  }

  return { heights, ms: performance.now() - t0 }
}

function applyHeights(heights: Float32Array) {
  if (!geometry) return
  const position = geometry.attributes.position
  for (let i = 0; i < heights.length; i++) position.setY(i, heights[i])
  position.needsUpdate = true
  // 顶点变了，法线与包围体必须重算，否则光照与剔除都会错
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

function runMain() {
  if (!geometry) return
  busy.value = true
  const time = Math.random() * 10
  const { heights, ms } = computeOnMain(SEGMENTS, time)
  mainMs.value = `${ms.toFixed(1)} ms`
  applyHeights(heights)
  busy.value = false
}

function runWorker() {
  if (!worker || !geometry) return
  busy.value = true
  const time = Math.random() * 10
  const t0 = performance.now()

  worker.onmessage = (event: MessageEvent) => {
    const { heights, ms } = event.data as { heights: Float32Array; ms: number }
    workerMs.value = `${ms.toFixed(1)} ms`
    roundTrip.value = `${(performance.now() - t0).toFixed(1)} ms`
    applyHeights(heights)
    busy.value = false
  }

  worker.postMessage({ size: SEGMENTS, time })
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 8, 12], background: '#070d15' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xc7e2ff, 0x09121c, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(6, 10, 6)
  scene.add(key)

  geometry = new THREE.PlaneGeometry(12, 12, SEGMENTS, SEGMENTS).rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x3f83a8, metalness: 0.25, roughness: 0.55, flatShading: true }),
  )
  scene.add(mesh)

  // 帧率指示物：主线程被阻塞时它会明显卡顿
  spin = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.32, 0.1, 90, 16),
    new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 1.2 }),
  )
  spin.position.set(4.4, 1.6, 3.6)
  scene.add(spin)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.update()

  worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' })))

  stage.onFrame((dt: number) => {
    controls?.update()
    if (spin) {
      spin.rotation.x += dt * 1.6
      spin.rotation.y += dt * 1.1
    }
    frames++
    elapsed += dt
    if (elapsed >= 0.5) {
      fpsText.value = (frames / elapsed).toFixed(0)
      frames = 0
      elapsed = 0
    }
  })

  return () => {
    worker?.terminate()
    worker = null
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    geometry = null
    spin = null
    T = null
  }
}

const intro: string[] = [
  '浏览器的 JS 只有一条主线程，`requestAnimationFrame`、事件响应、DOM 更新全都在上面。一次 100ms 的同步计算就等于丢掉 6 帧，页面会明显「顿一下」。本页的两个按钮做完全相同的数学：一个在主线程跑，一个在 Worker 里跑。点击「主线程计算」，右上角那个旋转体就会卡住；Worker 版本则不受影响。',
  '几何数据的传递要用 `Transferable`：`postMessage(data, [buffer])` 把 ArrayBuffer 的所有权移交出去，零拷贝。不写第二个参数就会结构化克隆，10 万顶点的 Float32Array 要额外拷一份，收益直接减半。反过来，Worker 返回后主线程写 `position` 属性、重算法线仍然在主线程，这部分开销省不掉——所以大网格更新通常要配合「分块更新」或「只用 GPU 位移」。',
  '实际项目里 Worker 更适合做「结果不需要每帧回到主线程」的任务：地形高度、路径规划、碰撞体生成、大模型的顶点合并、GeoJSON 解析、坐标批量转换。渲染循环本身仍然留在主线程，除非用 `OffscreenCanvas` 把整个渲染搬进 Worker（three 支持，但纹理、输入事件、UI 同步都要自己搭）。',
]

const blocks: CodeBlock[] = [
  {
    title: '创建 Worker 并移交数据',
    desc: 'Blob 内联 + Transferable 零拷贝',
    code: `const worker = new Worker(
  URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' })),
)

worker.onmessage = (event) => {
  const { heights, ms } = event.data
  applyHeights(heights)
}

worker.postMessage({ size: 300, time: 1.2 })

// Worker 内部
self.onmessage = (event) => {
  const { heights } = compute(event.data)
  self.postMessage({ heights, ms }, [heights.buffer])   // 移交所有权
}`,
  },
  {
    title: '写回几何体',
    desc: '改完顶点必须重算法线',
    code: `function applyHeights(heights) {
  const position = geometry.attributes.position

  for (let i = 0; i < heights.length; i++) {
    position.setY(i, heights[i])
  }
  position.needsUpdate = true          // 只改局部范围可用 updateRange

  geometry.computeVertexNormals()      // 否则光照还是旧的
  geometry.computeBoundingSphere()     // 否则剔除会误判
}`,
  },
  {
    title: '把渲染也搬走：OffscreenCanvas',
    desc: 'three 支持在 Worker 里跑 renderer',
    code: `// 主线程
const canvas = renderer.domElement
const offscreen = canvas.transferControlToOffscreen()
worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen])

// Worker 内
const renderer = new THREE.WebGLRenderer({ canvas: event.data.canvas })
// 之后的 resize、鼠标事件、纹理创建都要自己转发到 Worker`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'postMessage 默认是深拷贝',
    body: '不传 transferable 列表时，数据会被结构化克隆。大数组务必用 `[buffer]` 移交所有权——移交后主线程那个数组会变成「分离」状态，长度变 0，不能再用。',
  },
  {
    title: 'Worker 不能直接碰 THREE 对象',
    body: 'Worker 里没有 DOM，也没有场景图（除非把 three 也打包进去）。传输的只能是可序列化的数据：TypedArray、普通对象、ImageBitmap。把几何体当普通 JS 对象传会失败。',
  },
  {
    title: '线程不是免费的',
    body: '每个 Worker 都是独立线程与独立内存，启动成本约几毫秒。频繁建/销毁不如常驻；任务太小（< 5ms）时，消息往返开销反而比直接算更慢。',
  },
  {
    title: '并行度受硬件限制',
    body: '`navigator.hardwareConcurrency` 通常是 4~16。开 8 个 Worker 一起算，单个任务的速度不会变快（除非任务可拆分），反而会抢 CPU 导致渲染线程抖动。',
  },
]
</script>

<template>
  <DemoPage
    hint="Web Worker：同一套地形计算，主线程跑会卡住动画，Worker 跑则流畅。观察右上角旋转体与 FPS。"
    :init="init"
  >
    <template #panel>
      <el-button size="small" type="primary" :disabled="busy" @click="runMain">主线程计算</el-button>
      <el-button size="small" type="success" :disabled="busy" @click="runWorker">Worker 计算</el-button>
      <el-tag size="small" type="danger" effect="plain">主线程 {{ mainMs }}</el-tag>
      <el-tag size="small" type="success" effect="plain">Worker {{ workerMs }}</el-tag>
      <el-tag size="small" effect="plain">往返 {{ roundTrip }}</el-tag>
      <el-tag size="small" effect="plain">{{ fpsText }} FPS</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="Web Worker"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="Worker 解决的是「主线程被占用」，不是「算得更快」。"
      />
    </template>
  </DemoPage>
</template>
