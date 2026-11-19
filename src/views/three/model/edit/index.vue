<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage, disposeObject, frameObject } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'
import { assetUrl } from '@/utils/publicUrl'

const scale = ref(1)
const rotateY = ref(0)
const wireframe = ref(false)
const color = ref('#38bdf8')
const info = ref('点击模型中的部件进行编辑')
const meshCount = ref(0)

let T: any = null
let stage: any = null
let modelRoot: any = null
let selected: any = null
let selectedBox: any = null
let raycaster: any = null
let pointer: any = null
let alive = true

function refreshCount() {
  let count = 0
  modelRoot?.traverse((obj: any) => {
    if (obj.isMesh) count++
  })
  meshCount.value = count
}

function selectObject(object: any) {
  if (!T || !stage) return
  selected = object

  if (selectedBox) {
    stage.scene.remove(selectedBox)
    selectedBox.dispose?.()
    selectedBox = null
  }
  if (!object) {
    info.value = '未选中（点击模型部件）'
    return
  }

  selectedBox = new T.BoxHelper(object, 0xf97316)
  stage.scene.add(selectedBox)

  const name = object.name || object.geometry?.type || 'Mesh'
  info.value = `选中 ${name} · 顶点 ${object.geometry?.getAttribute('position')?.count ?? 0}`
  scale.value = Number(object.scale.x.toFixed(2))
  rotateY.value = Math.round(T.MathUtils.radToDeg(object.rotation.y))
  wireframe.value = !!object.material?.wireframe
  if (object.material?.color) color.value = `#${object.material.color.getHexString()}`
}

function applyScale(value: any) {
  if (selected) selected.scale.setScalar(value)
}

function applyRotate(value: any) {
  if (selected) selected.rotation.y = T.MathUtils.degToRad(value)
}

function applyWireframe(value: any) {
  if (selected?.material) selected.material.wireframe = value
}

function applyColor(value: any) {
  if (selected?.material?.color) {
    selected.material.color.set(value)
    selected.material.needsUpdate = true
  }
}

function cloneSelected() {
  if (!selected || !T) return
  const copy = selected.clone()
  // 克隆默认共享材质，改色会连带原物体 → 材质也 clone 一份
  copy.material = selected.material.clone()
  copy.position.x += 0.8
  copy.name = `${selected.name || 'mesh'}_copy`
  selected.parent.add(copy)
  refreshCount()
  selectObject(copy)
}

function removeSelected() {
  if (!selected || !T) return
  const target = selected
  selectObject(null)
  target.removeFromParent()
  // 注意：几何体可能被克隆体共享，这里只释放材质，不释放几何体
  if (Array.isArray(target.material)) target.material.forEach((m: any) => m.dispose())
  else target.material?.dispose()
  refreshCount()
  info.value = '已删除（几何体可能被共享，未释放）'
}

async function loadModel() {
  if (!stage || !T || !alive) return
  const THREE = T
  if (modelRoot) {
    stage.scene.remove(modelRoot)
    disposeObject(modelRoot)
    modelRoot = null
  }
  selectObject(null)
  const { GLTFLoader } = await loadThreeAddon('GLTFLoader')
  if (!alive || !stage) return

  new GLTFLoader().load(assetUrl('data/models/Duck.glb'), (gltf: any) => {
    if (!alive || !stage) {
      disposeObject(gltf.scene)
      return
    }
    modelRoot = gltf.scene
    // 让每个 Mesh 有独立材质，才能单独改色 / 线框
    modelRoot.traverse((obj: any, index: number) => {
      if (!obj.isMesh) return
      obj.material = obj.material.clone()
      obj.name = obj.name || `mesh_${index}`
    })
    stage.scene.add(modelRoot)
    frameObject(THREE, stage.camera, modelRoot, { offset: 1.7 })
    refreshCount()
    info.value = 'Duck.glb 已加载，点击部件开始编辑'
  })
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  alive = true
  stage = createStage(THREE, el, { position: [3, 2.2, 4], background: '#0a1a28' })
  const { scene, camera, renderer } = stage
  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 2))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(4, 7, 5)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  const canvas = renderer.domElement
  const onDown = (event: PointerEvent) => {
    if (!modelRoot) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(modelRoot, true)[0]
    // 命中子 Mesh 就选它；命中 Group 则向上找最近的 Mesh
    let object: any = hit?.object ?? null
    if (object && !object.isMesh) object = object.parent
    selectObject(object)
  }

  canvas.addEventListener('pointerdown', onDown)

  await loadModel()

  return () => {
    alive = false
    canvas.removeEventListener('pointerdown', onDown)
    stage.dispose()
    stage = null
    modelRoot = null
    selected = null
    selectedBox = null
    raycaster = null
    pointer = null
    T = null
  }
}

