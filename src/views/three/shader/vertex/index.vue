<script setup lang="ts">
import { ref, computed } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const segments = ref(128)
const amplitude = ref(0.6)
const frequency = ref(1.4)
const wireframe = ref(false)
const stats = ref('')

const vertexCount = computed(() => (segments.value + 1) ** 2)

let T: any = null
let stage: any = null
let controls: any = null
let mesh: any = null

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uFreq;

  varying float vHeight;
  varying vec3 vNormalW;

  // 解析法求高度场的法线：比在顶点着色器里差分省算力
  float wave(vec2 p, float t) {
    float h = sin(p.x * uFreq + t) * 0.6;
    h += cos(p.y * uFreq * 0.8 + t * 0.7) * 0.4;
    h += sin((p.x + p.y) * uFreq * 1.7 + t * 1.3) * 0.15;
    return h;
  }

  void main() {
    vec2 plane = vec2(position.x, position.z);   // 已把 PlaneGeometry 旋转到 XZ 平面

    float eps = 0.05;
    float h = wave(plane, uTime);
    float hx = wave(plane + vec2(eps, 0.0), uTime);
    float hz = wave(plane + vec2(0.0, eps), uTime);

    // 偏导数 → 法线（局部空间），再乘法线矩阵转到观察空间
    vec3 n = normalize(vec3(-(hx - h) / eps, 1.0, -(hz - h) / eps));

    vec3 p = position;
    p.y += h * uAmp;

    vHeight = h;
    vNormalW = normalize(normalMatrix * n);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uLow;
  uniform vec3 uHigh;

  varying float vHeight;
  varying vec3 vNormalW;

  void main() {
    // 用高度做配色，再用假光照让起伏可读
    float t = smoothstep(-1.0, 1.0, vHeight);
    vec3 color = mix(uLow, uHigh, t);

    vec3 lightDir = normalize(vec3(0.5, 0.9, 0.4));
    float diff = max(dot(normalize(vNormalW), lightDir), 0.0);
    color *= 0.35 + diff * 0.9;

    // 波峰描一条亮边
    float crest = smoothstep(0.75, 1.0, vHeight);
    color += vec3(0.35, 0.55, 0.65) * crest;

    gl_FragColor = vec4(color, 1.0);
  }
`

function build() {
  if (!stage || !T) return
  const THREE = T

  if (mesh) {
    stage.scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
    mesh = null
  }

  const geometry = new THREE.PlaneGeometry(12, 12, segments.value, segments.value)
  // 关键：把旋转烘进顶点，着色器里 position.y 就真的是「高度」
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: amplitude.value },
      uFreq: { value: frequency.value },
      uLow: { value: new THREE.Color('#0c4a6e') },
      uHigh: { value: new THREE.Color('#7dd3fc') },
    },
    vertexShader,
    fragmentShader,
    wireframe: wireframe.value,
    side: THREE.DoubleSide,
  })

  mesh = new THREE.Mesh(geometry, material)
  stage.scene.add(mesh)

  stats.value = `顶点 ${vertexCount.value.toLocaleString()} · 三角形 ${(segments.value * segments.value * 2).toLocaleString()}`
}

function apply() {
  build()
}

function applyWireframe(value: any) {
  if (mesh) mesh.material.wireframe = value
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 7.5, 13], background: '#050a12' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  const grid = new THREE.GridHelper(20, 20, 0x14344d, 0x0d2333)
  grid.position.y = -2.2
  scene.add(grid)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.1
  controls.target.set(0, 0, 0)
  controls.update()

  build()

  stage.onFrame((dt: number) => {
    controls?.update()
    if (mesh) {
      mesh.material.uniforms.uTime.value += dt
      mesh.material.uniforms.uAmp.value = amplitude.value
      mesh.material.uniforms.uFreq.value = frequency.value
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
  '顶点着色器是唯一能移动顶点的阶段。它在 GPU 上对每个顶点执行一次，输入是 attribute（`position`、`uv`、`normal` 等）和 uniform，输出是 `gl_Position`（裁剪空间坐标）以及若干 `varying`。本页把一张 128×128 细分的平面按正弦函数抬高 `position.y`，形成实时起伏的海面——CPU 一个顶点都没碰。',
  '顶点位移的代价全在「细分」上：`PlaneGeometry(12, 12, 128, 128)` 是 16641 个顶点、32768 个三角形。段数不够，波形会变成折线；段数过高，GPU 顶点处理会先于片元成为瓶颈。移动端做波浪通常 64×64 就够，靠片元法线扰动补细节。',
  '位移之后法线也得跟着变，否则光照还是平的光照。两种做法：一是解析求导（本页对高度函数做有限差分，算出切向再叉乘得到法线）；二是 `geometry.computeVertexNormals()`——但那在 CPU 上，每帧调用会立刻掉帧。注意法线要乘 `normalMatrix` 才与观察空间一致。',
]

const blocks: CodeBlock[] = [
  {
    title: '顶点位移 + 解析法线',
    desc: '有限差分求偏导，再叉乘出法线',
    code: `uniform float uTime;
uniform float uAmp;
uniform float uFreq;

varying float vHeight;
varying vec3 vNormalW;

float wave(vec2 p, float t) {
  float h = sin(p.x * uFreq + t) * 0.6;
  h += cos(p.y * uFreq * 0.8 + t * 0.7) * 0.4;
  return h;
}

void main() {
  vec2 plane = vec2(position.x, position.z);
  float eps = 0.05;

  float h  = wave(plane, uTime);
  float hx = wave(plane + vec2(eps, 0.0), uTime);
  float hz = wave(plane + vec2(0.0, eps), uTime);

  vec3 n = normalize(vec3(-(hx - h) / eps, 1.0, -(hz - h) / eps));

  vec3 p = position;
  p.y += h * uAmp;

  vHeight = h;
  vNormalW = normalize(normalMatrix * n);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
  },
  {
    title: '几何体准备',
    desc: '把旋转烘进顶点，细分决定波形精度',
    code: `const geometry = new THREE.PlaneGeometry(12, 12, 128, 128)
geometry.rotateX(-Math.PI / 2)   // 烘进顶点，position.y 才是高度

// 段数对比：
// 32×32   → 波形有折角，远处还行
// 128×128 → 16k 顶点，细节足、移动端偏重
// 256×256 → 66k 顶点，通常过杀

const material = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uAmp: { value: 0.6 }, uFreq: { value: 1.4 } },
  vertexShader,
  fragmentShader,
  side: THREE.DoubleSide,
})`,
  },
  {
    title: '顶点着色器还能做什么',
    desc: '常见用途：位移、膨胀、公告板、实例化',
    code: `// 1. 沿法线膨胀（描边 / 爆炸图）
p += normal * uExpand;

// 2. 公告板：把顶点拉向屏幕平面，永远朝向相机
vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
mv.xy += position.xy;
gl_Position = projectionMatrix * mv;

// 3. 草地摆动：只让顶点上部动
float sway = sin(uTime * 2.0 + instanceMatrix[3].x) * 0.2;
p.x += sway * max(position.y, 0.0);`,
  },
]

