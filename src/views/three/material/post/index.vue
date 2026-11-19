<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const enabled = ref(true)
const strength = ref(1.1)
const radius = ref(0.5)
const threshold = ref(0.35)
const info = ref('')

let T: any = null
let stage: any = null
let composer: any = null
let bloomPass: any = null

function applyStrength(value: any) {
  if (bloomPass) bloomPass.strength = value
}

function applyRadius(value: any) {
  if (bloomPass) bloomPass.radius = value
}

function applyThreshold(value: any) {
  if (bloomPass) bloomPass.threshold = value
}

function applyEnabled(value: any) {
  if (!stage) return
  if (value) {
    stage.setRender(() => composer.render())
    info.value = 'EffectComposer + Bloom + OutputPass'
  } else {
    stage.setRender(null)
    info.value = '直接 renderer.render（无后处理）'
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.4, 8.6], background: '#05080d' })
  const { scene, renderer, camera } = stage
  camera.lookAt(0, 1.2, 0)

  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  const [composerMod, renderPassMod, bloomMod, outputMod] = await Promise.all([
    loadThreeAddon('EffectComposer'),
    loadThreeAddon('RenderPass'),
    loadThreeAddon('UnrealBloomPass'),
    loadThreeAddon('OutputPass'),
  ])
  if (!stage) return

  composer = new composerMod.EffectComposer(renderer)
  composer.addPass(new renderPassMod.RenderPass(scene, camera))
  bloomPass = new bloomMod.UnrealBloomPass(
    new THREE.Vector2(el.clientWidth, el.clientHeight),
    strength.value,
    radius.value,
    threshold.value,
  )
  composer.addPass(bloomPass)
  // OutputPass 负责色调映射与 sRGB 输出（接在最后的「出口」）
  composer.addPass(new outputMod.OutputPass())

  stage.onResize((w: number, h: number) => {
    composer?.setSize(w, h)
    bloomPass?.setSize(w, h)
  })

  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0b1220, 0.35))

  const palette = [0x22d3ee, 0xf97316, 0xa78bfa, 0x22c55e]
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const mesh = new THREE.Mesh(
      i % 2 ? new THREE.TorusKnotGeometry(0.55, 0.16, 128, 20) : new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({
        color: palette[i],
        emissive: palette[i],
        emissiveIntensity: 2.6, // 超过 1 才会触发 Bloom 的阈值
        metalness: 0.6,
        roughness: 0.25,
      }),
    )
    mesh.position.set(Math.cos(angle) * 2.1, 1.4 + (i % 2) * 0.5, Math.sin(angle) * 1.2)
    scene.add(mesh)
  }

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 5 }),
  )
  core.position.y = 1.3
  scene.add(core)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.5, metalness: 0.5 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  stage.onFrame((dt: number) => {
    scene.rotation.y += dt * 0.12
  })

  applyEnabled(enabled.value)

  return () => {
    composer?.dispose?.()
    bloomPass?.dispose?.()
    stage.dispose()
    stage = null
    composer = null
    bloomPass = null
    T = null
  }
}

const intro: string[] = [
  '后处理（post-processing）是把整帧画面先渲染到离屏纹理（render target），再依次经过若干全屏着色器 pass，最后输出到屏幕。Bloom、景深、SSAO、色调映射、抗锯齿都可以在这一层做。three 用 `EffectComposer` 串起这些 pass，`RenderPass` 负责把场景画进缓冲，后续 pass 依次加工。',
  'Bloom（泛光）的思路是「亮部提取 → 多次模糊 → 叠加回原图」：`threshold` 决定多亮才算亮部，`strength` 是叠加强度，`radius` 是模糊扩散范围。想让灯带、霓虹发光，材质的 `emissiveIntensity` 要大于 1，并配合 `ACESFilmicToneMapping`，否则亮部被压在 1 以下，Bloom 提取不到东西。',
  '后处理有固定代价：每个 pass 一次全屏采样，`composer` 还需要额外的 render target（显存与带宽）。移动端建议控制在 1~2 个 pass，且把 `renderer.setPixelRatio` 压到 1.5 以下。另外注意：开了 composer 后，构造 `WebGLRenderer` 时的 MSAA 失效，抗锯齿要另加 `SMAAPass`，或者给 composer 的 render target 开 `samples`。',
]

