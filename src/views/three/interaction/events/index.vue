<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const stateText = ref('待机')
const posText = ref('(0.00, 0.00)')
const clickCount = ref(0)

let stage: any = null
let raycaster: any = null
let pointer: any = null
let ground: any = null
let cube: any = null
let dragging = false
let downAt = { x: 0, y: 0 }
let moved = false
let holdShift = false

function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { position: [0, 7, 9], background: '#0a1a28' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 9, 5)
  scene.add(key)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  scene.add(new THREE.GridHelper(14, 14, 0x24506e, 0x16324a))

  cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.4, roughness: 0.3, emissive: 0x0e7490, emissiveIntensity: 0.4 }),
  )
  cube.position.y = 0.6
  scene.add(cube)

  const canvas = renderer.domElement
  canvas.style.touchAction = 'none' // 触屏下阻止浏览器接管手势

  function toPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  function hitCube() {
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObject(cube, false).length > 0
  }

  function groundPoint() {
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(ground, false)[0]
    return hit ? hit.point : null
  }

  const onDown = (event: PointerEvent) => {
    toPointer(event)
    if (!hitCube()) return
    dragging = true
    moved = false
    downAt = { x: event.clientX, y: event.clientY }
    holdShift = event.shiftKey
    canvas.setPointerCapture(event.pointerId) // 指针移出画布也能继续收到 move/up
    canvas.style.cursor = 'grabbing'
    stateText.value = '拖拽中（按住 Shift 上下移动）'
  }

  const onMove = (event: PointerEvent) => {
    toPointer(event)
    if (!dragging) {
      canvas.style.cursor = hitCube() ? 'grab' : 'default'
      return
    }
    if (Math.abs(event.clientX - downAt.x) + Math.abs(event.clientY - downAt.y) > 4) moved = true

    const point = groundPoint()
    if (point) {
      cube.position.x = THREE.MathUtils.clamp(point.x, -6, 6)
      cube.position.z = THREE.MathUtils.clamp(point.z, -6, 6)
      if (holdShift) cube.position.y = THREE.MathUtils.clamp(point.y + 0.6, 0.6, 6)
      posText.value = `(${cube.position.x.toFixed(2)}, ${cube.position.z.toFixed(2)})`
    }
  }

  const onUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    canvas.releasePointerCapture?.(event.pointerId)
    canvas.style.cursor = 'grab'
    if (!moved) {
      // 位移小于阈值才当点击，避免「转视角」被误判成「选中」
      clickCount.value++
      cube.material.color.setHex(clickCount.value % 2 ? 0xf97316 : 0x22d3ee)
      stateText.value = `点击第 ${clickCount.value} 次（未拖动）`
    } else {
      stateText.value = '拖拽结束'
    }
  }

  const onCancel = () => {
    dragging = false
    canvas.style.cursor = 'default'
    stateText.value = '指针事件被取消（pointercancel）'
  }

  const onLeave = () => {
    if (!dragging) canvas.style.cursor = 'default'
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault())

  stage.onFrame((dt: number) => {
    cube.rotation.y += dt * 0.6
  })

  return () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onCancel)
    canvas.removeEventListener('pointerleave', onLeave)
    stage.dispose()
    stage = null
    raycaster = null
    pointer = null
    ground = null
    cube = null
  }
}

const intro: string[] = [
  'three 本身不提供「物体上的点击事件」，只有渲染器和 DOM 事件。所有交互都要自己组合：DOM 上监听 `pointerdown / pointermove / pointerup` + 射线拾取判断「点到了谁」+ 状态机记录「现在在拖谁」。用 Pointer Events 而不是 mouse 事件，一套代码同时兼容鼠标、触屏和手写笔。',
  '点击与拖拽必须区分：按下时记录起点，抬起时若累计位移小于阈值（3~5px）才算点击。否则用户旋转视角、拖动画布之后总会误触发选中。拖拽期间用 `setPointerCapture(pointerId)` 把后续事件锁定到画布，指针移出画布甚至移出窗口也不会丢 `pointerup`，松手状态不会卡在「一直拖拽」。',
  '触屏还有一个必做项：在画布上设置 `touch-action: none`，否则浏览器会把滑动解释为页面滚动 / 双指缩放，`pointermove` 只发一两次就断掉。此外 `contextmenu` 要 `preventDefault`，不然右键拖拽松手会弹出菜单。',
]

