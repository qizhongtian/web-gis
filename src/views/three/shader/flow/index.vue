<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const speed = ref(0.22)
const width = ref(0.12)
const intensity = ref(1.6)
const hue = ref<'cyan' | 'magenta' | 'lime'>('cyan')
const rotate = ref(true)

const COLORS: Record<string, [string, string]> = {
  cyan: ['#062a3a', '#22d3ee'],
  magenta: ['#2a0626', '#f472b6'],
  lime: ['#0d2a10', '#a3e635'],
}

let T: any = null
let stage: any = null
let controls: any = null
let mesh: any = null

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);       // 观察空间下指向相机的方向
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uWidth;
  uniform float uIntensity;
  uniform vec3 uBase;
  uniform vec3 uGlow;

  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  void main() {
    // 1. 沿 uv.x 滚动的光带：fract 让相位在 0~1 循环
    float flow = fract(vUv.x - uTime * uSpeed);
    float band = smoothstep(uWidth, 0.0, abs(flow - 0.5));

    // 2. 第二道更细、更快的次光带
    float flow2 = fract(vUv.x * 2.0 - uTime * uSpeed * 1.7 + 0.35);
    float band2 = smoothstep(uWidth * 0.45, 0.0, abs(flow2 - 0.5)) * 0.6;

    // 3. 菲涅尔：视线越贴表面越亮，勾出轮廓
    float fres = pow(1.0 - max(dot(normalize(vNormalV), normalize(vViewDir)), 0.0), 2.5);

    // 4. 细密的数据流线
    float lines = smoothstep(0.03, 0.0, abs(fract(vUv.x * 90.0) - 0.5)) * 0.1;

    vec3 color = uBase;
    color += uGlow * (band + band2) * uIntensity;
    color += uGlow * fres * 0.55;
    color += uGlow * lines;

    gl_FragColor = vec4(color, 1.0);
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T
  const [base, glow] = COLORS[hue.value]

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: mesh?.material.uniforms.uTime.value ?? 0 },
      uSpeed: { value: speed.value },
      uWidth: { value: width.value },
      uIntensity: { value: intensity.value },
      uBase: { value: new THREE.Color(base) },
      uGlow: { value: new THREE.Color(glow) },
    },
    vertexShader,
    fragmentShader,
  })

  mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.15, 0.34, 320, 40), material)
  stage.scene.add(mesh)
}

function apply() {
  if (!mesh) return
  const [base, glow] = COLORS[hue.value]
  const u = mesh.material.uniforms
  u.uSpeed.value = speed.value
  u.uWidth.value = width.value
  u.uIntensity.value = intensity.value
  u.uBase.value.set(base)
  u.uGlow.value.set(glow)
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.2, 6.6], background: '#04070c' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  const grid = new THREE.GridHelper(18, 18, 0x102b3a, 0x0a1c27)
  grid.position.y = -2.3
  scene.add(grid)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.update()

  build()

  stage.onFrame((dt: number) => {
    controls?.update()
    if (!mesh) return
    mesh.material.uniforms.uTime.value += dt
    if (rotate.value) {
      mesh.rotation.y += dt * 0.25
      mesh.rotation.x += dt * 0.08
    }
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    mesh = null
    T = null
  }
}

const intro: string[] = [
  '流光的本质是「沿某个方向周期性移动的亮带」。实现只需要一个随时间递增的相位：`fract(vUv.x - uTime * speed)`，再用 `smoothstep` 把相位中靠近 0.5 的一小段抠出来当作光带。相位用 `fract` 包回 0~1，就会无限循环，不需要任何贴图或逐帧更新几何。',
  '要让流光「像灯带」而不是「像涂色」，还得配两件东西：一是多条不同速度、不同宽度的光带叠在一起，形成主光 + 次光；二是菲涅尔（fresnel）边缘光，`pow(1 - dot(N, V), n)`，视线越贴近表面越亮，能勾出模型轮廓。注意 `N` 要用法线矩阵转到观察空间，`V` 用 `-mvPosition.xyz` 归一化，两者必须在同一空间。',
  '如果模型已经有标准的 PBR 材质，不必整体重写成 ShaderMaterial，用 `onBeforeCompile` 往内置着色器里插一段即可保留光照、阴影、环境贴图。代价是要小心 `#include` 的插入位置与 three 内部变量名会随版本变化，升级 three 要回归测试。',
]

