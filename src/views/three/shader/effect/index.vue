<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const mode = ref<'scan' | 'chroma' | 'pixel' | 'glitch'>('scan')
const amount = ref(0.6)
const enabled = ref(true)
const info = ref('')

const MODE: Record<string, number> = { scan: 0, chroma: 1, pixel: 2, glitch: 3 }

let T: any = null
let stage: any = null
let composer: any = null
let effectPass: any = null
let shapeGroup: any = null

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** 后处理 pass 的固定入口：tDiffuse 是上一趟渲染的结果 */
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uMode;
  uniform float uAmount;
  uniform vec2 uResolution;

  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec3 color;

    if (uMode < 0.5) {
      // 扫描线 + 噪点 + 暗角（CRT / 监控画面）
      color = texture2D(tDiffuse, uv).rgb;
      float scan = 0.82 + 0.18 * sin(uv.y * 900.0 + uTime * 8.0);
      color *= mix(1.0, scan, uAmount);
      color += (rand(uv * 200.0 + uTime) - 0.5) * 0.06 * uAmount;
      float vig = smoothstep(0.95, 0.35, length(uv - 0.5));
      color *= mix(1.0, vig, uAmount);

    } else if (uMode < 1.5) {
      // 色差：R/B 沿径向反向偏移
      vec2 dir = uv - 0.5;
      float off = uAmount * 0.012;
      color.r = texture2D(tDiffuse, uv + dir * off).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - dir * off).b;

    } else if (uMode < 2.5) {
      // 像素化：把 uv 量化到网格中心
      float px = mix(1.0, 70.0, uAmount);
      vec2 grid = vec2(px) / uResolution;
      vec2 snapped = floor(uv / grid) * grid + grid * 0.5;
      color = texture2D(tDiffuse, snapped).rgb;

    } else {
      // 故障：按横条随机错位
      float slice = floor(uv.y * 26.0 + uTime * 4.0);
      float n = rand(vec2(slice, floor(uTime * 7.0)));
      float shift = step(0.78, n) * (n - 0.5) * 0.16 * uAmount;
      color = texture2D(tDiffuse, uv + vec2(shift, 0.0)).rgb;
      color.r *= 1.0 + shift * 4.0;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

function applyMode() {
  if (effectPass) effectPass.uniforms.uMode.value = MODE[mode.value]
}

function applyAmount() {
  if (effectPass) effectPass.uniforms.uAmount.value = amount.value
}

function applyEnabled(value: any) {
  if (!stage) return
  if (value) {
    stage.setRender(() => composer.render())
    info.value = 'RenderPass → 自定义 ShaderPass → OutputPass'
  } else {
    stage.setRender(null)
    info.value = '直接 renderer.render（无后处理）'
  }
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.2, 8.4], background: '#05080e' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 1, 0)

  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const [composerMod, renderPassMod, shaderPassMod, outputMod] = await Promise.all([
    loadThreeAddon('EffectComposer'),
    loadThreeAddon('RenderPass'),
    loadThreeAddon('ShaderPass'),
    loadThreeAddon('OutputPass'),
  ])
  if (!stage) return

  composer = new composerMod.EffectComposer(renderer)
  composer.addPass(new renderPassMod.RenderPass(scene, camera))

  effectPass = new shaderPassMod.ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uMode: { value: MODE[mode.value] },
      uAmount: { value: amount.value },
      uResolution: { value: new THREE.Vector2(el.clientWidth, el.clientHeight) },
    },
    vertexShader,
    fragmentShader,
  })
  composer.addPass(effectPass)
  // OutputPass 必须放最后：负责色调映射与 sRGB 输出
  composer.addPass(new outputMod.OutputPass())

  stage.onResize((w: number, h: number) => {
    composer?.setSize(w, h)
    effectPass?.uniforms.uResolution.value.set(w, h)
  })

  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0b1220, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 2)
  key.position.set(4, 8, 6)
  scene.add(key)

  shapeGroup = new THREE.Group()
  const palette = [0x22d3ee, 0xf472b6, 0xa78bfa, 0x34d399]
  for (let i = 0; i < 4; i++) {
    const geo =
      i % 2
        ? new THREE.TorusKnotGeometry(0.5, 0.16, 140, 24)
        : new THREE.IcosahedronGeometry(0.62, 1)
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: palette[i],
        emissive: palette[i],
        emissiveIntensity: 1.4,
        metalness: 0.65,
        roughness: 0.3,
      }),
    )
    const angle = (i / 4) * Math.PI * 2
    mesh.position.set(Math.cos(angle) * 1.9, 1.3 + (i % 2) * 0.55, Math.sin(angle) * 1.1)
    shapeGroup.add(mesh)
  }
  scene.add(shapeGroup)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a1824, metalness: 0.5, roughness: 0.45 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // 地面加一张程序化网格纹理，像素化 / 色差效果看得更清楚
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#08131d'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#16455c'
  ctx.lineWidth = 2
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 6)
  floor.material.map = texture
  floor.material.needsUpdate = true

  stage.onFrame((dt: number) => {
    if (effectPass) effectPass.uniforms.uTime.value += dt
    if (shapeGroup) shapeGroup.rotation.y += dt * 0.18
  })

  applyEnabled(enabled.value)

  return () => {
    composer?.dispose?.()
    stage.dispose()
    stage = null
    composer = null
    effectPass = null
    shapeGroup = null
    T = null
  }
}