const blocks: CodeBlock[] = [
  {
    title: '指针事件状态机',
    desc: 'down 记录起点 → move 判断位移 → up 决定是点击还是拖拽',
    code: `let dragging = false
let downAt = { x: 0, y: 0 }
let moved = false

canvas.style.touchAction = 'none'   // 触屏必需

canvas.addEventListener('pointerdown', (e) => {
  if (!hitCube(e)) return
  dragging = true
  moved = false
  downAt = { x: e.clientX, y: e.clientY }
  canvas.setPointerCapture(e.pointerId)   // 锁定后续事件
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  if (Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 4) moved = true
  moveCubeToGround(e)
})

canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return
  dragging = false
  canvas.releasePointerCapture(e.pointerId)
  if (!moved) onClick(cube)      // 真正的点击
})`,
  },
  {
    title: '拖到地面：射线与平面求交',
    desc: '把屏幕点打到地面平面，取命中点作为新位置',
    code: `const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function moveCubeToGround(event) {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const hit = raycaster.intersectObject(groundPlane, false)[0]
  if (!hit) return
  cube.position.x = THREE.MathUtils.clamp(hit.point.x, -6, 6)
  cube.position.z = THREE.MathUtils.clamp(hit.point.z, -6, 6)
}`,
  },
  {
    title: '清理监听器',
    desc: '把 handler 提成具名函数，卸载时逐个 removeEventListener',
    code: `// 匿名函数无法移除，必须用同一个引用
const onDown = (e) => { /* ... */ }

canvas.addEventListener('pointerdown', onDown)
onBeforeUnmount(() => {
  canvas.removeEventListener('pointerdown', onDown)
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: '必须处理 pointercancel',
    body: '来电、手势被系统接管、标签页切换都会触发 `pointercancel`。不监听它，拖拽状态会一直卡住，恢复后物体「粘」在指针上。',
  },
  {
    title: '不要用 click 做三维拾取',
    body: '`click` 只在同一元素上按下并抬起时触发，拖拽结束也可能触发；而且它不携带指针坐标的 NDC 语义。统一用 `pointerup` + 位移阈值判断更可靠。',
  },
  {
    title: 'pointer capture 与 canva 尺寸',
    body: '`setPointerCapture` 后事件全部路由到画布，`pointerleave` 不会触发，所以悬停高亮要自己在 `move` 里根据射线结果更新，不要依赖 `mouseenter`。',
  },
  {
    title: '两个交互系统要分工',
    body: '同时使用 `OrbitControls` 时，控制器和自定义拖拽都会响应 `pointerdown`。用「是否命中可拖拽物体」来决定是否 `stopPropagation`，或给控制器设 `controls.enabled = false` 临时让路。',
  },
]
</script>

<template>
  <DemoPage hint="鼠标事件：Pointer Events 拖拽立方体在地面移动，区分点击与拖拽，指针捕获。" :init="init">
    <template #panel>
      <el-tag size="small" type="info" effect="plain">{{ stateText }}</el-tag>
      <el-tag size="small" type="success" effect="plain">位置 {{ posText }}</el-tag>
      <el-tag size="small" type="warning" effect="plain">点击 {{ clickCount }} 次</el-tag>
      <span class="label">拖动方块移动；按住 Shift 可抬高</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="鼠标事件与拖拽"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="拖拽类 bug 的固定三件套：阈值判点击、pointercapture 锁事件、touch-action 防滚动。"
      />
    </template>
  </DemoPage>
</template>
