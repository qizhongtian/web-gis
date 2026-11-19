<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage, disposeObject, frameObject } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'
import { assetUrl } from '@/utils/publicUrl'

/** three 官方示例资源，允许跨域；网络不可用时自动回退到本地 GLB */
const DEFAULT_URL = 'https://threejs.org/examples/models/fbx/Samba%20Dancing.fbx'
const FALLBACK_URL = () => assetUrl('data/models/Duck.glb')

const url = ref(DEFAULT_URL)
const info = ref('正在加载…')
const busy = ref(false)

let T: any = null
let stage: any = null
let model: any = null
let mixer: any = null
let alive = true

function clearModel() {
  if (!model || !stage) return
  stage.scene.remove(model)
  disposeObject(model)
  model = null
  mixer = null
}

function attach(object: any, note: string) {
  if (!stage || !T) return
  model = object
  stage.scene.add(model)
  frameObject(T, stage.camera, model, { offset: 1.8 })

  const clips = object.animations ?? []
  if (clips.length) {
    mixer = new T.AnimationMixer(model)
    clips.forEach((clip: any) => mixer.clipAction(clip).play())
  }

  let meshes = 0
  let bones = 0
  let triangles = 0
  model.traverse((obj: any) => {
    if (obj.isMesh) {
      meshes++
      const geo = obj.geometry
      triangles += (geo.index ? geo.index.count : geo.getAttribute('position')?.count ?? 0) / 3
    }
    if (obj.isBone) bones++
  })
  info.value = `${note} · Mesh ${meshes} · 骨骼 ${bones} · 三角形 ${Math.round(triangles).toLocaleString()} · 动画 ${clips.length} 段`
}

async function loadFbx() {
  if (!stage || busy.value) return
  busy.value = true
  info.value = '正在加载…'
  try {
    const { FBXLoader } = await loadThreeAddon('FBXLoader')
    if (!alive) return
    const loader = new FBXLoader()
    loader.load(
      url.value,
      (fbx: any) => {
        if (!alive || !stage) {
          disposeObject(fbx)
          return
        }
        clearModel()
        attach(fbx, 'FBX')
        busy.value = false
      },
      undefined,
      async () => {
        // 失败兜底：用本地 GLB 验证「同一套 Mixer / 取景流程」
        info.value = 'FBX 加载失败，回退本地 GLB 演示'
        try {
          const { GLTFLoader } = await loadThreeAddon('GLTFLoader')
          new GLTFLoader().load(FALLBACK_URL(), (gltf: any) => {
            if (!alive || !stage) return
            clearModel()
            attach(gltf.scene, 'GLB 兜底')
            busy.value = false
          })
        } catch {
          busy.value = false
        }
      },
    )
  } catch (e: any) {
    info.value = `加载器初始化失败：${e?.message || e}`
    busy.value = false
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  alive = true
  stage = createStage(THREE, el, { position: [3, 2.2, 4], background: '#0a1a28' })
  stage.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.8))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(4, 7, 5)
  stage.scene.add(key)
  const fill = new THREE.DirectionalLight(0x93c5fd, 1)
  fill.position.set(-5, 3, -4)
  stage.scene.add(fill)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  stage.scene.add(ground)

  stage.onFrame((dt: number) => {
    mixer?.update(dt)
  })

  await loadFbx()

  return () => {
    alive = false
    busy.value = false
    clearModel()
    stage.dispose()
    stage = null
    T = null
  }
}

