<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const enabled = ref(true)
const mapSize = ref(1024)
const bias = ref(-0.0006)
const normalBias = ref(0.02)
const type = ref<'pcf' | 'pcfsoft' | 'basic' | 'vsm'>('pcfsoft')
const showFrustum = ref(false)

let T: any = null
let stage: any = null
let light: any = null
let helper: any = null

const SHADOW_TYPE: Record<string, string> = {
  basic: 'BasicShadowMap',
  pcf: 'PCFShadowMap',
  pcfsoft: 'PCFSoftShadowMap',
  vsm: 'VSMShadowMap',
}

function applyEnabled(value: any) {
  if (!stage) return
  stage.renderer.shadowMap.enabled = value
  stage.scene.traverse((obj: any) => {
    if (obj.material) obj.material.needsUpdate = true
  })
}

function applyMapSize(value: any) {
  if (!light) return
  light.shadow.map?.dispose()
  light.shadow.map = null
  light.shadow.mapSize.set(value, value)
}

function applyBias(value: any) {
  if (light) light.shadow.bias = value
}

function applyNormalBias(value: any) {
  if (light) light.shadow.normalBias = value
}

function applyType(value: any) {
  if (!stage || !T) return
  stage.renderer.shadowMap.type = T[SHADOW_TYPE[value] as keyof typeof T]
  // 切换阴影类型需要重新编译所有材质
  stage.scene.traverse((obj: any) => {
    if (obj.material) obj.material.needsUpdate = true
  })
}

function applyFrustum(value: any) {
  if (helper) helper.visible = value
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [7, 5.5, 9], background: '#0a1a28' })
  const { scene, renderer } = stage

  renderer.shadowMap.enabled = enabled.value
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0b1220, 0.55))

  light = new THREE.DirectionalLight(0xffffff, 2.8)
  light.position.set(5, 9, 4)
  light.castShadow = true
  light.shadow.mapSize.set(mapSize.value, mapSize.value)
  light.shadow.bias = bias.value
  light.shadow.normalBias = normalBias.value
  light.shadow.camera.near = 1
  light.shadow.camera.far = 30
  light.shadow.camera.left = -9
  light.shadow.camera.right = 9
  light.shadow.camera.top = 9
  light.shadow.camera.bottom = -9
  light.shadow.camera.updateProjectionMatrix()
  scene.add(light)

  helper = new THREE.CameraHelper(light.shadow.camera)
  helper.visible = showFrustum.value
  scene.add(helper)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshStandardMaterial({ color: 0x14324a, roughness: 0.9, metalness: 0.05 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const palette = [0x38bdf8, 0xf97316, 0xa78bfa]
  for (let i = 0; i < 6; i++) {
    const geometry = i % 2 === 0 ? new THREE.BoxGeometry(1, 1.4, 1) : new THREE.CylinderGeometry(0.55, 0.55, 1.6, 32)
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: palette[i % 3], metalness: 0.3, roughness: 0.35 }),
    )
    mesh.position.set(Math.cos((i / 6) * Math.PI * 2) * 3.2, 0.8, Math.sin((i / 6) * Math.PI * 2) * 3.2)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  // 一块「薄片」，用来观察 bias / normalBias 是否合适（自阴影条纹）
  const plane = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.08, 4),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 }),
  )
  plane.position.set(0, 0.05, 0)
  plane.castShadow = true
  plane.receiveShadow = true
  scene.add(plane)

  stage.onFrame((dt: number) => {
    scene.rotation.y += dt * 0.04
  })

  return () => {
    stage.dispose()
    stage = null
    light = null
    helper = null
    T = null
  }
}

const intro: string[] = [
  '阴影是「以光源为相机再渲染一遍深度」：`DirectionalLight` / `SpotLight` / `PointLight` 打开 `castShadow` 后，渲染器从光源视角把场景写进一张深度图（shadow map），主渲染时按世界坐标查这张图判断是否被遮挡。所以阴影质量取决于 shadow map 分辨率与阴影相机的取景范围，而不是主相机。',
  '第一个必调项是阴影相机的正交框：平行光的 `shadow.camera` 是 `OrthographicCamera`，默认范围很小（±5），场景一大就会出现「阴影被截断 / 只在中间一小块有影子」。按场景包围盒设置 `left/right/top/bottom` 与 `near/far`，框越紧，同样分辨率下阴影越清晰。',
  '第二个必调项是偏移：shadow map 是离散像素，斜面上会出现自阴影条纹（shadow acne）。`bias`（负值，单位是深度值）和 `normalBias`（沿法线推一点，单位是世界单位）都能缓解，但过大会让阴影「脱离」物体（peter-panning）。经验起点：`bias = -0.0005`、`normalBias = 0.02`，再按尺度微调。',
]