const intro: string[] = [
  '「模型编辑」在 Web 端通常指三类操作：选中（射线拾取 + 高亮）、变换（改 `position / rotation / scale` 或直接改 `matrix`）、属性编辑（材质颜色、线框、显隐）。它们本质上都是改 `Object3D` 的属性，改完下一帧渲染自动生效，不需要重新加载模型。',
  '最关键的前提是「对象可独立修改」：glTF 内部经常多个 Mesh 共享同一材质实例，直接改 `material.color` 会把共享它的部件一起改掉。编辑前先 `material = material.clone()`，几何体则通常保持共享（省显存），所以删除对象时不要顺手 `geometry.dispose()`，否则克隆体和其它实例会一起崩。',
  '交互层面建议把「选中」与「变换」拆开：拾取只负责维护 `selected` 引用，工具栏改的是选中对象的属性。这样撤销 / 重做、属性面板、变换控件都能复用同一份状态；`TransformControls` 插件就是这套思路的可视化版本。',
]

const blocks: CodeBlock[] = [
  {
    title: '射线选中并高亮',
    desc: '命中子对象后标记选中，用 BoxHelper 画选框',
    code: `const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function pick(event) {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const hit = raycaster.intersectObject(modelRoot, true)[0]
  select(hit ? hit.object : null)
}

function select(object) {
  if (selectedBox) selectedBox.removeFromParent()
  selected = object
  if (!object) return
  selectedBox = new THREE.BoxHelper(object, 0xf97316)
  scene.add(selectedBox)
}`,
  },
  {
    title: '编辑材质与变换',
    desc: '编辑前 clone 材质，避免影响共享实例',
    code: `// 导入后：每个 Mesh 独立材质
modelRoot.traverse((obj) => {
  if (obj.isMesh) obj.material = obj.material.clone()
})

// 变换
selected.scale.setScalar(1.4)
selected.rotation.y = THREE.MathUtils.degToRad(45)
selected.position.y += 0.2

// 材质
selected.material.color.set('#f97316')
selected.material.wireframe = true
selected.material.needsUpdate = true`,
  },
  {
    title: '克隆与删除',
    desc: '克隆共享几何体、复制材质；删除只移除不释放共享资源',
    code: `const copy = selected.clone()          // 共享 geometry / material
copy.material = selected.material.clone()   // 材质独立
copy.position.x += 0.8
selected.parent.add(copy)

// 删除
target.removeFromParent()
target.material.dispose()              // 释放自己那份材质
// geometry 可能被共享，不要在这里 dispose`,
  },
]

const notes: NoteItem[] = [
  {
    title: '共享材质是「改一个全变」的根源',
    body: 'glTF 里同一材质的多个部件共用一个实例。编辑前统一 `material.clone()`；如果材质很多，按 `material.uuid` 建 Map 做「首次遇到才 clone」，避免无谓复制。',
  },
  {
    title: '删除时区分共享与独占',
    body: '克隆体共享几何体，删一个不能 `geometry.dispose()`；反过来，模型卸载（整棵树不要了）时又必须释放。用资源管理器按引用计数释放最稳。',
  },
  {
    title: 'BoxHelper 用完要清理',
    body: '每次选中都 new 一个 BoxHelper 会不断往场景里加线框对象。复用一个实例并调用 `setFromObject`，或移除旧的并 `dispose()` 其几何体。',
  },
  {
    title: '要拖拽手柄就用 TransformControls',
    body: '自己实现三轴拖拽很费劲，`three/examples/jsm/controls/TransformControls.js` 提供平移 / 旋转 / 缩放手柄，注意它和 OrbitControls 同时启用时要 `dragging-changed` 事件里互斥。',
  },
]
</script>

<template>
  <DemoPage hint="模型编辑：射线选中部件、包围盒高亮、变换与材质编辑、克隆 / 删除与资源释放。" :init="init">
    <template #panel>
      <span class="label">缩放 {{ scale.toFixed(2) }}</span>
      <el-slider v-model="scale" :min="0.3" :max="2.5" :step="0.05" class="!w-24" @input="applyScale" />
      <span class="label">旋转 {{ rotateY }}°</span>
      <el-slider v-model="rotateY" :min="-180" :max="180" class="!w-24" @input="applyRotate" />
      <el-checkbox v-model="wireframe" size="small" @change="applyWireframe">线框</el-checkbox>
      <el-color-picker v-model="color" size="small" @change="applyColor" />
      <el-button size="small" @click="cloneSelected">克隆</el-button>
      <el-button size="small" type="danger" plain @click="removeSelected">删除</el-button>
      <el-button size="small" @click="loadModel">重置</el-button>
      <el-tag size="small" type="info" effect="plain">Mesh {{ meshCount }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="模型编辑"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="编辑功能的两条底线：材质要 clone，删除别乱 dispose。"
      />
    </template>
  </DemoPage>
</template>
