<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

interface Task {
  name: string
  size: number
  duration: number
  progress: number
  state: 'waiting' | 'loading' | 'done'
  mesh: any
  material: any
}

const limit = ref(3)
const unlimited = ref(false)
const doneText = ref('0 / 12')
const peakText = ref('0')
const timeText = ref('0.00s')
const stateText = ref('待开始')

const TASKS = [
  'terrain.glb', 'buildings.glb', 'roads.geojson', 'trees.glb',
  'water.png', 'normal.png', 'roads.png', 'labels.json',
  'pipes.glb', 'pumps.glb', 'terrain-tex.ktx2', 'env.hdr',
]

let T: any = null
let stage: any = null
let controls: any = null
let group: any = null
let tasks: Task[] = []
let running = false
let elapsed = 0
let active = 0
let doneCount = 0
let peak = 0

const COLORS = {
  waiting: 0x1e293b,
  loading: 0x0ea5e9,
  done: 0x22c55e,
}

function build() {
  if (!stage || !T) return
  const THREE = T

  if (group) {
    stage.scene.remove(group)
    group.traverse((obj: any) => {
      obj.geometry?.dispose?.()
      obj.material?.dispose?.()
    })
  }

  group = new THREE.Group()
  tasks = []
  running = false
  elapsed = 0
  active = 0
  doneCount = 0
  peak = 0

  const width = 0.78
  const startX = -((TASKS.length - 1) * width) / 2
  const geometry = new THREE.BoxGeometry(0.62, 1, 0.62)
  // 位移补偿：让盒子从地面往上长，而不是从中心缩放
  geometry.translate(0, 0.5, 0)

  TASKS.forEach((name, i) => {
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.waiting,
      emissive: COLORS.waiting,
      emissiveIntensity: 0.6,
      metalness: 0.4,
      roughness: 0.35,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(startX + i * width, 0, 0)
    mesh.scale.y = 0.02
    group!.add(mesh)

    tasks.push({
      name,
      size: 0.4 + Math.random() * 3.6,
      duration: 0.7 + Math.random() * 0.8,
      progress: 0,
      state: 'waiting',
      mesh,
      material,
    })
  })

  stage.scene.add(group)
  reset()
}

function reset() {
  running = false
  elapsed = 0
  active = 0
  doneCount = 0
  peak = 0

  for (const task of tasks) {
    task.progress = 0
    task.state = 'waiting'
    task.duration = 0.7 + Math.random() * 0.8
    task.material.color.setHex(COLORS.waiting)
    task.material.emissive.setHex(COLORS.waiting)
    task.mesh.scale.y = 0.02
  }

  doneText.value = `0 / ${tasks.length}`
  peakText.value = '0'
  timeText.value = '0.00s'
  stateText.value = '待开始'
}

function start() {
  if (!tasks.length) return
  reset()
  running = true
  stateText.value = '加载中'
}