const blocks: CodeBlock[] = [
  {
    title: 'EffectComposer 基本管线',
    desc: 'RenderPass 打底，效果 pass 叠加，最后 OutputPass 输出',
    code: `import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const bloom = new UnrealBloomPass(
  new THREE.Vector2(width, height),
  1.1,   // strength
  0.5,   // radius
  0.35,  // threshold
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// 渲染循环里用 composer.render() 替代 renderer.render()
function render() {
  composer.render()
}

// 尺寸变化
composer.setSize(w, h)`,
  },
  {
    title: '自定义 ShaderPass（扫描线 / 色差）',
    desc: '全屏 pass 的输入是上一 pass 的纹理',
    code: `import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const ScanShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.2 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 color = texture2D(tDiffuse, vUv);',
    '  float line = sin(vUv.y * 800.0 + uTime * 6.0) * 0.5 + 0.5;',
    '  color.rgb *= mix(1.0, line, uAmount);',
    '  gl_FragColor = color;',
    '}',
  ].join('\\n'),
}

const scan = new ShaderPass(ScanShader)
composer.addPass(scan)`,
  },
  {
    title: '分辨率与性能',
    desc: 'render target 尺寸决定后处理成本，可以做「半分辨率 Bloom」',
    code: `// 默认跟随 renderer 尺寸；可显式降低内部分辨率
const size = renderer.getDrawingBufferSize(new THREE.Vector2())
composer.setSize(size.x, size.y)

// 屏幕空间抗锯齿（composer 下 MSAA 失效）
// import { SMAAPass } from '.../SMAAPass.js'
// composer.addPass(new SMAAPass(w, h))

// 移动端：降像素比 + 只保留必要 pass
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'composer 渲染后画面变灰 / 变暗',
    body: '缺少 `OutputPass`。composer 内部的 render target 是线性空间，必须由 `OutputPass`（或 `GammaCorrectionShader`）做色调映射与 sRGB 转换；直接 `composer.render()` 会得到偏暗的线性图像。',
  },
  {
    title: 'Bloom 没效果',
    body: '亮部没有超过阈值。把材质 `emissiveIntensity` 提到 2 以上，或降低 `threshold`（0.2~0.4），并确认没有在 composer 之后又覆盖渲染。',
  },
  {
    title: '后处理与透明背景',
    body: '`alpha: true` 的透明画布经过 composer 后 alpha 可能被覆盖成不透明。需要透明背景时给 RenderPass 设 `clearAlpha = 0`，并选支持 alpha 的 pass 组合。',
  },
  {
    title: '多 pass 的叠加成本',
    body: '每个全屏 pass 都要采样整张纹理，1080p 下 5 个 pass 就是 5 次全屏读写。移动端优先保证帧率：Bloom 用半分辨率、关闭 SSAO、避免链式模糊。',
  },
]
</script>

<template>
  <DemoPage hint="后处理：EffectComposer + RenderPass + UnrealBloomPass + OutputPass，泛光参数实时调节。" :init="init">
    <template #panel>
      <el-checkbox v-model="enabled" size="small" @change="applyEnabled">后处理</el-checkbox>

      <span class="label">强度 {{ strength.toFixed(2) }}</span>
      <el-slider v-model="strength" :min="0" :max="3" :step="0.05" class="!w-24" @input="applyStrength" />

      <span class="label">半径 {{ radius.toFixed(2) }}</span>
      <el-slider v-model="radius" :min="0" :max="1" :step="0.05" class="!w-24" @input="applyRadius" />

      <span class="label">阈值 {{ threshold.toFixed(2) }}</span>
      <el-slider v-model="threshold" :min="0" :max="1" :step="0.05" class="!w-24" @input="applyThreshold" />

      <el-tag size="small" type="info" effect="plain">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="后处理"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="composer 管线三件套：RenderPass 打底、效果 pass 叠加、OutputPass 收尾。"
      />
    </template>
  </DemoPage>
</template>
