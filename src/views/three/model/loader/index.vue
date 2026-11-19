<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage, disposeObject } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'
import { assetUrl } from '@/utils/publicUrl'

const percent = ref(0)
const loading = ref(false)
const logs = ref<string[]>([])

let T: any = null
let stage: any = null
let holder: any = null
let round = 0
let alive = true

const ASSETS = [
  { url: () => assetUrl('data/models/Duck.glb'), x: -1.4, label: 'Duck.glb' },
  { url: () => assetUrl('data/models/CesiumMilkTruck.glb'), x: 1.4, label: 'CesiumMilkTruck.glb' },
]

function log(text: string) {
  logs.value = [`${new Date().toLocaleTimeString()} ${text}`, ...logs.value].slice(0, 6)
}

async function loadAll() {
  if (!stage || !T || loading.value) return
  const THREE = T
  round++
  const currentRound = round
  loading.value = true
  percent.value = 0

  if (holder) {
    stage.scene.remove(holder)
    disposeObject(holder)
    holder = null
  }
  holder = new THREE.Group()
  stage.scene.add(holder)

  const { GLTFLoader } = await loadThreeAddon('GLTFLoader')
  if (!alive || currentRound !== round) return

  // LoadingManager 汇总本次所有请求的进度
  const manager = new THREE.LoadingManager()
  manager.onStart = (url: string) => log(`开始 ${url.split('/').pop()}`)
  manager.onProgress = (url: string, loaded: number, total: number) => {
    percent.value = Math.round((loaded / total) * 100)
    log(`进度 ${loaded}/${total} · ${url.split('/').pop()}`)
  }
  manager.onLoad = () => {
    loading.value = false
    percent.value = 100
    log('全部加载完成')
  }
  manager.onError = (url: string) => log(`失败 ${url.split('/').pop()}`)

  const loader = new GLTFLoader(manager)

  ASSETS.forEach((asset) => {
    loader.load(asset.url(), (gltf: any) => {
      if (!alive || !stage || !holder || currentRound !== round) {
        disposeObject(gltf.scene)
        return
      }
      const object = gltf.scene
      // 统一尺寸：不同来源的模型单位千差万别
      const box = new THREE.Box3().setFromObject(object)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const scale = 1.8 / maxDim
      object.scale.setScalar(scale)

      const scaledBox = new THREE.Box3().setFromObject(object)
      const center = scaledBox.getCenter(new THREE.Vector3())
      object.position.x += asset.x - center.x
      object.position.y += -scaledBox.min.y
      object.position.z += -center.z

      holder.add(object)
      log(`完成 ${asset.label}`)
    })
  })
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  alive = true
  stage = createStage(THREE, el, { position: [0, 2.6, 6], background: '#0a1a28' })
  stage.scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 2))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(4, 8, 5)
  stage.scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  stage.scene.add(ground)
  stage.scene.add(new THREE.GridHelper(14, 14, 0x24506e, 0x16324a))

  // 同一 URL 的重复请求走内存缓存，适合 Tab 来回切
  THREE.Cache.enabled = true

  stage.onFrame((dt: number) => {
    if (holder) holder.rotation.y += dt * 0.15
  })

  await loadAll()

  return () => {
    alive = false
    loading.value = false
    if (stage) {
      stage.dispose()
      stage = null
    }
    holder = null
    T = null
  }
}

const intro: string[] = [
  '`LoadingManager` 是 three 的「加载调度器」：所有通过 `new GLTFLoader(manager)` 传入它的加载器都会被登记，然后按「开始 / 进度 / 全部完成 / 出错」四个回调汇总。有多张模型、贴图、音频要一起加载时，用它做统一 loading 进度条最省事，比自己维护计数器可靠。',
  '进度回调里的 `loaded / total` 是「已完成请求数 / 总请求数」，不是字节数——想看字节进度要读 `ProgressEvent.loaded / total`（在单个 loader 的 onProgress 里）。`THREE.Cache.enabled = true` 会缓存已加载的响应，切 Tab 重进不需要重新下载，代价是内存占用上升，大资源建议手动管理缓存开关。',
  '工程上还差两件事才算「可用」：并发控制（同时发 20 个请求会抢带宽，浏览器同域并发上限约 6）与失败重试。资源多的项目通常写一个简单的调度队列：限制并发 2~4、失败退避重试、按优先级先加载「首屏可见」的模型。',
]

