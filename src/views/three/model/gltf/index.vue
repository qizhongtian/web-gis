<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage, disposeObject, frameObject } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'
import { assetUrl } from '@/utils/publicUrl'

const preset = ref<'duck' | 'truck'>('duck')
const info = ref('加载中…')

let T: any = null
let stage: any = null
let model: any = null
let mixer: any = null
let animations: any[] = []
let alive = true

const PRESETS = {
  duck: { label: 'Duck.glb', url: () => assetUrl('data/models/Duck.glb') },
  truck: { label: 'CesiumMilkTruck.glb', url: () => assetUrl('data/models/CesiumMilkTruck.glb') },
}

function clearModel() {
  if (!model || !stage) return
  stage.scene.remove(model)
  disposeObject(model)
  model = null
  mixer = null
  animations = []
}

async function loadCurrent() {
  if (!stage) return
  const THREE = T
  const { GLTFLoader } = await loadThreeAddon('GLTFLoader')
  if (!alive || !stage) return

  clearModel()
  info.value = '加载中…'
  const current = PRESETS[preset.value]

  const loader = new GLTFLoader()
  loader.load(
    current.url(),
    (gltf: any) => {
      if (!alive || !stage) {
        disposeObject(gltf.scene)
        return
      }
      model = gltf.scene
      model.position.set(0, 0, 0)
      stage.scene.add(model)

      // 自动取景：模型单位从厘米到千米都有可能，不能写死相机位置
      frameObject(THREE, stage.camera, model, { offset: 1.7 })
      addLightRig()

      animations = gltf.animations ?? []
      if (animations.length) {
        mixer = new THREE.AnimationMixer(model)
        animations.forEach((clip: any) => mixer.clipAction(clip).play())
      }

      let meshes = 0
      let triangles = 0
      model.traverse((obj: any) => {
        if (!obj.isMesh) return
        meshes++
        const geo = obj.geometry
        triangles += (geo.index ? geo.index.count : geo.getAttribute('position')?.count ?? 0) / 3
      })
      info.value = `${current.label} · Mesh ${meshes} · 三角形 ${Math.round(triangles).toLocaleString()} · 动画 ${animations.length} 段`
    },
    (event: any) => {
      if (event.total) info.value = `加载 ${Math.round((event.loaded / event.total) * 100)}%`
    },
    (error: any) => {
      info.value = `加载失败：${error?.message || error}`
    },
  )
}

function addLightRig() {
  if (!stage) return
  const THREE = T
  if (stage.scene.userData.lit) return
  stage.scene.userData.lit = true
  stage.scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(4, 8, 5)
  stage.scene.add(key)
  const fill = new THREE.DirectionalLight(0x93c5fd, 0.9)
  fill.position.set(-5, 3, -4)
  stage.scene.add(fill)
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  alive = true
  stage = createStage(THREE, el, { position: [3, 2.4, 4], background: '#0a1a28' })
  stage.scene.add(new THREE.HemisphereLight(0xffffff, 0x0b1220, 1.5))
  addLightRig()

  stage.onFrame((dt: number) => {
    mixer?.update(dt)
    if (model) model.rotation.y += dt * 0.12
  })

  await loadCurrent()

  return () => {
    alive = false
    clearModel()
    stage.dispose()
    stage = null
    T = null
  }
}

function switchPreset(value: any) {
  preset.value = value
  void loadCurrent()
}

