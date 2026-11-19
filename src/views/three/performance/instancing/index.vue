<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const count = ref(15000)
const wind = ref(0.5)
const animate = ref(true)
const stats = ref('')

let T: any = null
let stage: any = null
let instanced: any = null
let statTimer = 0

const vertexShader = /* glsl */ `
  // instanceMatrix 由 three 在 USE_INSTANCING 下自动声明，不要重复定义
  attribute float aPhase;

  uniform float uTime;
  uniform float uWind;

  varying vec3 vNormalV;
  varying float vTint;

  void main() {
    vec3 p = position;

    // 只有树梢摆：以几何体局部高度的下半部分为轴
    float height = max(p.y + 0.55, 0.0);
    float phase = aPhase * 6.2831 + instanceMatrix[3].x * 0.25;

    float sway = sin(uTime * 1.6 + phase) * 0.06 * uWind * height * height;
    p.x += sway;
    p.z += sway * 0.65;

    // 实例矩阵把局部坐标送到世界，再走标准的模型视图矩阵
    vec4 world = instanceMatrix * vec4(p, 1.0);
    vec4 mv = modelViewMatrix * world;

    vNormalV = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vTint = aPhase;

    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying vec3 vNormalV;
  varying float vTint;

  void main() {
    // 观察空间固定光，省掉整套 PBR
    vec3 N = normalize(vNormalV);
    vec3 L = normalize(vec3(0.45, 0.8, 0.55));
    float diff = max(dot(N, L), 0.0);

    vec3 color = mix(uColorA, uColorB, vTint);
    color *= 0.3 + diff * 0.85;

    gl_FragColor = vec4(color, 1.0);
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T

  if (instanced) {
    stage.scene.remove(instanced)
    instanced.geometry.dispose()
    instanced.material.dispose()
    instanced = null
  }

  const total = count.value
  const side = Math.ceil(Math.sqrt(total))
  const gap = 0.52
  const half = (side * gap) / 2

  const geometry = new THREE.ConeGeometry(0.17, 1.1, 5)
  const phases = new Float32Array(total)
  for (let i = 0; i < total; i++) phases[i] = Math.random()

  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: wind.value },
      uColorA: { value: new THREE.Color('#0e7490') },
      uColorB: { value: new THREE.Color('#a7f3d0') },
    },
    vertexShader,
    fragmentShader,
  })

  instanced = new THREE.InstancedMesh(geometry, material, total)
  const dummy = new THREE.Object3D()

  for (let i = 0; i < total; i++) {
    const x = (i % side) * gap - half
    const z = Math.floor(i / side) * gap - half
    const scale = 0.7 + Math.random() * 0.8
    dummy.position.set(x, 0.55 * scale, z)
    dummy.rotation.y = Math.random() * Math.PI
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    instanced.setMatrixAt(i, dummy.matrix)
  }

  instanced.instanceMatrix.needsUpdate = true
  instanced.computeBoundingSphere()
  stage.scene.add(instanced)

  updateStats()
}

function updateStats() {
  if (!stage) return
  const info = stage.renderer.info.render
  const text = `实例 ${instanced?.count ?? 0} · DrawCall ${info.calls} · 三角 ${info.triangles.toLocaleString()}`
  if (text !== stats.value) stats.value = text
}

function apply() {
  build()
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 9, 18], background: '#071018' })
  const { scene, camera } = stage
  camera.lookAt(0, 1, 0)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshBasicMaterial({ color: 0x0a1c26 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  build()

  stage.onFrame((dt: number) => {
    if (!instanced) return
    if (animate.value) instanced.material.uniforms.uTime.value += dt
    instanced.material.uniforms.uWind.value = wind.value
    instanced.rotation.y += dt * 0.03

    statTimer += dt
    if (statTimer > 0.5) {
      statTimer = 0
      updateStats()
    }
  })

  return () => {
    stage.dispose()
    stage = null
    instanced = null
    T = null
  }
}

const intro: string[] = [
  '上一章的 `InstancedMesh` 是「CPU 填矩阵」，这一页是「GPU 自己动」：实例的静止变换写在 `instanceMatrix` 里只上传一次，每帧的摆动由顶点着色器根据 `uTime` 与每实例的 `aPhase` 算出。CPU 每帧做的唯一事情是把 `uTime` 加一个 delta，一万多个实例也几乎零开销。',
  '关键点是 three 在 `USE_INSTANCING` 下会自动往顶点着色器前缀里注入 `attribute mat4 instanceMatrix`，自定义 `ShaderMaterial` 也一样。所以自己再声明一次会编译失败；正确做法是直接用，并让 `modelViewMatrix` 作用在 `instanceMatrix * position` 之后。法线也要乘 `mat3(instanceMatrix)`，否则实例被旋转后光照方向会错。',
  '什么时候该把动画搬到 GPU：位移/旋转/缩放只依赖时间与实例索引，且不需要 CPU 知道结果的场景——草地摆动、旗帜、人群晃动、粒子。反过来，需要拾取、需要与其他物体做碰撞、需要按状态切换形状的，仍然得留在 CPU 或做双向同步。',
]

const blocks: CodeBlock[] = [
  {
    title: '每实例属性',
    desc: 'InstancedBufferAttribute 一份数据喂所有实例',
    code: `const total = 15000