function tick(dt: number) {
  if (!running) return

  elapsed += dt

  // 调度：有空位就从队头取任务
  const maxActive = unlimited.value ? tasks.length : limit.value
  while (active < maxActive) {
    const next = tasks.find((task) => task.state === 'waiting')
    if (!next) break
    next.state = 'loading'
    next.material.color.setHex(COLORS.loading)
    next.material.emissive.setHex(COLORS.loading)
    active++
    peak = Math.max(peak, active)
  }

  for (const task of tasks) {
    if (task.state !== 'loading') continue

    // 体积越大越慢：模拟真实资源下载
    task.progress += dt / (task.duration * (0.6 + task.size * 0.45))
    if (task.progress >= 1) {
      task.progress = 1
      task.state = 'done'
      active--
      doneCount++
      task.material.color.setHex(COLORS.done)
      task.material.emissive.setHex(COLORS.done)
    }

    task.mesh.scale.y = 0.05 + task.progress * 1.3
  }

  doneText.value = `${doneCount} / ${tasks.length}`
  peakText.value = String(peak)
  timeText.value = `${elapsed.toFixed(2)}s`

  if (doneCount === tasks.length) {
    running = false
    stateText.value = '已完成'
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 6.4, 10.5], background: '#070d15' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0.8, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2)
  key.position.set(4, 10, 8)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 20),
    new THREE.MeshStandardMaterial({ color: 0x0a1620, roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.1
  controls.target.set(0, 0.8, 0)
  controls.update()

  build()

  stage.onFrame((dt: number) => {
    controls?.update()
    tick(Math.min(dt, 0.1))
    if (group) group.rotation.y = Math.sin(stage.clock.elapsedTime * 0.2) * 0.12
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    group = null
    tasks = []
    T = null
  }
}

const intro: string[] = [
  '「资源调度」关心的不是单个文件怎么加载，而是一批资源怎么排队。浏览器对同一域名的并发请求有上限（HTTP/1.1 约 6 个，HTTP/2 是多路复用但仍会挤占带宽），一次性发起几十个请求，结果是每个都变慢、首屏什么都看不到。合理的做法是限制并发数，让少量关键资源先完成。',
  '本页把 12 个资源画成方块：灰色等待、蓝色加载中、绿色完成，高度代表进度。拖动「并发数」，能直观看到限制并发时任务一格格推进；勾选「不限并发」全部同时启动，总耗时未必更短，但会瞬间占满带宽与解码线程，首屏体验更差。这就是多数地图引擎采用「并发 4~6 + 优先级队列」的原因。',
  '工程上的完整方案还要三样东西：优先级（地形/底图先于装饰物）、取消（`AbortController`，切场景时立即终止在途请求）、以及缓存（`THREE.Cache` 与 HTTP 缓存）。`LoadingManager` 负责汇总进度与生命周期，但它本身不做并发控制，调度逻辑仍要自己写或在加载器层封装。',
]

const blocks: CodeBlock[] = [
  {
    title: '并发受限的调度器',
    desc: '有空位才出队，而不是 Promise.all 一把梭',
    code: `async function runQueue(items, limit = 4) {
  const queue = [...items]
  const running = new Set()

  async function next() {
    if (!queue.length) return
    const item = queue.shift()
    const promise = load(item)
      .then((res) => onLoaded(res))
      .finally(() => {
        running.delete(promise)
        next()              // 空出位置立刻补位
      })
    running.add(promise)
  }

  // 先填满 limit 个槽位
  for (let i = 0; i < Math.min(limit, queue.length); i++) next()
  while (running.size) await Promise.race(running)
}`,
  },
  {
    title: '优先级 + 取消',
    desc: '切场景时不要等旧资源下载完',
    code: `const queue = [
  { url: 'terrain.glb', priority: 0 },
  { url: 'trees.glb',   priority: 2 },
]

// 优先级队列：数值越小越先
queue.sort((a, b) => a.priority - b.priority)

const controller = new AbortController()
fetch(url, { signal: controller.signal })
  .then((res) => res.arrayBuffer())

// 页面切换 / 场景销毁
controller.abort()`,
  },
  {
    title: 'LoadingManager 汇总进度',
    desc: '它管生命周期，不管并发',
    code: `const manager = new THREE.LoadingManager()

manager.onStart = (url, loaded, total) => {
  console.log('开始', url, loaded, total)
}
manager.onProgress = (url, loaded, total) => {
  progress.value = loaded / total
}
manager.onLoad = () => console.log('全部完成')
manager.onError = (url) => console.warn('失败', url)

const loader = new GLTFLoader(manager)
loader.load('models/scene.glb', onLoad, onProgress, onError)

// 失败重试要自己做，且要避免无限重试
// 资源可开启 three 内置缓存：THREE.Cache.enabled = true`,
  },
]

const notes: NoteItem[] = [
  {
    title: '并发数不是越大越好',
    body: '并发过高会挤占带宽，导致「每个都慢」；解码（GLTF 解析、KTX2 转码、纹理上传）还会占用主线程，40 个模型同时到齐会一次性卡住几百毫秒。地图类应用常取 4~6。',
  },
  {
    title: 'LoadingManager 不控并发',
    body: '它只是统计 onStart / onProgress / onLoad，你同时调 20 次 `loader.load` 就会真的发 20 个请求。并发控制必须在调用层实现（队列 + 槽位）。',
  },
  {
    title: '必须在切场景时取消',
    body: '未取消的请求不仅浪费带宽，回调回来时还可能往已销毁的场景里塞对象，造成「幽灵模型」与内存泄漏。用一个 `AbortController` 或「版本号」标记，回调里先判断场景是否还有效。',
  },
  {
    title: '进度条要按字节算',
    body: '`onProgress` 给的是「已完成文件数 / 总数」，文件大小差异很大时会跳变。真实进度需要读 `Content-Length` 与 `loaded` 字节数，或分阶段加权（几何 0.6、纹理 0.4）。',
  },
]
</script>

<template>
  <DemoPage
    hint="资源调度：12 个任务、并发上限可调。观察总耗时与峰值并发——不限并发并不等于更快。"
    :init="init"
  >
    <template #panel>
      <el-button size="small" type="primary" @click="start">开始加载</el-button>
      <el-button size="small" @click="reset">重置</el-button>
      <span class="label">并发 {{ limit }}</span>
      <el-slider v-model="limit" :min="1" :max="12" :step="1" :disabled="unlimited" class="!w-28" />
      <el-checkbox v-model="unlimited" size="small">不限并发</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ doneText }}</el-tag>
      <el-tag size="small" effect="plain">峰值 {{ peakText }}</el-tag>
      <el-tag size="small" effect="plain">{{ timeText }}</el-tag>
      <el-tag size="small" type="warning" effect="plain">{{ stateText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="资源调度"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="调度 = 排队 + 优先级 + 取消 + 缓存，四件事缺一不可。"
      />
    </template>
  </DemoPage>
</template>