const intro: string[] = [
  'FBX 是 Autodesk 体系（Maya / 3ds Max / Revit 导出）最常见的交换格式，能带几何、材质、贴图、骨骼、蒙皮和动画，但体积极大（几 MB 到几十 MB 很常见），且二进制解析在主线程完成，加载时容易卡顿。three 用 `FBXLoader` 解析，得到的是 `Group`，骨骼动画放在 `animations` 里，处理方式和 glTF 完全一致。',
  'FBX 的坑主要在「导出设置」：缩放单位（cm vs m）、轴向（Z-up vs Y-up）、贴图是否内嵌、动画是否被打包成 NLA 片段。加载后物体巨大或躺平，基本都是这三项没对齐；three 官方建议的做法是「在 DCC 里统一导出成 glTF/GLB」，FBX 只作为存量资产的兼容入口。',
  '线上项目更推荐把 FBX 转成 GLB：体积能小一个数量级，还支持 Draco / KTX2 压缩和渐进加载。转换工具包括 Blender、`fbx2glTF`、CesiumGS 的 `gltf-pipeline`。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载 FBX 并播放动画',
    desc: 'FBXLoader 产出 Group，动画处理与 glTF 一致',
    code: `import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

const loader = new FBXLoader()
loader.load('/models/samba.fbx', (fbx) => {
  fbx.scale.setScalar(0.01)      // FBX 常以厘米为单位
  scene.add(fbx)

  if (fbx.animations.length) {
    const mixer = new THREE.AnimationMixer(fbx)
    mixer.clipAction(fbx.animations[0]).play()
  }
}, undefined, (err) => console.error(err))`,
  },
  {
    title: '统一取景与朝向修正',
    desc: '单位 / 轴向不确定时，用包围盒归一化而不是手调数字',
    code: `const box = new THREE.Box3().setFromObject(fbx)
const size = box.getSize(new THREE.Vector3())
const maxDim = Math.max(size.x, size.y, size.z)

// 把任意单位的模型缩到 2 个单位高
fbx.scale.multiplyScalar(2 / maxDim)

// Z-up 的 FBX 躺平时补一次旋转
// fbx.rotation.x = -Math.PI / 2

const center = box.getCenter(new THREE.Vector3())
fbx.position.sub(center.multiplyScalar(2 / maxDim))`,
  },
  {
    title: '释放与转换建议',
    desc: 'FBX 解析出的贴图也要逐个 dispose',
    code: `scene.remove(fbx)
fbx.traverse((obj) => {
  obj.geometry?.dispose()
  const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
  mats.forEach((m) => {
    Object.values(m).forEach((v) => v?.isTexture && v.dispose())
    m.dispose()
  })
})

// 生产环境建议离线转 GLB：
// fbx2glTF --binary --input samba.fbx --output samba.glb`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'FBX 体积大，务必给进度与占位',
    body: '几十 MB 的 FBX 在弱网下要等很久，主线程解析还会卡顿。至少要有 loading 态；更好的做法是转成 GLB + Draco，体积能降一个数量级。',
  },
  {
    title: '缩放单位 100 倍是常态',
    body: 'FBX 默认厘米，three 单位是米。模型看起来「顶到天花板」或「小得看不见」时先 `scale.setScalar(0.01)`；更稳的做法是用包围盒把最大边缩到目标尺寸。',
  },
  {
    title: '贴图路径可能失效',
    body: 'FBX 里贴图常以绝对路径或相对目录引用，浏览器拿不到。转换时选「Embed Media」，或手动把贴图放到同目录并改材质贴图。',
  },
  {
    title: '骨骼动画的 Mixer 别共用',
    body: '每个模型（每个 `gltf.scene` / `fbx` 根节点）要有自己的 `AnimationMixer`。共用会导致动画互相覆盖，表现为「只有最后一个模型在动」。',
  },
]
</script>

<template>
  <DemoPage hint="FBX：加载带骨骼动画的 FBX（官方示例），包围盒归一化取景，失败自动回退本地 GLB。" :init="init">
    <template #panel>
      <el-input v-model="url" size="small" class="!w-72" placeholder="FBX 地址" />
      <el-button size="small" type="primary" :loading="busy" @click="loadFbx">加载</el-button>
      <el-tag size="small" type="info" effect="plain" class="!max-w-96 !truncate">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="FBX 模型"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="FBX 的三大坑：单位、轴向、贴图路径。新项目建议直接转 GLB。"
      />
    </template>
  </DemoPage>
</template>
