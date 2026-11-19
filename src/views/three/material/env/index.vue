<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createRoomEnvironment, createStage } from '@/utils/gis/threeStage'

const intensity = ref(1)
const envOn = ref(true)
const asBackground = ref(false)
const roughness = ref(0.15)

let T: any = null
let stage: any = null
let envTexture: any = null
let spheres: any[] = []

function applyIntensity(value: any) {
  if (stage) stage.scene.environmentIntensity = value
}

function applyEnv() {
  if (!stage || !T) return
  stage.scene.environment = envOn.value ? envTexture : null
  stage.scene.background = envOn.value && asBackground.value ? envTexture : new T.Color('#070f18')
}

function applyRoughness(value: any) {
  // 只改第一个球，对比镜面与磨砂对环境的响应
  if (spheres[0]) spheres[0].material.roughness = value
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.2, 7.4], background: '#070f18' })
  const { scene, renderer } = stage
  stage.camera.lookAt(0, 1.1, 0)

  const key = new THREE.DirectionalLight(0xffffff, envOn.value ? 0.5 : 2.4)
  key.position.set(5, 8, 6)
  scene.add(key)

  envTexture = await createRoomEnvironment(THREE, renderer, scene, intensity.value)
  if (!stage) return
  scene.environment = envOn.value ? envTexture : null
  scene.environmentIntensity = intensity.value

  const geometry = new THREE.SphereGeometry(1.15, 96, 64)
  const configs = [
    { x: -2.1, metalness: 1, roughness: roughness.value, color: 0xf1f5f9 },
    { x: 0, metalness: 1, roughness: 0.45, color: 0xf97316 },
    { x: 2.1, metalness: 0.1, roughness: 0.25, color: 0x3b82f6 },
  ]
  configs.forEach((cfg) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: cfg.color,
        metalness: cfg.metalness,
        roughness: cfg.roughness,
      }),
    )
    mesh.position.set(cfg.x, 1.4, 0)
    scene.add(mesh)
    spheres.push(mesh)
  })

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.6, metalness: 0.4 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  stage.onFrame((dt: number) => {
    spheres.forEach((mesh, i) => {
      mesh.rotation.y += dt * (0.2 + i * 0.1)
    })
  })

  return () => {
    stage.dispose()
    stage = null
    envTexture = null
    spheres = []
    T = null
  }
}

const intro: string[] = [
  '环境贴图（environment map）是一张「周围世界」的立方体贴图，被 PBR 材质用来计算反射与间接光。`scene.environment` 会把同一张环境自动应用到所有标准材质（相当于默认 `envMap`），`scene.background` 只决定「背景画什么」——两者可以一致也可以不一致：做产品展示时常把环境当光源，但背景用纯色或渐变，避免画面太花。',
  '可直接使用的前提是「预滤波」：不同粗糙度需要不同模糊程度的反射，`PMREMGenerator` 会把 HDR 生成为带 mip 链的 PMREM 纹理，让粗糙表面采样模糊层。直接把 `EquirectangularReflectionMapping` 的 HDR 赋给 `scene.environment`，three 内部也会做一次转换，但显式 PMREM 能复用、可控性更好。',
  '环境贴图是「全局平均」的：同一个场景里，室内和室外的物体反射的是同一张图，不会因位置不同而变化。需要局部真实反射时，要在关键位置放 `CubeCamera` 做反射探针，或使用屏幕空间反射（SSR / SSRPass）。',
]

const blocks: CodeBlock[] = [
  {
    title: 'HDR 环境贴图',
    desc: '先 PMREM 预滤波，再赋给 scene.environment',
    code: `import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const pmrem = new THREE.PMREMGenerator(renderer)
const hdr = await new RGBELoader()
  .setDataType(THREE.HalfFloatType)
  .loadAsync('/hdr/studio.hdr')

const envMap = pmrem.fromEquirectangular(hdr).texture
scene.environment = envMap
scene.background = envMap          // 可选：同时作为背景
scene.environmentIntensity = 1     // r163+ 全局强度

hdr.dispose()
pmrem.dispose()`,
  },
  {
    title: '程序化环境（RoomEnvironment）',
    desc: '没有 HDR 资源时的兜底，光位均匀、适合展示',
    code: `import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const pmrem = new THREE.PMREMGenerator(renderer)
const room = new RoomEnvironment()
scene.environment = pmrem.fromScene(room, 0.04).texture
pmrem.dispose()`,
  },
  {
    title: '按材质控制反射',
    desc: '单个材质可覆盖 envMap / envMapIntensity',
    code: `const chrome = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1,
  roughness: 0.05,
  envMap: scene.environment,   // 也可单独指定
  envMapIntensity: 1.4,
})

// 背景与照明分离
scene.background = new THREE.Color('#070f18')
scene.environment = envMap`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'background 不是光源',
    body: '`scene.background = hdrTexture` 只是把图画在背景上，不会照亮物体；照明靠 `scene.environment`。只设 background 时金属依然发黑，这是最常见的误解。',
  },
  {
    title: '环境强度别当调亮工具',
    body: '把 `environmentIntensity` 拉很大可以「提亮」，但反射会过曝成白板。正确顺序是调 HDR 本身、曝光、灯光强度，环境强度保持在 1 附近。',
  },
  {
    title: 'PMREM 有内存与生成成本',
    body: '一张 4K HDR 生成的 PMREM 纹理约占几十 MB 显存。多场景共享同一张环境即可；切换室内外时再替换，并在替换后释放旧纹理。',
  },
  {
    title: '反射不对先查朝向',
    body: '环境贴图错位会让「亮面」出现在奇怪的方向。HDR 的等距柱状投影需要 `EquirectangularReflectionMapping`（用 PMREM 时自动处理），朝向可用 `scene.environmentRotation` 微调。',
  },
]
</script>

<template>
  <DemoPage hint="环境贴图：RoomEnvironment + PMREM 提供反射，环境强度 / 背景 / 粗糙度对比。" :init="init">
    <template #panel>
      <el-checkbox v-model="envOn" size="small" @change="applyEnv">环境贴图</el-checkbox>
      <el-checkbox v-model="asBackground" size="small" @change="applyEnv">环境作为背景</el-checkbox>

      <span class="label">环境强度 {{ intensity.toFixed(1) }}</span>
      <el-slider v-model="intensity" :min="0" :max="2" :step="0.1" class="!w-28" @input="applyIntensity" />

      <span class="label">左侧球粗糙度 {{ roughness.toFixed(2) }}</span>
      <el-slider v-model="roughness" :min="0.02" :max="1" :step="0.01" class="!w-28" @input="applyRoughness" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="环境贴图"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="记住分工：environment 负责照亮与反射，background 只负责画面背景。"
      />
    </template>
  </DemoPage>
</template>
