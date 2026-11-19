<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const mode = ref<'persp' | 'ortho'>('persp')
const fov = ref(50)
const zoom = ref(1)
const clipInfo = ref('near 0.1 / far 500')

let stage: any = null
let persp: any = null
let ortho: any = null

function applyMode() {
  if (!stage) return
  stage.setCamera(mode.value === 'ortho' ? ortho : persp)
}

function applyFov(value: any) {
  if (!persp) return
  persp.fov = value
  persp.updateProjectionMatrix()
  clipInfo.value = `fov ${value}° · near ${persp.near} / far ${persp.far}`
}

function applyZoom(value: any) {
  if (!ortho) return
  ortho.zoom = value
  ortho.updateProjectionMatrix()
  clipInfo.value = `正交 zoom ${value.toFixed(1)}× · near ${ortho.near} / far ${ortho.far}`
}

function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { fov: fov.value, position: [6, 4, 9], background: '#0a1a28' })
  persp = stage.camera

  // 正交相机：没有透视收缩，工程制图 / 2.5D 地图视角常用
  const aspect = el.clientWidth / Math.max(1, el.clientHeight)
  const half = 3.4
  ortho = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 200)
  ortho.position.copy(persp.position)
  ortho.lookAt(0, 0, 0)

  stage.onResize((w: number, h: number) => {
    const a = w / Math.max(1, h)
    ortho.left = -half * a
    ortho.right = half * a
    ortho.top = half
    ortho.bottom = -half
    ortho.updateProjectionMatrix()
  })

  const { scene } = stage
  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const dir = new THREE.DirectionalLight(0xffffff, 2)
  dir.position.set(5, 8, 5)
  scene.add(dir)

  // 同一排小方块放在不同深度：透视相机近大远小，正交相机完全等大
  const material = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.3, roughness: 0.4 })
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), material)
    mesh.position.set((i - 2) * 1.6, 0, -i * 2.4)
    scene.add(mesh)
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x12314a, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.6
  scene.add(floor)

  stage.onFrame(() => {
    // 两组方块缓慢环绕，便于观察投影方式差异
    scene.rotation.y += 0.002
  })

  return () => {
    stage.dispose()
    stage = null
    persp = null
    ortho = null
  }
}

const intro: string[] = [
  '相机决定「从哪里、以什么投影方式看」。`PerspectiveCamera` 用视锥体投影，`fov`（垂直视场角，度）越大视野越广、畸变越强；`aspect` 必须等于画布宽高比，否则画面会被拉伸——容器尺寸一变就要重算 `aspect` 并调用 `updateProjectionMatrix()`。',
  '`OrthographicCamera` 用长方体投影，六个参数是 `left/right/top/bottom/near/far`，物体不会近大远小，适合工程视图、2.5D 城市底图、UI 型三维场景。它没有 `fov`，缩放靠 `zoom`（改的是投影矩阵里的缩放系数，不是相机位置）。',
  '`near` / `far` 不是「看得多远」的开关，而是深度缓冲的精度分配：近平面过小、远平面过大时，远处相邻面会因深度值精度不足而闪烁（z-fighting）。经验做法是让 `far / near` 比值尽量小（比如 0.1 / 500 而不是 0.001 / 100000），超大场景再用 `logarithmicDepthBuffer`。',
]

const blocks: CodeBlock[] = [
  {
    title: '透视相机与容器自适应',
    desc: 'aspect 必须跟画布一致，尺寸变化时更新投影矩阵',
    code: `const camera = new THREE.PerspectiveCamera(
  50,                                    // fov：垂直视场角
  el.clientWidth / el.clientHeight,      // aspect：务必用真实宽高
  0.1,                                   // near
  500,                                   // far
)
camera.position.set(6, 4, 9)
camera.lookAt(0, 0, 0)

// 容器尺寸变化（面板折叠、窗口缩放）时
const onResize = () => {
  camera.aspect = el.clientWidth / el.clientHeight
  camera.updateProjectionMatrix()   // 漏了这句画面会被拉伸
}
new ResizeObserver(onResize).observe(el)`,
  },
  {
    title: '切换正交相机',
    desc: '正交相机靠 left/right/top/bottom + zoom 控制视野',
    code: `const aspect = w / h
const half = 3.4
const ortho = new THREE.OrthographicCamera(
  -half * aspect, half * aspect, half, -half, 0.1, 200,
)
ortho.position.copy(camera.position)
ortho.lookAt(0, 0, 0)

// 缩放用 zoom，改完同样要 updateProjectionMatrix
ortho.zoom = 1.6
ortho.updateProjectionMatrix()

renderer.render(scene, ortho)`,
  },
  {
    title: '按包围盒自动取景',
    desc: '模型尺寸不可控，用 Box3 算距离比写死 position 稳',
    code: `const box = new THREE.Box3().setFromObject(model)
const size = box.getSize(new THREE.Vector3())
const center = box.getCenter(new THREE.Vector3())
const maxDim = Math.max(size.x, size.y, size.z)

const fitHeight = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))
const fitWidth = fitHeight / camera.aspect
const distance = Math.max(fitHeight, fitWidth) * 1.9

camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1.2).normalize().multiplyScalar(distance))
camera.near = distance / 500
camera.far = distance * 200
camera.updateProjectionMatrix()
camera.lookAt(center)`,
  },
]

const notes: NoteItem[] = [
  {
    title: '改了相机参数必须 updateProjectionMatrix',
    body: '`fov / aspect / near / far / zoom / left...` 这些属性只是存值，投影矩阵是缓存。改完不调用 `updateProjectionMatrix()`，画面不会有任何变化。',
  },
  {
    title: 'near 别设 0，far 别设太大',
    body: '深度缓冲精度按 1/z 分配，`near = 0.001` 会让远处 z-fighting 严重。常规场景 `near 0.1`、`far` 按场景尺度给；超大视距用 `logarithmicDepthBuffer: true` 并接受一点性能开销。',
  },
  {
    title: 'lookAt 与 OrbitControls 会互相覆盖',
    body: '`lookAt` 只改朝向，`OrbitControls.update()` 每帧按 target 重算朝向。同时用两者时以 controls 为准，需要飞行定位就改 `controls.target` 再 `update()`。',
  },
  {
    title: '正交相机的远近裁剪同样存在',
    body: '正交相机也有 `near/far`，模型在 near 之前或 far 之后同样被裁掉；把正交相机放得太近时，物体「凭空消失」通常是这个原因。',
  },
]
</script>

<template>
  <DemoPage hint="相机 Camera：透视 / 正交切换，fov、zoom、near/far 与容器自适应的正确做法。" :init="init">
    <template #panel>
      <el-radio-group v-model="mode" size="small" @change="applyMode">
        <el-radio-button value="persp">透视</el-radio-button>
        <el-radio-button value="ortho">正交</el-radio-button>
      </el-radio-group>

      <template v-if="mode === 'persp'">
        <span class="label">fov {{ fov }}°</span>
        <el-slider v-model="fov" :min="15" :max="110" class="!w-32" @input="applyFov" />
      </template>

      <template v-else>
        <span class="label">zoom {{ zoom.toFixed(1) }}×</span>
        <el-slider v-model="zoom" :min="0.4" :max="3" :step="0.1" class="!w-32" @input="applyZoom" />
      </template>

      <el-tag size="small" type="info" effect="plain">{{ clipInfo }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="相机 Camera"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="相机相关 bug 九成来自 aspect 未更新、near/far 精度、以及和 OrbitControls 抢朝向。"
      />
    </template>
  </DemoPage>
</template>
