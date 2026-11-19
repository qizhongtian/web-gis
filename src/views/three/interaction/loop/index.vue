<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const speed = ref(1)
const paused = ref(false)
const fixedStep = ref(false)
const fpsText = ref('-- FPS')
const dtText = ref('dt -- ms')
const stateText = ref('运行中')

let stage: any = null
let orbiters: any[] = []
let stopped = false
let simTime = 0
let accumulator = 0
let ema = 1 / 60

const FIXED = 1 / 60

function applyPause() {
  paused.value = paused.value
  stateText.value = paused.value ? '已暂停（手动）' : '运行中'
}

function applyFixed() {
  accumulator = 0
}

function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { position: [0, 4.5, 9], background: '#0a1a28' })
  const { scene, camera } = stage
  camera.lookAt(0, 0.6, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 8, 5)
  scene.add(key)

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.8, 1),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3, flatShading: true }),
  )
  core.position.y = 0.6
  scene.add(core)

  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Object3D()
    pivot.rotation.y = (i / 5) * Math.PI * 2
    scene.add(pivot)

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 16),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.55 + i * 0.04, 0.7, 0.58),
        metalness: 0.3,
        roughness: 0.35,
      }),
    )
    mesh.position.set(2.2, 0.6 + (i - 2) * 0.35, 0)
    pivot.add(mesh)
    orbiters.push({ pivot, mesh, phase: i * 0.9 })
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  scene.add(new THREE.GridHelper(16, 16, 0x24506e, 0x16324a))

  stage.onFrame((dt: number) => {
    const safeDt = Math.min(dt, 0.1) // 切后台回来 dt 可能很大，必须封顶
    ema = ema * 0.9 + safeDt * 0.1
    if (!stopped) {
      fpsText.value = `${Math.round(1 / ema)} FPS`
      dtText.value = `dt ${(safeDt * 1000).toFixed(1)} ms`
    }

    if (paused.value) return
    if (typeof document !== 'undefined' && document.hidden) {
      stateText.value = '页面隐藏，渲染暂停'
      return
    }
    stateText.value = '运行中'

    if (fixedStep.value) {
      // 固定步长：物理/动画逻辑按 60Hz 推进，与显示器刷新率解耦
      accumulator += safeDt * speed.value
      let guard = 0
      while (accumulator >= FIXED && guard++ < 8) {
        simTime += FIXED
        accumulator -= FIXED
      }
    } else {
      simTime += safeDt * speed.value
    }

    orbiters.forEach(({ pivot, mesh, phase }) => {
      pivot.rotation.y = simTime * 0.6 + phase
      mesh.position.y = 0.6 + Math.sin(simTime * 1.6 + phase) * 0.9
    })
  })

  return () => {
    stopped = true
    stage.dispose()
    stage = null
    orbiters = []
  }
}

onBeforeUnmount(() => {
  stopped = true
})

const intro: string[] = [
  '渲染循环是「每帧做一次：更新状态 → 渲染」。`requestAnimationFrame` 由浏览器在每次重绘前调用，页面隐藏时自动停止，是最稳妥的方式；`renderer.setAnimationLoop(fn)` 只是它的包装，额外价值是 WebXR 会话下会自动切换到 XR 的帧循环，做 AR/VR 时必须用它。',
  '动画的速度必须乘 `deltaTime`（秒），而不是「每帧加固定值」：60Hz 屏每帧 16.7ms、120Hz 屏每帧 8.3ms，写死 `position.x += 0.01` 会让高刷屏上的动画快一倍。`THREE.Clock.getDelta()` 就是干这个的；但 `delta` 要封顶（比如 `Math.min(dt, 0.1)`），否则切回标签页的那一帧 dt 可能是几秒，物体直接「穿越」。',
  '需要稳定积分的逻辑（物理、路径推进、回放）用固定步长：把真实 dt 累加到 accumulator，每次消耗固定 1/60 秒推进模拟，残余留到下一帧。这样帧率波动不影响运动轨迹，也顺带解决了「低帧率下弹簧爆炸」的问题。',
]

const blocks: CodeBlock[] = [
  {
    title: 'requestAnimationFrame + Clock',
    desc: '速度乘 dt，帧率无关；dt 必须封顶',
    code: `const clock = new THREE.Clock()
let raf = 0

function loop() {
  raf = requestAnimationFrame(loop)
  const dt = Math.min(clock.getDelta(), 0.1)   // 切后台回来会有大 dt
  mesh.rotation.y += dt * 0.8                  // 弧度/秒
  renderer.render(scene, camera)
}
loop()

// 卸载
cancelAnimationFrame(raf)`,
  },
  {
    title: 'setAnimationLoop（XR 兼容）',
    desc: '内部就是 rAF，但 WebXR 下会自动切换帧循环',
    code: `renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})

// 停止
renderer.setAnimationLoop(null)`,
  },
  {
    title: '固定步长累加器',
    desc: '模拟逻辑按固定 1/60s 推进，渲染仍按实际帧率',
    code: `const FIXED = 1 / 60
let accumulator = 0

function update(dt) {
  accumulator += Math.min(dt, 0.1)
  let guard = 0
  while (accumulator >= FIXED && guard++ < 8) {
    stepSimulation(FIXED)      // 物理 / 路径推进
    accumulator -= FIXED
  }
  interpolateForRender(accumulator / FIXED)  // 可选：渲染插值
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '不要在循环里创建对象',
    body: '每帧 `new Vector3()` / `new Color()` / 新数组会产生大量短命对象，触发频繁 GC，表现为「固定间隔卡一下」。临时量提到模块作用域复用。',
  },
  {
    title: '页面隐藏要主动降频',
    body: '`requestAnimationFrame` 在后台标签页会被浏览器节流，但 WebGL 上下文仍占内存。更稳的做法是在 `visibilitychange` 里暂停渲染循环，回来再恢复并重置 Clock。',
  },
  {
    title: '多个循环会重复渲染',
    body: '同时存在 `requestAnimationFrame` 和 `setAnimationLoop`、或组件重复挂载时会出现两套循环，帧率骤降且控制台里 `renderer.info.render.frame` 增长异常。确保一个 stage 只有一个循环。',
  },
  {
    title: '卸载前先停循环再 dispose',
    body: '先 `cancelAnimationFrame` / `setAnimationLoop(null)`，再释放几何体与渲染器；否则正在执行的那一帧可能访问已销毁的对象，报 "Cannot read properties of null"。',
  },
]
</script>

<template>
  <DemoPage hint="动画循环：dt 驱动的帧率无关运动、固定步长累加器、页面隐藏暂停与 FPS 统计。" :init="init">
    <template #panel>
      <el-button size="small" :type="paused ? 'primary' : 'default'" @click="paused = !paused; applyPause()">
        {{ paused ? '继续' : '暂停' }}
      </el-button>

      <el-checkbox v-model="fixedStep" size="small" @change="applyFixed">固定步长 60Hz</el-checkbox>

      <span class="label">速度 {{ speed.toFixed(1) }}×</span>
      <el-slider v-model="speed" :min="0.1" :max="3" :step="0.1" class="!w-28" />

      <el-tag size="small" type="success" effect="plain">{{ fpsText }}</el-tag>
      <el-tag size="small" type="info" effect="plain">{{ dtText }}</el-tag>
      <el-tag size="small" effect="plain">{{ stateText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="动画循环"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="循环相关问题的关键词：dt 封顶、后后台暂停、只能有一个循环、先停再销毁。"
      />
    </template>
  </DemoPage>
</template>