const blocks: CodeBlock[] = [
  {
    title: '开启阴影的三处开关',
    desc: 'renderer 开关 + light.castShadow + 物体 cast/receive',
    code: `renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const light = new THREE.DirectionalLight(0xffffff, 2.8)
light.position.set(5, 9, 4)
light.castShadow = true
light.shadow.mapSize.set(2048, 2048)

mesh.castShadow = true        // 投影
ground.receiveShadow = true   // 接收`,
  },
  {
    title: '阴影相机与偏移',
    desc: '范围按场景包围盒收紧；bias 治条纹，normalBias 治斜面',
    code: `const cam = light.shadow.camera
cam.left = -9
cam.right = 9
cam.top = 9
cam.bottom = -9
cam.near = 1
cam.far = 30
cam.updateProjectionMatrix()

light.shadow.bias = -0.0005        // 负值，抑制 shadow acne
light.shadow.normalBias = 0.02     // 世界单位，斜面上更有效
light.shadow.radius = 3            // PCF 采样半径（VSM 不支持）`,
  },
  {
    title: '换分辨率与类型要重建',
    desc: 'mapSize 变更要丢弃旧 map；类型变更要重编译材质',
    code: `// mapSize 变化：旧 shadow map 必须丢弃
light.shadow.map?.dispose()
light.shadow.map = null
light.shadow.mapSize.set(4096, 4096)

// 阴影类型变化：所有材质需要重新编译
renderer.shadowMap.type = THREE.VSMShadowMap
scene.traverse((obj) => {
  if (obj.material) obj.material.needsUpdate = true
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: '阴影突然没了：先看阴影相机',
    body: '平行光的阴影框默认只有 ±5，场景一扩大物体就落到框外。用 `CameraHelper(light.shadow.camera)` 可视化，按场景范围设置并记得 `updateProjectionMatrix()`。',
  },
  {
    title: '条纹与脱影是两个方向的错误',
    body: '条纹（acne）说明偏移太小，增大 `bias`（更负）或 `normalBias`；阴影整体偏移、与物体分离说明偏移过大。两者要来回调，别一次调 0.01。',
  },
  {
    title: '透明物体也会投实心阴影',
    body: 'shadow map 只写深度，不看 `transparent` / alpha。树叶、栏杆要投镂空阴影，需要使用 `customDepthMaterial` + alphaTest 的深度材质。',
  },
  {
    title: '阴影很贵',
    body: '一张 2048 shadow map 每帧多一次场景绘制；多光源阴影 = 多次。移动端建议只给主光开阴影、mapSize 1024、限制 `shadow.camera` 范围，或用烘焙光照贴图替代实时阴影。',
  },
]
</script>

<template>
  <DemoPage hint="阴影：shadow map 分辨率、阴影相机框、bias / normalBias 与 PCF / VSM 类型对比。" :init="init">
    <template #panel>
      <el-checkbox v-model="enabled" size="small" @change="applyEnabled">阴影</el-checkbox>
      <el-checkbox v-model="showFrustum" size="small" @change="applyFrustum">阴影相机框</el-checkbox>

      <span class="label">贴图</span>
      <el-select v-model="mapSize" size="small" class="!w-24" @change="applyMapSize">
        <el-option :value="512" label="512" />
        <el-option :value="1024" label="1024" />
        <el-option :value="2048" label="2048" />
        <el-option :value="4096" label="4096" />
      </el-select>

      <span class="label">类型</span>
      <el-select v-model="type" size="small" class="!w-24" @change="applyType">
        <el-option label="Basic" value="basic" />
        <el-option label="PCF" value="pcf" />
        <el-option label="PCF Soft" value="pcfsoft" />
        <el-option label="VSM" value="vsm" />
      </el-select>

      <span class="label">bias {{ bias.toFixed(4) }}</span>
      <el-slider v-model="bias" :min="-0.005" :max="0.005" :step="0.0002" class="!w-28" @input="applyBias" />

      <span class="label">normalBias {{ normalBias.toFixed(2) }}</span>
      <el-slider v-model="normalBias" :min="0" :max="0.2" :step="0.005" class="!w-28" @input="applyNormalBias" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="阴影 Shadow"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="阴影三要素：阴影相机框、mapSize、bias / normalBias。"
      />
    </template>
  </DemoPage>
</template>
