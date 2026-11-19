<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const damping = ref(true)
const autoRotate = ref(false)
const pan = ref(true)
const limits = ref(true)

let stage: any = null
let controls: any = null

function applyDamping(value: any) {
  if (controls) controls.enableDamping = value
}

function applyAutoRotate(value: any) {
  if (controls) {
    controls.autoRotate = value
    controls.autoRotateSpeed = 1.2
  }
}

function applyPan(value: any) {
  if (controls) controls.enablePan = value
}

function applyLimits(value: any) {
  if (!controls) return
  controls.minDistance = value ? 6 : 0.5
  controls.maxDistance = value ? 22 : 200
  controls.maxPolarAngle = value ? Math.PI / 2 - 0.05 : Math.PI
  controls.minPolarAngle = value ? 0.15 : 0
}

async function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { position: [9, 6, 12], background: '#0a1a28' })
  const { scene, camera } = stage

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, stage.renderer.domElement)
  controls.target.set(0, 1.2, 0)
  controls.enableDamping = damping.value
  controls.dampingFactor = 0.08
  controls.autoRotate = autoRotate.value
  controls.autoRotateSpeed = 1.2
  controls.enablePan = pan.value
  controls.screenSpacePanning = false // 平移沿地面走，符合三维场景习惯
  controls.minDistance = 6
  controls.maxDistance = 22
  controls.maxPolarAngle = Math.PI / 2 - 0.05 // 不允许钻到地面以下
  controls.update()

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(6, 10, 6)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f2b40, roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new THREE.GridHelper(24, 24, 0x24506e, 0x16324a)
  grid.position.y = 0.01
  scene.add(grid)

  const palette = [0x22d3ee, 0x3b82f6, 0x818cf8]
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2
    const height = 1.6 + (i % 3) * 1.1
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, height, 1.2),
      new THREE.MeshStandardMaterial({
        color: palette[i % 3],
        metalness: 0.45,
        roughness: 0.3,
      }),
    )
    mesh.position.set(Math.cos(angle) * 4.2, height / 2, Math.sin(angle) * 4.2)
    mesh.rotation.y = -angle
    scene.add(mesh)
  }

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 48),
    new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide }),
  )
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.02
  scene.add(marker)

  stage.onFrame(() => {
    // enableDamping / autoRotate 都依赖每帧 update()
    controls.update()
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
  }
}

const intro: string[] = [
  '`OrbitControls` 是 three 官方最常用的轨道控制器：左键拖拽绕 `target` 旋转、滚轮缩放、右键（或双指）平移。它接管的是 DOM 元素上的 `pointerdown / wheel / contextmenu` 事件，所以构造时传哪个元素很关键——传 `renderer.domElement` 则只响应画布，传外层容器则画布上的浮层也会触发。',
  '手感主要由三个参数决定：`enableDamping` + `dampingFactor`（惯性，必须每帧 `update()` 才生效）、`zoomSpeed / rotateSpeed`（灵敏度）、以及 `minDistance / maxDistance / minPolarAngle / maxPolarAngle`（边界约束）。约束不是可有可无的装饰：限制 `maxPolarAngle` 能防止相机钻到地面以下看到模型的「背面空洞」。',
  '和业务交互共存时要划清地盘：控制器会 `preventDefault` 掉拖拽与滚轮，自定义的点击拾取最好用 `pointerup` 且判断「按下到抬起位移很小」才算点击（详见「鼠标事件」页）；缩放与页面滚动冲突时，可以在 `wheel` 里判断是否需要 `stopPropagation`。',
]

const blocks: CodeBlock[] = [
  {
    title: '创建控制器',
    desc: 'domElement 决定事件作用范围，target 是旋转中心',
    code: `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.2, 0)   // 绕这个点转，不是绕原点
controls.enableDamping = true    // 惯性
controls.dampingFactor = 0.08
controls.screenSpacePanning = false  // 平移贴着地面
controls.update()`,
  },
  {
    title: '边界约束与手感',
    desc: '限制距离与俯仰角，防止穿地 / 拉太远',
    code: `controls.minDistance = 6
controls.maxDistance = 22
controls.minPolarAngle = 0.15
controls.maxPolarAngle = Math.PI / 2 - 0.05   // 不许到地平线以下
controls.zoomSpeed = 0.8
controls.rotateSpeed = 0.7
controls.autoRotate = true
controls.autoRotateSpeed = 1.2`,
  },
  {
    title: '相机飞行动画与释放',
    desc: '用 tween 思路逐帧逼近 target 与 position；页面卸载必须 dispose',
    code: `// 简单飞行：每帧朝目标插值（不要用 lerp 位移相机 + lookAt 混用）
const goal = new THREE.Vector3(12, 8, 16)
function render() {
  camera.position.lerp(goal, 0.08)
  controls.target.lerp(focusPoint, 0.08)
  controls.update()
}

// 组件卸载 / 切页时
controls.dispose()
renderer.dispose()`,
  },
]

const notes: NoteItem[] = [
  {
    title: '开了 damping 必须每帧 update',
    body: '`enableDamping` 靠 `update()` 里的衰减实现。若只在交互事件里调用，松手后不会滑行；反之若把 `update()` 放进 `requestAnimationFrame` 却忘了暂停后台，也会持续耗电。',
  },
  {
    title: '控制器会抢走画布事件',
    body: '它监听 `pointerdown / pointermove / wheel` 并 `preventDefault`。自己的拾取逻辑要用 `pointerup` + 位移阈值判断点击，否则「拖拽旋转」会被误判成「点击选中」。',
  },
  {
    title: '滚轮缩放会吃掉页面滚动',
    body: '画布全屏展示时通常希望如此；嵌在长页面里则应在 `wheel` 事件上判断 `event.ctrlKey` 或先 `stopPropagation`，避免用户滚不动页面。',
  },
  {
    title: '卸载顺序：先 controls 后 renderer',
    body: '`controls.dispose()` 解绑事件，再 `renderer.dispose()` 释放上下文。反过来的话，残留的监听器会引用已销毁的 DOM，控制台报 null 错误。',
  },
]
</script>

<template>
  <DemoPage hint="OrbitControls：左键旋转 / 滚轮缩放 / 右键平移，惯性、自动旋转与边界约束。" :init="init">
    <template #panel>
      <el-checkbox v-model="damping" size="small" @change="applyDamping">惯性</el-checkbox>
      <el-checkbox v-model="autoRotate" size="small" @change="applyAutoRotate">自动旋转</el-checkbox>
      <el-checkbox v-model="pan" size="small" @change="applyPan">允许平移</el-checkbox>
      <el-checkbox v-model="limits" size="small" @change="applyLimits">距离 / 角度约束</el-checkbox>
      <span class="label">拖动旋转，滚轮缩放，右键平移</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="轨道控制器"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="控制器的坑集中在事件冲突、忘记 update、卸载不 dispose 三处。"
      />
    </template>
  </DemoPage>
</template>
