<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createRoomEnvironment, createStage } from '@/utils/gis/threeStage'

const metalness = ref(0.85)
const roughness = ref(0.25)
const emissive = ref(0.15)
const color = ref('#3b82f6')
const envIntensity = ref(1)

let T: any = null
let stage: any = null
let material: any = null
let mesh: any = null

function applyMaterial() {
  if (!material) return
  material.metalness = metalness.value
  material.roughness = roughness.value
  material.emissiveIntensity = emissive.value
  material.color.set(color.value)
  material.emissive.set(color.value)
}

function applyEnv(value: any) {
  if (stage) stage.scene.environmentIntensity = value
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 1.4, 5], background: '#070f18' })
  const { scene } = stage

  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(4, 7, 5)
  scene.add(key)

  // 金属材质没有环境反射会发黑，用程序化环境兜底
  await createRoomEnvironment(THREE, stage.renderer, scene, envIntensity.value)
  if (!stage) return

  material = new THREE.MeshStandardMaterial({
    color: color.value,
    emissive: color.value,
    emissiveIntensity: emissive.value,
    metalness: metalness.value,
    roughness: roughness.value,
  })

  mesh = new THREE.Mesh(new THREE.SphereGeometry(1.35, 96, 64), material)
  mesh.position.y = 1.6
  scene.add(mesh)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.7, metalness: 0.2 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  stage.onFrame((dt: number) => {
    mesh.rotation.y += dt * 0.25
  })

  return () => {
    stage.dispose()
    stage = null
    material = null
    mesh = null
    T = null
  }
}

const intro: string[] = [
  '`MeshStandardMaterial` 是基于 PBR（金属度-粗糙度）的标准材质，也是 three 里最常用的材质：`color` 是基础反射率，`metalness` 区分金属/非金属，`roughness` 控制高光扩散程度，配合 `normalMap`、`roughnessMap`、`metalnessMap`、`aoMap` 还原真实表面。它的所有光照都来自真实光源与环境贴图，所以「没灯 = 全黑」。',
  '金属度只有两个物理有意义的极端：0（电介质，如塑料、混凝土、木材）与 1（纯金属，如钢、铝）。0.3 ~ 0.7 的中间值在物理上不存在，只适合做「脏金属」这类艺术化处理。粗糙度则是连续量：0.05 接近镜面，0.4~0.6 是常见磨砂，0.9 以上几乎漫反射。金属材质必须配合 `scene.environment`，否则没有东西可反射，会呈现接近纯黑的效果。',
  '`emissive` 是自发光，不受光照影响，常用于灯带、屏幕、霓虹；它不产生真实光照（不会照亮周围物体），需要光晕就配合 Bloom 后处理。需要注意 `emissive` 会被色调映射压缩，数值超过 1 时在 ACES 下会向白色收敛。',
]

const blocks: CodeBlock[] = [
  {
    title: '标准材质的核心参数',
    desc: 'metalness / roughness 决定「是什么材质」，贴图负责细节',
    code: `const material = new THREE.MeshStandardMaterial({
  color: 0x3b82f6,       // 基础反射率（sRGB）
  metalness: 0.85,       // 0 非金属，1 金属
  roughness: 0.25,       // 0 镜面，1 全漫反射
  emissive: 0x3b82f6,    // 自发光颜色
  emissiveIntensity: 0.15,
  envMapIntensity: 1,    // 环境贴图强度
  side: THREE.FrontSide,
  transparent: false,
})

// 修改颜色 / 数值无需 needsUpdate，重编译只发生在换贴图 / 改开关时
material.color.set('#f97316')
material.roughness = 0.6`,
  },
  {
    title: '贴图组合（PBR 标准套路）',
    desc: '颜色贴图走 sRGB，数据贴图保持线性',
    code: `const map = textureLoader.load('/tex/albedo.jpg')
map.colorSpace = THREE.SRGBColorSpace
map.wrapS = map.wrapT = THREE.RepeatWrapping
map.repeat.set(4, 4)
map.anisotropy = renderer.capabilities.getMaxAnisotropy()

const normal = textureLoader.load('/tex/normal.jpg')   // 线性
const orm = textureLoader.load('/tex/orm.jpg')        // R=AO G=Roughness B=Metal

const material = new THREE.MeshStandardMaterial({
  map,
  normalMap: normal,
  roughnessMap: orm,
  metalnessMap: orm,
  aoMap: orm,
})`,
  },
  {
    title: '环境光照必需',
    desc: '没有环境贴图时，金属材质几乎没有反射来源',
    code: `// 方式一：HDR 环境
const pmrem = new THREE.PMREMGenerator(renderer)
const hdr = await new RGBELoader().loadAsync('/hdr/studio.hdr')
scene.environment = pmrem.fromEquirectangular(hdr).texture

// 方式二：程序化房间环境（无需资源）
const envScene = new RoomEnvironment()
scene.environment = pmrem.fromScene(envScene, 0.04).texture

// 强度调节
scene.environmentIntensity = 0.8
material.envMapIntensity = 1.2`,
  },
]

const notes: NoteItem[] = [
  {
    title: '金属度别用中间值',
    body: '0.2~0.8 在物理上没有对应材质，会让「金属不像金属、塑料不像塑料」。脏金属可以用贴图在 0 和 1 之间做遮罩，但单值不要取中间。',
  },
  {
    title: '透明材质的渲染顺序',
    body: '`transparent: true` 的物体会被放进透明队列按距离排序，互相穿插时排序失效。多层玻璃建议 `depthWrite: false` + 手动 `renderOrder`，或改用 `MeshPhysicalMaterial` 的 transmission（更贵但正确）。',
  },
  {
    title: '贴图色彩空间是最常见的偏色原因',
    body: '颜色贴图（map、emissiveMap）必须是 `SRGBColorSpace`；法线、粗糙度、金属度、AO 是数据贴图，保持 `NoColorSpace`。标错会让金属发灰、法线方向错误。',
  },
  {
    title: '自发光不等于光源',
    body: '`emissive` 只让自身变亮，不会照亮地面。需要真实辉光用 Bloom；需要照亮环境就加 `RectAreaLight` 或烘焙光照贴图。',
  },
]
</script>

<template>
  <DemoPage hint="MeshStandardMaterial：金属度 / 粗糙度 / 自发光实时调节，环境贴图提供反射来源。" :init="init">
    <template #panel>
      <span class="label">金属度 {{ metalness.toFixed(2) }}</span>
      <el-slider v-model="metalness" :min="0" :max="1" :step="0.01" class="!w-28" @input="applyMaterial" />

      <span class="label">粗糙度 {{ roughness.toFixed(2) }}</span>
      <el-slider v-model="roughness" :min="0.02" :max="1" :step="0.01" class="!w-28" @input="applyMaterial" />

      <span class="label">自发光 {{ emissive.toFixed(2) }}</span>
      <el-slider v-model="emissive" :min="0" :max="3" :step="0.05" class="!w-24" @input="applyMaterial" />

      <span class="label">环境强度 {{ envIntensity.toFixed(1) }}</span>
      <el-slider v-model="envIntensity" :min="0" :max="2" :step="0.1" class="!w-24" @input="applyEnv" />

      <el-color-picker v-model="color" size="small" @change="applyMaterial" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="标准材质"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="金属 + 粗糙度 + 环境贴图，三者缺一，PBR 都出不来效果。"
      />
    </template>
  </DemoPage>
</template>
