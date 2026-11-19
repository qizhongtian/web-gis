<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

interface Resource {
  mesh: any
  geometry: any
  material: any
  texture: any
}

const geoCount = ref(0)
const texCount = ref(0)
const objectCount = ref(0)
const leaked = ref(0)
const tip = ref('已创建 24 个卡片，观察 geometries / textures 的变化')

let T: any = null
let stage: any = null
let container: any = null
let resources: Resource[] = []
let created = 0
let disposed = 0
let statTimer = 0

const PER_BATCH = 24

function drawCard(canvas: HTMLCanvasElement, index: number) {
  const ctx = canvas.getContext('2d')!
  const hue = (index * 47) % 360
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, `hsl(${hue}, 70%, 42%)`)
  gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 75%, 22%)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 4
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 52px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index % 100).padStart(2, '0'), canvas.width / 2, canvas.height / 2)
}

function createBatch() {
  if (!stage || !T) return
  const THREE = T

  for (let i = 0; i < PER_BATCH; i++) {
    const index = created++

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    drawCard(canvas, index)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.PlaneGeometry(0.86, 0.86)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    const total = resources.length + 1
    const perRow = 8
    const row = Math.floor((total - 1) / perRow)
    const col = (total - 1) % perRow
    mesh.position.set((col - (perRow - 1) / 2) * 1.02, -(row * 1.02), 0)
    mesh.position.y += 1.2

    container.add(mesh)
    resources.push({ mesh, geometry, material, texture })
  }

  relayout()
  tip.value = `创建了 ${PER_BATCH} 个卡片（共计 ${created} 次创建）`
  updateInfo()
}

function relayout() {
  const perRow = 8
  resources.forEach((res, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    res.mesh.position.set((col - (perRow - 1) / 2) * 1.02, 1.2 - row * 1.02, 0)
  })
}

/** dispose = true 才真正通知 GPU 释放显存；false 只是从场景里摘掉 */
function release(dispose: boolean) {
  if (!stage) return
  const count = resources.length

  for (const res of resources) {
    container.remove(res.mesh)
    if (dispose) {
      // 顺序无所谓，但三者都要调
      res.texture.dispose()
      res.material.dispose()
      res.geometry.dispose()
      disposed++
    }
  }

  resources = []
  tip.value = dispose
    ? `已释放 ${count} 个资源：geometry / material / texture 全部 dispose`
    : `仅移除 ${count} 个对象，未 dispose：GPU 显存里的资源还在`
  updateInfo()
}

function updateInfo() {
  if (!stage) return
  const memory = stage.renderer.info.memory
  geoCount.value = memory.geometries
  texCount.value = memory.textures
  objectCount.value = resources.length
  leaked.value = created - disposed
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 0, 9], background: '#080d14' })
  const { scene, camera } = stage
  camera.lookAt(0, 0, 0)

  container = new THREE.Group()
  scene.add(container)

  createBatch()

  stage.onFrame((dt: number) => {
    container.rotation.y = Math.sin(stage.clock.elapsedTime * 0.35) * 0.35
    container.rotation.x = Math.sin(stage.clock.elapsedTime * 0.22) * 0.08
    container.children.forEach((child: any, i: number) => {
      child.position.z = Math.sin(stage.clock.elapsedTime * 1.2 + i * 0.4) * 0.12
    })

    statTimer += dt
    if (statTimer > 0.4) {
      statTimer = 0
      updateInfo()
    }
  })

  return () => {
    // 页面卸载时统一正确释放，避免示例本身泄漏
    for (const res of resources) {
      res.texture.dispose()
      res.material.dispose()
      res.geometry.dispose()
    }
    resources = []
    stage.dispose()
    stage = null
    container = null
    T = null
  }
}

const intro: string[] = [
  'JS 有垃圾回收，但 GPU 资源不在 JS 堆里。`geometry`、`material`、`texture` 在创建时会把数据上传到显存，GPU 并没有「引用计数自动回收」这回事，必须显式调用 `dispose()`。`scene.remove(mesh)` 只是把它从场景图里摘掉，不再绘制——显存里的 buffer 与贴图仍然占着。',
  '观察窗口是 `renderer.info.memory`：`geometries` 和 `textures` 是当前被 GPU 持有的数量。反复「创建 → 只移除 → 再创建」，这两个数字会一直涨，正是典型的内存泄漏。点击「正确释放」后数字会立刻回落，因为 `dispose()` 会释放对应的 GL buffer/texture 并从统计中扣掉。',
  '共享资源要格外小心：多个 Mesh 共用同一份 `geometry` 或 `material` 时，只应该 dispose 一次；反过来，如果一个材质被多处引用，提前 dispose 会让其它物体变黑或报纹理丢失。常见做法是给资源做一层引用计数，或者约定「谁创建谁释放、按资源而不按对象」来遍历。',
]

