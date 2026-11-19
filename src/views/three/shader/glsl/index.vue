<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const colorA = ref('#0ea5e9')
const colorB = ref('#7c3aed')
const speed = ref(0.6)
const gridSize = ref(8)
const plus = ref(0.35)

let T: any = null
let stage: any = null
let material: any = null

const vertexShader = /* glsl */ `
  // uv / position / normal 是 three 自动注入的 attribute，不要重复声明
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // projectionMatrix / modelViewMatrix 同样是内置 uniform
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGrid;
  uniform float uPlus;

  varying vec2 vUv;

  void main() {
    // 1. 用 vUv.y 做上下渐变
    vec3 color = mix(uColorA, uColorB, vUv.y);

    // 2. 一道随时间横向移动的亮带
    float wave = sin((vUv.x + uTime * 0.15) * 6.2831) * 0.5 + 0.5;
    color += vec3(0.18) * wave * uPlus;

    // 3. 用 fract 生成网格线
    vec2 g = abs(fract(vUv * uGrid) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
    color = mix(color, vec3(1.0), line * 0.32);

    // 4. 边缘暗角，让平面有「屏」的感觉
    vec2 p = vUv - 0.5;
    color *= 1.0 - dot(p, p) * 0.9;

    gl_FragColor = vec4(color, 1.0);
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA.value) },
      uColorB: { value: new THREE.Color(colorB.value) },
      uGrid: { value: gridSize.value },
      uPlus: { value: plus.value },
    },
    vertexShader,
    fragmentShader,
  })

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2, 1, 1), material)
  stage.scene.add(plane)
}

function applyColor() {
  if (!material) return
  material.uniforms.uColorA.value.set(colorA.value)
  material.uniforms.uColorB.value.set(colorB.value)
}

function applyNumber() {
  if (!material) return
  material.uniforms.uGrid.value = gridSize.value
  material.uniforms.uPlus.value = plus.value
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 0, 5.4], background: '#060b14', antialias: true })
  stage.camera.lookAt(0, 0, 0)

  build()

  stage.onFrame((dt: number) => {
    if (!material) return
    material.uniforms.uTime.value += dt * speed.value
  })

  return () => {
    stage.dispose()
    stage = null
    material = null
    T = null
  }
}

const intro: string[] = [
  'GLSL 是跑在 GPU 上的 C 风格语言。three 的 `ShaderMaterial` 让你只写两段函数：顶点着色器对「每个顶点」执行一次，负责算出裁剪空间坐标 `gl_Position`；片元着色器对「每个像素（更准确说是光栅化后的片元）」执行一次，负责算出颜色 `gl_FragColor`。中间用 `varying` 传递插值数据（新版 GLSL3 写作 `in/out`）。',
  'three 会自动往着色器里注入一批内置变量，不需要你声明：attribute 有 `position`、`uv`、`normal`；uniform 有 `modelMatrix`、`viewMatrix`、`modelViewMatrix`、`projectionMatrix`、`normalMatrix`、`cameraPosition`；以及 `precision` 前缀。这也是为什么自定义 attribute 不能叫这些名字。',
  '最关键的一条：`ShaderMaterial` 的输出「不会」经过色调映射与 sRGB 转换。内置材质在片元末尾会 include `tonemapping_fragment` 与 `colorspace_fragment`，手写着色器没有这一步。接 `EffectComposer` 时由 `OutputPass` 统一处理；直接渲染到屏幕时，颜色会显得偏亮、偏灰，需要自己补 `#include` 或手动做 pow(1/2.2)。',
]

const blocks: CodeBlock[] = [
  {
    title: '完整顶点着色器',
    desc: '内置 attribute 直接用，varying 负责传 uv',
    code: `varying vec2 vUv;

void main() {
  vUv = uv;                                    // 传给片元，光栅化时自动插值
  gl_Position = projectionMatrix
              * modelViewMatrix
              * vec4(position, 1.0);          // 裁剪空间坐标
}`,
  },
  {
    title: '完整片元着色器',
    desc: 'fract / smoothstep / mix 是最高频的三个函数',
    code: `uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uGrid;

varying vec2 vUv;

void main() {
  vec3 color = mix(uColorA, uColorB, vUv.y);

  // fract：取小数部分，天然产生周期
  vec2 g = abs(fract(vUv * uGrid) - 0.5);
  // smoothstep：把 0~0.035 映射成 1~0，做抗锯齿的线
  float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
  color = mix(color, vec3(1.0), line * 0.32);

  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    title: 'JS 侧创建与更新',
    desc: 'uniform 是「引用式」更新，不需要重建材质',
    code: `const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color('#0ea5e9') },
    uGrid: { value: 8 },
  },
  vertexShader,
  fragmentShader,
  // transparent: true,  depthWrite: false,
  // side: THREE.DoubleSide,
})

function animate(dt) {
  material.uniforms.uTime.value += dt   // 每帧改 value 即可
}

// 如果物体既想要标准材质的光照，又想加效果：
material.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\\n  // 在这里插入自己的计算',
  )
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '颜色看起来不对？先查色彩空间',
    body: '`ShaderMaterial` 不做 sRGB 输出转换，也不做色调映射。用 composer 时加 `OutputPass`；直接渲染时给片元末尾补 `#include <tonemapping_fragment>` 和 `#include <colorspace_fragment>`（注意此时不能再用 `gl_FragColor`，要写 `gl_FragColor` 后再 include，顺序照内置材质抄）。',
  },
  {
    title: 'varying 类型必须两边一致',
    body: '顶点着色器写 `varying vec3 vPos`，片元就必须同样声明，名字和类型都不能差。声明了但没赋值，读到的是未定义行为，常见表现是黑屏或雪花点。',
  },
  {
    title: 'uniform 名不要撞内置',
    body: '`modelMatrix`、`projectionMatrix`、`uv` 等由 three 注入，自己再声明会编译失败。报错信息在浏览器控制台里有完整日志，也可以在 `renderer.debug.onShaderError` 里拿到。',
  },
  {
    title: 'GLSL 没有自动类型转换',
    body: '`1.0` 是 float，`1` 是 int，`float x = 1;` 直接编译错误。写常量一律带小数点；`0.5 * 2` 也要写成 `0.5 * 2.0`。',
  },
]
</script>

<template>
  <DemoPage
    hint="GLSL 基础：一段顶点着色器 + 一段片元着色器，用 uv、uniform 与 fract/smoothstep 画出会动的网格屏。"
    :init="init"
  >
    <template #panel>
      <span class="label">渐变</span>
      <el-color-picker v-model="colorA" size="small" @change="applyColor" />
      <el-color-picker v-model="colorB" size="small" @change="applyColor" />
      <span class="label">速度 {{ speed.toFixed(1) }}</span>
      <el-slider v-model="speed" :min="0" :max="2" :step="0.1" class="!w-24" />
      <span class="label">网格 {{ gridSize }}</span>
      <el-slider v-model="gridSize" :min="2" :max="24" :step="1" class="!w-24" @change="applyNumber" />
      <span class="label">亮带 {{ plus.toFixed(2) }}</span>
      <el-slider v-model="plus" :min="0" :max="1.5" :step="0.05" class="!w-24" @change="applyNumber" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="GLSL 基础"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="顶点着色器决定「在哪」，片元着色器决定「什么颜色」。"
      />
    </template>
  </DemoPage>
</template>
