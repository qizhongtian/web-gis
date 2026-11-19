<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'

const curveType = ref<'catmullrom' | 'centripetal' | 'chordal'>('centripetal')
const tension = ref(0.5)
const spaced = ref(true)
const running = ref(true)
const stats = ref('')

let T: any = null
let stage: any = null
let controls: any = null
let group: any = null
let curve: any = null
let tube: any = null
let marker: any = null
let markerDot: any = null
let samples: any = null
let progress = 0

// 控制点：一条起伏的闭合环线（y 方向做正弦扰动）
const CONTROL_POINTS = [
  [-3.2, 0.6, 0],
  [-1.8, 1.9, 2.2],
  [0.6, 0.2, 3.1],
  [2.8, 1.6, 1.6],
  [3.2, 0.4, -0.8],
  [1.2, 2.1, -2.6],
  [-1.4, 0.3, -3.0],
  [-3.0, 1.4, -1.6],
]

function buildCurve() {
  const THREE = T
  const points = CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  // curveType 决定插值方式；tension 只在 catmullrom 下生效
  return new THREE.CatmullRomCurve3(
    points,
    true,
    curveType.value,
    curveType.value === 'catmullrom' ? tension.value : undefined,
  )
}

function clearGroup() {
  if (!group) return
  group.traverse((obj: any) => {
    obj.geometry?.dispose?.()
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material]
      list.forEach((m: any) => m.dispose?.())
    }
  })
  stage.scene.remove(group)
  group = null
}

function build() {
  if (!stage || !T) return
  const THREE = T
  clearGroup()

  group = new THREE.Group()
  curve = buildCurve()
  stage.scene.add(group)

  // 1. 管道几何：曲线只是数学对象，TubeGeometry 把它变成可见的网格
  const tubularSegments = 240
  const radialSegments = 12
  tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, 0.075, radialSegments, true),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.3, roughness: 0.35 }),
  )
  group.add(tube)

  // 2. 控制点
  const dotGeo = new THREE.SphereGeometry(0.085, 16, 16)
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x8a5a00, emissiveIntensity: 0.4 })
  for (const p of curve.points) {
    const dot = new THREE.Mesh(dotGeo, dotMat)
    dot.position.copy(p)
    group.add(dot)
  }

  // 3. 采样点：对比「参数均匀」与「弧长均匀」的疏密差异
  samples = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x7a1240, emissiveIntensity: 0.5 }),
    48,
  )
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 48; i++) {
    const t = i / 48
    // getPoint 按参数 t 取点，getPointAt 按弧长取点
    const p = spaced.value ? curve.getPointAt(t) : curve.getPoint(t)
    dummy.position.copy(p)
    dummy.updateMatrix()
    samples.setMatrixAt(i, dummy.matrix)
  }
  samples.instanceMatrix.needsUpdate = true
  samples.computeBoundingSphere()
  group.add(samples)

  // 4. 沿曲线运动的小球（用弧长参数保证匀速）
  marker = new THREE.Object3D()
  markerDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x22d3ee, emissiveIntensity: 1.2 }),
  )
  marker.add(markerDot)
  group.add(marker)

  const length = curve.getLength()
  const triangles = tubularSegments * radialSegments * 2
  stats.value = `曲线长 ${length.toFixed(2)} · 管道 ${triangles.toLocaleString()} 三角形 · ${spaced.value ? '弧长' : '参数'}采样`
}

function updateMarker() {
  if (!curve || !marker) return
  const t = progress % 1
  const p = curve.getPointAt(t)
  const tangent = curve.getTangentAt(t)
  marker.position.copy(p)
  // 让小球朝向切线方向（+Z 为前方）
  marker.lookAt(p.clone().add(tangent))
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [7.5, 6, 9], background: '#0b1220' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0.8, 0)

  scene.add(new THREE.HemisphereLight(0xc7e2ff, 0x0b1220, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 9, 5)
  scene.add(key)

  const grid = new THREE.GridHelper(22, 22, 0x1e3a5f, 0x14293f)
  grid.position.y = -0.2
  scene.add(grid)

  const { OrbitControls } = await loadThreeAddon('OrbitControls')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set(0, 0.8, 0)
  controls.update()

  build()

  stage.onFrame((dt: number) => {
    controls?.update()
    if (running.value) {
      // 速度按「曲线长的百分比/秒」，与曲线总长无关
      progress += dt * 0.12
      updateMarker()
    }
  })

  return () => {
    controls?.dispose()
    controls = null
    stage.dispose()
    stage = null
    group = null
    curve = null
    tube = null
    marker = null
    markerDot = null
    samples = null
    T = null
  }
}

function apply() {
  build()
  updateMarker()
}