const notes: NoteItem[] = [
  {
    title: '没有细分就没有形变',
    body: '顶点着色器只能移动已有顶点。`PlaneGeometry(12, 12, 1, 1)` 只有 4 个顶点，位移后只是一个倾斜的四边形。要平滑曲面必须先在 `widthSegments/heightSegments` 上付出顶点。',
  },
  {
    title: '法线别忘 normalMatrix',
    body: '`normal` 是局部空间法线，物体有非等比缩放时不能直接用，要乘 `normalMatrix`（`viewMatrix` 的法线矩阵）转到观察空间；与 `lightDir` 比较前还要统一空间。',
  },
  {
    title: '别每帧 CPU 重算法线',
    body: '`computeVertexNormals()` 会遍历所有三角面，1.6 万顶点每帧算一遍就是几毫秒。顶点位移优先在着色器里解析求导；确实要 CPU 修改时，把频率降到 10Hz 以下或转移到 Worker。',
  },
  {
    title: '视锥裁剪会误杀',
    body: '顶点被抬高后，`geometry.boundingSphere` 还是原平面的包围球，相机贴边时整个网格可能被裁掉。手动放大 `geometry.boundingSphere.radius`（或 `mesh.frustumCulled = false`）。',
  },
]
</script>

<template>
  <DemoPage
    hint="顶点着色器：16641 个顶点全部在 GPU 上位移，CPU 零参与。顺便演示如何用解析法线保住光照。"
    :init="init"
  >
    <template #panel>
      <span class="label">细分 {{ segments }}</span>
      <el-slider v-model="segments" :min="16" :max="200" :step="8" class="!w-28" @change="apply" />
      <span class="label">振幅 {{ amplitude.toFixed(2) }}</span>
      <el-slider v-model="amplitude" :min="0" :max="1.6" :step="0.05" class="!w-24" />
      <span class="label">频率 {{ frequency.toFixed(1) }}</span>
      <el-slider v-model="frequency" :min="0.2" :max="4" :step="0.1" class="!w-24" />
      <el-checkbox v-model="wireframe" size="small" @change="applyWireframe">线框</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="顶点着色器"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="顶点阶段只能改已有顶点，形变精度完全取决于细分密度。"
      />
    </template>
  </DemoPage>
</template>