const intro: string[] = [
  '后处理特效是「对已渲染好的整帧图像再做加工」。`EffectComposer` 用 render target 串起多个 pass：`RenderPass` 先把场景画进纹理，后面的 `ShaderPass` 拿到 `tDiffuse`（上一趟的结果）做全屏采样，最后 `OutputPass` 统一做色调映射与 sRGB 转换。所以写后处理着色器时，你处理的是「已经着色完成的像素」。',
  '自定义 pass 的接口非常固定：必须声明 `uniform sampler2D tDiffuse`，用 `vUv` 采样；其余 uniform 由 `ShaderPass` 自动搬运。`uResolution` 必须自己在 resize 时更新，否则像素化、屏幕空间特效会错位。',
  '每个 pass 都是一次全屏采样 + 一次 render target 切换，代价与分辨率成正比。手机端建议只留 1~2 个 pass，并且优先考虑「能不能在材质里直接做」。像本页的扫描线完全可以塞进场景里的一块半透明遮罩，成本更低——后处理的优势是「统一作用于整个画面」，包括 UI 之外的模型、粒子、透明物体。',
]

const blocks: CodeBlock[] = [
  {
    title: '搭一条后处理管线',
    desc: 'RenderPass → ShaderPass → OutputPass',
    code: `const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const effectPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },       // 由 ShaderPass 自动填充
    uTime: { value: 0 },
    uMode: { value: 0 },
    uAmount: { value: 0.6 },
    uResolution: { value: new THREE.Vector2(width, height) },
  },
  vertexShader,   // 标准全屏四边形顶点着色器
  fragmentShader,
})
composer.addPass(effectPass)

// 最后统一做 tone mapping + sRGB
composer.addPass(new OutputPass())

// 渲染循环里改用 composer.render()
animate() {
  renderer.setRenderTarget(null)
  composer.render()
}`,
  },
  {
    title: '像素化',
    desc: 'uv 量化到网格中心，比降采样再放大更简单',
    code: `float px = mix(1.0, 70.0, uAmount);
vec2 grid = vec2(px) / uResolution;
vec2 snapped = floor(uv / grid) * grid + grid * 0.5;
vec3 color = texture2D(tDiffuse, snapped).rgb;`,
  },
  {
    title: '色差与故障',
    desc: '分离通道 / 随机横条错位',
    code: `// 色差：R、B 通道沿径向反向偏移
vec2 dir = uv - 0.5;
float off = uAmount * 0.012;
float r = texture2D(tDiffuse, uv + dir * off).r;
float g = texture2D(tDiffuse, uv).g;
float b = texture2D(tDiffuse, uv - dir * off).b;

// 故障：横条随机水平错位
float slice = floor(uv.y * 26.0 + uTime * 4.0);
float n = fract(sin(dot(vec2(slice, floor(uTime * 7.0)), vec2(12.9898, 78.233))) * 43758.5453);
float shift = step(0.78, n) * (n - 0.5) * 0.16 * uAmount;
vec3 color = texture2D(tDiffuse, uv + vec2(shift, 0.0)).rgb;`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'OutputPass 不能省',
    body: '自定义 pass 直接把 result 输出到屏幕会跳过色调映射与 sRGB 转换，画面发灰。管线末尾必须有 `OutputPass`，并且它要排在所有色彩处理之后。',
  },
  {
    title: 'resize 要同步三处',
    body: '`renderer.setSize`、`composer.setSize`、以及 `uResolution` 都要更新。只更新 renderer 的话，特效会出现黑边或坐标错位。',
  },
  {
    title: 'tDiffuse 的编码是线性的',
    body: 'RenderPass 写入的是线性颜色（render target 不做 sRGB 输出），如果直接把 `texture2D(tDiffuse, uv).rgb` 当 sRGB 值做算术，亮度会偏亮。需要正确混合就保持线性计算，最后交给 OutputPass。',
  },
  {
    title: 'MSAA 会失效',
    body: '一旦用 composer，WebGLRenderer 构造时的 `antialias: true` 就不再作用于离屏缓冲。要么给 composer 的 render target 设置 `samples: 4`，要么追加 `SMAAPass`。',
  },
]
</script>

<template>
  <DemoPage
    hint="后处理特效：EffectComposer + 自定义 ShaderPass，一套管线切换扫描线 / 色差 / 像素化 / 故障。"
    :init="init"
  >
    <template #panel>
      <el-radio-group v-model="mode" size="small" @change="applyMode">
        <el-radio-button value="scan">扫描线</el-radio-button>
        <el-radio-button value="chroma">色差</el-radio-button>
        <el-radio-button value="pixel">像素化</el-radio-button>
        <el-radio-button value="glitch">故障</el-radio-button>
      </el-radio-group>
      <span class="label">强度 {{ amount.toFixed(2) }}</span>
      <el-slider v-model="amount" :min="0" :max="1" :step="0.05" class="!w-24" @change="applyAmount" />
      <el-checkbox v-model="enabled" size="small" @change="applyEnabled">启用后处理</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="后处理 Shader"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="一个 pass = 一次全屏采样，特效越多填充率压力越大。"
      />
    </template>
  </DemoPage>
</template>