const intro: string[] = [
  '曲线在 three 里是纯数学对象（`Curve` 的子类），本身不能被渲染。常见的用法是：用它生成几何体（`TubeGeometry` / `ExtrudeGeometry` / `ShapeGeometry`），或者用它驱动运动（相机漫游、车辆轨迹、镜头路径）。示例里的 `CatmullRomCurve3` 只需几个控制点，就会插值出一条过点的平滑曲线，`closed: true` 让它首尾相接。',
  '两个采样函数必须分清：`getPoint(t)` 的 `t` 是「参数域」上的比例，控制点之间距离不等时点会疏密不均；`getPointAt(t)` 内部先按弧长重参数化，`t` 就是「走完全程的百分比」，适合匀速运动与等距布点。示例里切换「弧长采样」就能看到粉点密度的变化。',
  '`curveType` 决定切线估计方式：`centripetal`（向心）最稳，能避免控制点密集处打圈；`chordal` 更贴近折线；`catmullrom` 受 `tension` 影响，张力大曲线更「鼓」。`getSpacedPoints(n)` 返回 n+1 个等弧长点，做路径关键帧最省事。',
]

const blocks: CodeBlock[] = [
  {
    title: '建曲线 + 管道可视化',
    desc: '控制点 → CatmullRomCurve3 → TubeGeometry',
    code: `const points = [
  new THREE.Vector3(-3, 0.6, 0),
  new THREE.Vector3(-1.8, 1.9, 2.2),
  // ...
]

const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal')

// 管道：tubularSegments 沿曲线细分，radialSegments 是截面圆周细分
const geometry = new THREE.TubeGeometry(curve, 240, 0.075, 12, true)
scene.add(new THREE.Mesh(geometry, material))

curve.getLength()      // 弧长（闭合曲线会包含收尾段）
curve.getPoints(50)    // 51 个参数均匀点
curve.getSpacedPoints(50) // 51 个弧长均匀点`,
  },
  {
    title: '沿曲线匀速运动',
    desc: 'getPointAt + getTangentAt，让物体朝向切线',
    code: `let progress = 0

function update(dt) {
  progress = (progress + dt * 0.12) % 1

  const p = curve.getPointAt(progress)     // 弧长参数：匀速
  const tangent = curve.getTangentAt(progress)

  mesh.position.copy(p)
  mesh.lookAt(p.clone().add(tangent))      // 朝向行进方向
}

// 若用 getPoint，控制点疏密不均会导致忽快忽慢`,
  },
  {
    title: '曲线参与建模',
    desc: 'ExtrudeGeometry / Shape 与 CurvePath 组合',
    code: `// 2D 轮廓 + 厚度 = 3D 模型
const shape = new THREE.Shape()
shape.moveTo(0, 0)
shape.lineTo(1, 0)
shape.quadraticCurveTo(1.4, 0.6, 1, 1.2)
shape.lineTo(0, 1.2)

const mesh = new THREE.Mesh(
  new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.03 }),
  material,
)

// 多条曲线拼接成路径
const path = new THREE.CurvePath()
path.add(new THREE.LineCurve3(a, b))
path.add(new THREE.QuadraticBezierCurve3(b, c, d))
path.getPointAt(0.5)`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'getPoint 不是匀速',
    body: '`getPoint(t)` 的 t 是参数域比例，控制点间距不等时角速度就不等。动画、相机漫游、等距布点一律用 `getPointAt`；它内部维护了长度缓存，首次调用会稍慢。',
  },
  {
    title: '控制点太密会过冲',
    body: '`catmullrom` 在控制点密集处容易「鼓包」，`tension` 调大更明显。想稳就用 `centripetal`，或改用 `CurvePath` 拼贝塞尔段手动控制切线。',
  },
  {
    title: '管道面数 = 2 × 段数乘积',
    body: '`TubeGeometry(curve, 240, r, 12)` 是 240×12×2 ≈ 5760 个三角形。曲线只用于视觉装饰时把 `tubularSegments` 降到 64 级别，远处几乎看不出差别。',
  },
  {
    title: '曲线改了点要重建几何',
    body: '几何体在构建时就把曲线采样写进顶点缓冲，之后改控制点不会自动更新。动态曲线要么重建 `TubeGeometry`（记得 dispose 旧的），要么自己按帧更新 position 属性。',
  },
]

function applyType() {
  apply()
}
</script>

<template>
  <DemoPage
    hint="Curve：用少量控制点得到平滑路径，再喂给 TubeGeometry 或用于匀速运动。注意 getPoint 与 getPointAt 的区别。"
    :init="init"
  >
    <template #panel>
      <span class="label">插值</span>
      <el-select v-model="curveType" size="small" class="!w-32" @change="applyType">
        <el-option label="centripetal" value="centripetal" />
        <el-option label="chordal" value="chordal" />
        <el-option label="catmullrom" value="catmullrom" />
      </el-select>
      <span class="label">张力 {{ tension.toFixed(2) }}</span>
      <el-slider
        v-model="tension"
        :min="0"
        :max="1"
        :step="0.05"
        :disabled="curveType !== 'catmullrom'"
        class="!w-28"
        @change="apply"
      />
      <el-checkbox v-model="spaced" size="small" @change="apply">弧长采样</el-checkbox>
      <el-checkbox v-model="running" size="small">运动</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="Curve 曲线"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="曲线负责「路径」，几何体负责「外观」，两者分开看。"
      />
    </template>
  </DemoPage>
</template>