const intro: string[] = [
  'glTF 2.0 是「三维界的 JPEG」：JSON 描述场景图（nodes / meshes / materials / animations / skins），`.bin` 存顶点与索引，贴图单独成文件；`.glb` 把 JSON、BIN、贴图打进一个二进制容器，请求少、部署省心，线上优先用 GLB。材质是 PBR 的 metallic-roughness 模型，支持 Draco 几何压缩、KTX2 纹理、骨骼蒙皮与关键帧动画。',
  '加载用 `GLTFLoader`：3D 资源体积大，进度回调 `onProgress` 一定要接（否则用户只看到白屏），失败回调也要有兜底。加载回来的 `gltf.scene` 是一个 `Group`，`gltf.animations` 是 `AnimationClip` 数组，配合 `AnimationMixer` 才能播放。',
  '模型显示「黑」「看不见」大多不是加载失败：PBR 材质需要环境光照亮，纯金属（metalness = 1）在只有平行光的场景里几乎全黑，需要 `scene.environment`（HDR / PMREM）；尺寸不对是用包围盒取景前就写死了相机；朝向不对是源数据 Z-up 与 three 的 Y-up 不一致。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载 GLB / GLTF',
    desc: '进度回调 + 失败兜底；GLB 单文件最省心',
    code: `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load(
  '/data/models/Duck.glb',
  (gltf) => {
    scene.add(gltf.scene)
    console.log(gltf.animations)   // AnimationClip[]
  },
  (event) => {
    if (event.total) console.log((event.loaded / event.total) * 100 + '%')
  },
  (error) => console.error('模型加载失败', error),
)`,
  },
  {
    title: '播放内置动画',
    desc: '一个 Mixer 管理多个 clip；多模型时每个模型一个 Mixer',
    code: `const mixer = new THREE.AnimationMixer(gltf.scene)
gltf.animations.forEach((clip) => {
  const action = mixer.clipAction(clip)
  action.play()
  action.setLoop(THREE.LoopRepeat, Infinity)
})

// 每帧推进（dt 单位：秒）
function render(dt) {
  mixer.update(dt)
  renderer.render(scene, camera)
}`,
  },
  {
    title: '压缩资源与释放',
    desc: 'Draco / KTX2 需要额外解码器；卸载要遍历释放',
    code: `import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

const draco = new DRACOLoader().setDecoderPath('/draco/')
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer)

const loader = new GLTFLoader()
loader.setDRACOLoader(draco).setKTX2Loader(ktx2)

// 释放：几何体 / 材质 / 纹理都要 dispose
gltf.scene.traverse((obj) => {
  obj.geometry?.dispose()
  obj.material?.dispose()
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: '优先 GLB，避免外部依赖',
    body: '`.gltf` + 外部 `.bin` + 贴图会产生多次请求，任一 404 或跨域都会导致模型不显示；GLB 单文件最稳。若必须用外链，服务端要带 CORS 头。',
  },
  {
    title: '金属材质必须有环境贴图',
    body: '`metalness = 1` 的材质靠反射环境成像，没有 `scene.environment` 时几乎全黑。用 `RoomEnvironment` + `PMREMGenerator` 生成程序化环境，或加载 HDR。',
  },
  {
    title: '相机用包围盒取景',
    body: '模型单位可能是毫米、厘米、米，写死 `camera.position` 必然不合适。`new Box3().setFromObject(gltf.scene)` 求尺寸后按焦距算距离，同时更新 `near / far`。',
  },
  {
    title: 'Draco / KTX2 要配好解码器路径',
    body: '压缩模型必须 `setDecoderPath` 指向可访问的 wasm 目录，否则报 "No DRACOLoader instance provided"。解码在 Worker 里做，注意静态资源路径要跟 `BASE_URL` 一致。',
  },
]
</script>

<template>
  <DemoPage hint="GLTF / GLB：加载本地模型、进度反馈、自动取景、内置动画播放与资源释放。" :init="init">
    <template #panel>
      <el-radio-group :model-value="preset" size="small" @change="switchPreset">
        <el-radio-button value="duck">Duck.glb</el-radio-button>
        <el-radio-button value="truck">Milk Truck</el-radio-button>
      </el-radio-group>
      <el-tag size="small" type="info" effect="plain">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="glTF / GLB 模型"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="模型不显示按「请求 → 尺寸 → 材质光照 → 朝向」顺序排查。"
      />
    </template>
  </DemoPage>
</template>