const blocks: CodeBlock[] = [
  {
    title: '移动光带',
    desc: 'fract + smoothstep，两条不同速度叠加',
    code: `float flow = fract(vUv.x - uTime * uSpeed);
float band = smoothstep(uWidth, 0.0, abs(flow - 0.5));

float flow2 = fract(vUv.x * 2.0 - uTime * uSpeed * 1.7 + 0.35);
float band2 = smoothstep(uWidth * 0.45, 0.0, abs(flow2 - 0.5)) * 0.6;

vec3 color = uBase + uGlow * (band + band2) * uIntensity;`,
  },
  {
    title: '菲涅尔边缘光',
    desc: '法线矩阵 + 观察方向，注意空间一致',
    code: `// 顶点着色器
vec4 mv = modelViewMatrix * vec4(position, 1.0);
vNormalV = normalize(normalMatrix * normal);
vViewDir = normalize(-mv.xyz);
gl_Position = projectionMatrix * mv;

// 片元着色器
float fres = pow(1.0 - max(dot(normalize(vNormalV), vViewDir), 0.0), 2.5);
color += uGlow * fres * 0.55;`,
  },
  {
    title: '扩展标准材质（onBeforeCompile）',
    desc: '保留 PBR 光照，只加一层流光',
    code: `const material = new THREE.MeshStandardMaterial({
  color: 0x0a2233,
  metalness: 0.6,
  roughness: 0.35,
})

material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = uniformTime     // 与外部共享同一个 uniform 对象
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\\nuniform float uTime;')
    // 注意：vMapUv / vUv 只在材质启用了贴图时才存在，
    // 没有 map 时需要自己在顶点阶段注入 varying 传 uv
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\\n' +
      '  float flow = fract(vMapUv.x - uTime * 0.2);\\n' +
      '  totalEmissiveRadiance += vec3(0.1, 0.8, 1.0) * smoothstep(0.12, 0.0, abs(flow - 0.5));',
    )
}
material.customProgramCacheKey = () => 'flow'   // 同材质共用一份编译结果`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'uv 接缝会露馅',
    body: '圆柱、放样模型的 uv.x 在接缝处从 1 跳回 0，光带经过会有一帧突然消失或反向。要么把接缝转到背面看不见的位置，要么改用三维坐标（`vWorldPosition.y`）做相位。',
  },
  {
    title: 'ShaderMaterial 不吃光照',
    body: '自己写着色器意味着没有 PBR、没有阴影、没有环境反射，`metalness/roughness` 完全无效。需要真实光照时用 `onBeforeCompile` 扩展标准材质，或把光照项自己补齐。',
  },
  {
    title: '想发光要配后处理',
    body: '本页的高亮只是「颜色更亮」，不会真的溢出光晕。要做霓虹效果需要 `EffectComposer + UnrealBloomPass`，并且亮度值要能超过 1（配合 `ACESFilmicToneMapping`）。',
  },
  {
    title: 'onBeforeCompile 升级易碎',
    body: '它依赖 three 内部 `#include` 名字与变量（如 `totalEmissiveRadiance`），版本升级可能失效且不会报错。务必设置 `customProgramCacheKey`，否则不同参数会复用同一份编译结果。',
  },
]
</script>

<template>
  <DemoPage
    hint="流光：fract 相位 + smoothstep 光带 + 菲涅尔边缘光，纯着色器实现，零贴图零逐帧几何更新。"
    :init="init"
  >
    <template #panel>
      <span class="label">速度 {{ speed.toFixed(2) }}</span>
      <el-slider v-model="speed" :min="0.02" :max="0.8" :step="0.02" class="!w-28" @change="apply" />
      <span class="label">带宽 {{ width.toFixed(2) }}</span>
      <el-slider v-model="width" :min="0.03" :max="0.35" :step="0.01" class="!w-24" @change="apply" />
      <span class="label">强度 {{ intensity.toFixed(1) }}</span>
      <el-slider v-model="intensity" :min="0" :max="3" :step="0.1" class="!w-24" @change="apply" />
      <el-select v-model="hue" size="small" class="!w-24" @change="apply">
        <el-option label="青色" value="cyan" />
        <el-option label="品红" value="magenta" />
        <el-option label="荧光绿" value="lime" />
      </el-select>
      <el-checkbox v-model="rotate" size="small">自转</el-checkbox>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="流光 Shader"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="流光 = 周期相位 + 软边光带 + 边缘光，三条都要有才像灯。"
      />
    </template>
  </DemoPage>
</template>
