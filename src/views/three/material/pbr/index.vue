<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createRoomEnvironment, createStage } from '@/utils/gis/threeStage'

const exposure = ref(1)
const envOn = ref(true)
const envIntensity = ref(1)

let T: any = null
let stage: any = null
let envTexture: any = null

function applyExposure(value: any) {
  if (!stage) return
  stage.renderer.toneMappingExposure = value
}

function applyEnv() {
  if (!stage) return
  stage.scene.environment = envOn.value ? envTexture : null
  stage.scene.environmentIntensity = envIntensity.value
  stage.scene.background = envOn.value ? new T.Color('#070f18') : new T.Color('#070f18')
}

function applyEnvIntensity(value: any) {
  if (stage) stage.scene.environmentIntensity = value
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 4.2, 8.4], background: '#070f18' })
  const { scene, camera } = stage
  camera.lookAt(0, 1, 0)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b1220, envOn.value ? 0.15 : 1.2))
  const key = new THREE.DirectionalLight(0xffffff, envOn.value ? 0.4 : 1.8)
  key.position.set(5, 8, 6)
  scene.add(key)

  envTexture = await createRoomEnvironment(THREE, stage.renderer, scene, envIntensity.value)
  if (!stage) return
  scene.environment = envOn.value ? envTexture : null
  scene.environmentIntensity = envIntensity.value

  // 5 × 5 参数矩阵：横轴 metalness 0→1，纵轴 roughness 0.05→1
  const rows = 5
  const cols = 5
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const metalness = col / (cols - 1)
      const roughness = 0.05 + (row / (rows - 1)) * 0.95
      const material = new THREE.MeshStandardMaterial({
        color: metalness > 0.5 ? 0xf1f5f9 : 0x3b82f6,
        metalness,
        roughness,
      })
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), material)
      sphere.position.set((col - (cols - 1) / 2) * 0.86, (rows - 1 - row) * 0.8 + 0.5, 0)
      scene.add(sphere)
    }
  }

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(10, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.85, metalness: 0.1 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  stage.onFrame((dt: number) => {
    scene.rotation.y += dt * 0.06
  })

  return () => {
    stage.dispose()
    stage = null
    envTexture = null
    T = null
  }
}

const intro: string[] = [
  'PBR（基于物理的渲染）用两个物理参数描述表面：`metalness`（是不是金属）与 `roughness`（表面多粗糙）。能量守恒在这里是硬约束——金属没有漫反射、只有反射，非金属的反射率固定约 4%（F0 ≈ 0.04）；高光不会凭空变亮，只会随粗糙度从「小而亮」变成「大而柔」。',
  '真实感的关键不在参数而在环境：PBR 材质的反射来自 `scene.environment`，它必须是经过 PMREM 预滤波的立方体贴图（mipmap 层级对应不同粗糙度）。直接用等距柱状 HDR 当环境会得到模糊/错误的高光，必须 `PMREMGenerator.fromEquirectangular()` 转换一次。',
  '色调映射与曝光同样属于 PBR 管线：`ACESFilmicToneMapping` 把 HDR 亮度压进显示器范围，`toneMappingExposure` 相当于相机曝光。少了色调映射，金属高光会直接削顶成白色色块；曝光过高则整体发白、失去材质差异。',
]

const blocks: CodeBlock[] = [
  {
    title: 'PBR 参数矩阵',
    desc: '金属度只有 0 / 1 有意义，中间值用来做脏污过渡',
    code: `for (let col = 0; col < 5; col++) {
  for (let row = 0; row < 5; row++) {
    const material = new THREE.MeshStandardMaterial({
      color: col > 2 ? 0xf1f5f9 : 0x3b82f6,
      metalness: col / 4,             // 0 → 1
      roughness: 0.05 + (row / 4) * 0.95,  // 0.05 → 1
    })
    // ...
  }
}`,
  },
  {
    title: '环境贴图必须 PMREM',
    desc: 'HDR 先预滤波再赋给 scene.environment',
    code: `const pmrem = new THREE.PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()

const hdr = await new RGBELoader()
  .setDataType(THREE.HalfFloatType)
  .loadAsync('/hdr/studio.hdr')

const envMap = pmrem.fromEquirectangular(hdr).texture
scene.environment = envMap
hdr.dispose()
pmrem.dispose()`,
  },
  {
    title: '色调映射与曝光',
    desc: '输出前把 HDR 压进 LDR，曝光控制整体亮度',
    code: `renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0

// 材质的反射强度（按物体微调）
material.envMapIntensity = 1.2`,
  },
]

const notes: NoteItem[] = [
  {
    title: '没有环境贴图的 PBR 是假的',
    body: '只靠平行光的金属球会是一团黑色加一个白点。上线前务必确认 `scene.environment` 已设置，并检查 HDR 是否被正确预滤波。',
  },
  {
    title: '贴图权重别乱调',
    body: '`envMapIntensity` 调大可以「提亮」，但会破坏能量守恒，让材质像塑料贴纸。正确做法是调光源强度或曝光，材质参数保持物理范围。',
  },
  {
    title: 'AO 与间接光遮蔽',
    body: '`aoMap` 只影响环境光遮蔽，需要第二套 UV（`uv1`）。导入的模型如果 AO 不生效，检查是否缺少 `geometry.setAttribute("uv1", uv)`。',
  },
  {
    title: '移动端降级策略',
    body: 'PMREM 生成有一次性开销，HDR 分辨率越大越慢。移动端可用 RoomEnvironment、降低 env 尺寸、关闭 `envMapIntensity` 高的反射材质，或改用 `MeshLambertMaterial` 降级。',
  },
]
</script>

<template>
  <DemoPage hint="PBR：5×5 金属度 / 粗糙度参数矩阵，环境贴图开关与曝光控制。" :init="init">
    <template #panel>
      <el-checkbox v-model="envOn" size="small" @change="applyEnv">环境贴图</el-checkbox>

      <span class="label">环境强度 {{ envIntensity.toFixed(1) }}</span>
      <el-slider v-model="envIntensity" :min="0" :max="2" :step="0.1" class="!w-28" @input="applyEnvIntensity" />

      <span class="label">曝光 {{ exposure.toFixed(2) }}</span>
      <el-slider v-model="exposure" :min="0.2" :max="2.5" :step="0.05" class="!w-28" @input="applyExposure" />

      <span class="label">横轴 metalness 0 → 1 · 纵轴 roughness 0.05 → 1</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="PBR 材质体系"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="PBR 出效果的顺序：环境贴图 → 色调映射 → 参数，参数永远最后调。"
      />
    </template>
  </DemoPage>
</template>