const blocks: CodeBlock[] = [
  {
    title: 'LoadingManager 统一进度',
    desc: 'onProgress 的单位是「请求数」，不是字节',
    code: `const manager = new THREE.LoadingManager()
manager.onStart = (url, loaded, total) => console.log('开始', url)
manager.onProgress = (url, loaded, total) => {
  progress.value = Math.round((loaded / total) * 100)
}
manager.onLoad = () => console.log('全部完成')
manager.onError = (url) => console.error('失败', url)

const gltfLoader = new GLTFLoader(manager)
const textureLoader = new THREE.TextureLoader(manager)

gltfLoader.load('/models/a.glb', (gltf) => scene.add(gltf.scene))
textureLoader.load('/textures/ground.jpg', (tex) => { /* ... */ })`,
  },
  {
    title: '归一化摆放（不同来源的模型）',
    desc: '按包围盒缩放 + 落地，避免手工调 scale / position',
    code: `function normalize(object, targetSize = 1.8) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  object.scale.multiplyScalar(targetSize / maxDim)

  const scaled = new THREE.Box3().setFromObject(object)
  const center = scaled.getCenter(new THREE.Vector3())
  object.position.x -= center.x
  object.position.z -= center.z
  object.position.y -= scaled.min.y          // 脚踩地面
  return object
}`,
  },
  {
    title: '并发控制与缓存',
    desc: '同一 URL 缓存避免重复下载，并发数控制在 2~4',
    code: `THREE.Cache.enabled = true          // 内存缓存，切 Tab 不重复下载

const queue = [...urls]
const CONCURRENCY = 3

async function run() {
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const url = queue.shift()
      try { await loadOne(url) } catch (e) { console.warn(url, e) }
    }
  })
  await Promise.all(workers)
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '进度条 0 → 100 突然跳完',
    body: '`manager.onProgress` 按请求数统计，若只有一个大文件，会从 0 直接到 100。要平滑进度请用单文件 `onProgress` 的 `event.loaded / event.total`（服务端需返回 `Content-Length`，gzip 后可能不准）。',
  },
  {
    title: 'Cache 是内存缓存',
    body: '开启后相同 URL 不再发请求，但资源常驻内存。模型多、切页频繁时建议按场景手动 `Cache.remove(url)` 或干脆不用，改用浏览器 HTTP 缓存（配好 `Cache-Control`）。',
  },
  {
    title: '失败要能重试',
    body: '网络抖动、CDN 502 都会让模型加载失败。失败的资源记录到队列，指数退避重试 2 次；超过次数再降级为低模 / 占位盒，别让用户对着空白画布。',
  },
  {
    title: '加载完成不等于渲染就绪',
    body: '首次渲染时 GPU 还要编译着色器，可能出现一帧长卡顿。大项目可以在 `onLoad` 后先 `renderer.compile(scene, camera)` 预编译，或加一个短暂的淡入过渡。',
  },
]
</script>

<template>
  <DemoPage hint="模型加载：LoadingManager 统一进度、多模型归一化摆放、缓存与并发控制。" :init="init">
    <template #panel>
      <el-button size="small" type="primary" :loading="loading" @click="loadAll">重新加载</el-button>
      <el-progress :percentage="percent" :stroke-width="10" class="!w-40" />
      <span class="label">{{ logs[0] ?? '等待加载' }}</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="模型加载与调度"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="LoadingManager 统计的是请求数；并发控制与重试要自己补。"
      />
    </template>
  </DemoPage>
</template>