const phases = new Float32Array(total)
for (let i = 0; i < total; i++) phases[i] = Math.random()

const geometry = new THREE.ConeGeometry(0.17, 1.1, 5)
geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))

const material = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uWind: { value: 0.5 } },
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.InstancedMesh(geometry, material, total)`,
  },
  {
    title: '顶点着色器里摆动',
    desc: 'instanceMatrix 由 three 注入，别再声明',
    code: `attribute float aPhase;

uniform float uTime;
uniform float uWind;

void main() {
  vec3 p = position;

  float height = max(p.y + 0.55, 0.0);          // 越高摆得越大
  float phase = aPhase * 6.2831 + instanceMatrix[3].x * 0.25;
  float sway = sin(uTime * 1.6 + phase) * 0.06 * uWind * height * height;

  p.x += sway;
  p.z += sway * 0.65;

  vec4 world = instanceMatrix * vec4(p, 1.0);
  vNormalV = normalize(normalMatrix * mat3(instanceMatrix) * normal);

  gl_Position = projectionMatrix * modelViewMatrix * world;
}`,
  },
  {
    title: 'CPU 侧每帧只改 uniform',
    desc: '与「每帧重写 instanceMatrix」的对比',
    code: `// GPU 动画：每帧 1 次 uniform 更新
function animate(dt) {
  material.uniforms.uTime.value += dt
}

// CPU 动画：每帧 N 次矩阵计算 + 整块缓冲重传
function animateCPU(dt) {
  for (let i = 0; i < count; i++) {
    dummy.matrix.copy(baseMatrices[i])
    dummy.matrix.elements[13] += Math.sin(t + i) * 0.05
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true   // 15000 × 16 × 4 字节
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '不要重复声明 instanceMatrix',
    body: 'three 在 `USE_INSTANCING` 下自动注入 `attribute mat4 instanceMatrix`，自己写一行会报「redefinition」。同理 `instanceColor` 也在 `USE_INSTANCING_COLOR` 下注入。',
  },
  {
    title: '法线要乘实例矩阵',
    body: '实例带旋转/非等比缩放时，`normal` 只经过 `normalMatrix` 不够。正确顺序是 `normalMatrix * mat3(instanceMatrix) * normal`，否则树被旋转后受光方向错乱。',
  },
  {
    title: '包围体不会自动跟着顶点动',
    body: '顶点在着色器里位移后 `computeBoundingSphere()` 的结果不再准确。轻微摆动可以放大包围球，幅度大时直接 `frustumCulled = false`，避免整批实例突然消失。',
  },
  {
    title: 'GPU 动画无法被拾取',
    body: '射线检测用的是 CPU 端几何与矩阵，看到的仍是「静止」的顶点。要做点击摆动中的树，只能近似用静止包围体，或在 CPU 里重算被命中实例的位置。',
  },
]
</script>

<template>
  <DemoPage
    hint="GPU Instancing：15000 棵树的摆动全在顶点着色器，CPU 每帧只更新一个 uniform。"
    :init="init"
  >
    <template #panel>
      <span class="label">实例 {{ count.toLocaleString() }}</span>
      <el-slider v-model="count" :min="2000" :max="40000" :step="1000" class="!w-36" @change="apply" />
      <span class="label">风 {{ wind.toFixed(1) }}</span>
      <el-slider v-model="wind" :min="0" :max="2" :step="0.1" class="!w-24" />
      <el-checkbox v-model="animate" size="small">播放</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="GPU 实例动画"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="把「每帧要做的事」从 CPU 搬到顶点着色器，是实例化的第二层收益。"
      />
    </template>
  </DemoPage>
</template>