const blocks: CodeBlock[] = [
  {
    title: '正确的释放顺序',
    desc: '移除 + 三类资源各自 dispose',
    code: `function destroy(mesh) {
  scene.remove(mesh)

  mesh.geometry.dispose()

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) {
    // 贴图不会随材质自动释放，必须单独 dispose
    for (const key of Object.keys(material)) {
      const value = material[key]
      if (value && value.isTexture) value.dispose()
    }
    material.dispose()
  }

  // 渲染列表里可能还有引用，清一下更保险
  renderer.renderLists.dispose()
}`,
  },
  {
    title: '遍历释放整棵子树',
    desc: '页面切换时用得上',
    code: `function disposeObject(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose()

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
    materials.forEach((m) => {
      if (!m) return
      Object.values(m).forEach((v) => {
        if (v && v.isTexture) v.dispose()
      })
      m.dispose()
    })
  })
}

// 注意：共享资源会被 dispose 多次，本身是幂等的，
// 但会让其它还在使用它的物体失去贴图`,
  },
  {
    title: '用 renderer.info 自查',
    desc: '切页面 / 反复重建后对比数字',
    code: `renderer.info.memory.geometries   // 当前几何体数量
renderer.info.memory.textures     // 当前纹理数量

// 典型泄漏信号：数字只涨不跌
// 排查顺序：
// 1. 有没有 remove 但没 dispose
// 2. 贴图是否随材质一起释放
// 3. 动画循环里是否每帧 new 材质/几何
// 4. 事件监听是否移除（contextlost、resize）`,
  },
]

const notes: NoteItem[] = [
  {
    title: '贴图不会自动跟着材质释放',
    body: '`material.dispose()` 只释放材质自身的程序与 uniform，`material.map`、`normalMap`、`envMap` 都要自己 `dispose()`。这也是 `renderer.info.memory.textures` 只涨不跌的最常见原因。',
  },
  {
    title: 'dispose 之后不能再用',
    body: 'dispose 只是释放 GPU 侧资源，object 仍然存在。再次渲染同一个 geometry 时 three 会重新上传，通常能工作但会卡一下；而 dispose 过又被缓存引用的纹理可能出现黑图。释放后把引用一并置空最稳妥。',
  },
  {
    title: '每帧 new 对象是隐形炸弹',
    body: '在 `onFrame` 里 `new THREE.Color()` 问题不大，但 `new MeshStandardMaterial()`、`new CanvasTexture()` 会不断触发着色器编译与显存分配。把可复用对象提到循环外，是低成本高收益的习惯。',
  },
  {
    title: '页面卸载要主动清理',
    body: '单页应用切路由时，若只销毁 DOM，渲染器、canvas 上下文、纹理都还在。封装一个 `dispose()`：停止动画循环、移除事件、释放场景资源、`renderer.dispose()`、断开 canvas。',
  },
]
</script>

<template>
  <DemoPage
    hint="内存管理：反复创建卡片并「只移除不释放」，看 geometries / textures 只涨不跌；正确 dispose 后立刻回落。"
    :init="init"
  >
    <template #panel>
      <el-button size="small" type="primary" @click="createBatch">创建 24 个</el-button>
      <el-button size="small" type="success" @click="release(true)">正确释放</el-button>
      <el-button size="small" type="danger" @click="release(false)">只移除不释放</el-button>
      <el-tag size="small" effect="plain">geometry {{ geoCount }}</el-tag>
      <el-tag size="small" effect="plain">texture {{ texCount }}</el-tag>
      <el-tag size="small" effect="plain">对象 {{ objectCount }}</el-tag>
      <el-tag size="small" type="warning" effect="plain">未释放 {{ leaked }}</el-tag>
      <span class="text-xs text-slate-400">{{ tip }}</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="内存与资源释放"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="scene.remove 不等于释放，dispose 才是。"
      />
    </template>
  </DemoPage>
</template>
