<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const progress = ref(0)
const speed = ref(1)
const playing = ref(true)

let T: any = null
let stage: any = null
let curve: any = null
let car: any = null
let posText = ref('t = 0.000')
let tmpP: any = null
let tmpT: any = null

function applyProgress(value: any) {
  if (!curve || !car) return
  const t = ((value % 1) + 1) % 1
  curve.getPointAt(t, tmpP)
  curve.getTangentAt(t, tmpT)
  car.position.copy(tmpP)
  car.lookAt(tmpP.clone().add(tmpT))
  // 车头朝向切线；侧倾可以用上方向量兜底
  car.up.set(0, 1, 0)
  posText.value = `t = ${t.toFixed(3)} · (${tmpP.x.toFixed(1)}, ${tmpP.y.toFixed(1)}, ${tmpP.z.toFixed(1)})`
}

function buildTruck(THREE: any) {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5, roughness: 0.3 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 })
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 1.4 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.1), bodyMat)
  body.position.y = 0.22
  group.add(body)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 4), glowMat)
  nose.rotation.x = Math.PI / 2
  nose.rotation.z = Math.PI / 4
  nose.position.set(0, 0.22, 0.68)
  group.add(nose)

  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.32, 0.32]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), darkMat)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.13, z)
      group.add(wheel)
    }
  }
  return group
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  tmpP = new THREE.Vector3()
  tmpT = new THREE.Vector3()

  stage = createStage(THREE, el, { position: [0, 9, 12], background: '#0a1a28' })
  const { scene, camera } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(6, 10, 6)
  scene.add(key)

  // 闭合 Catmull-Rom 曲线：经过所有控制点，自动圆滑
  curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-5, 0.2, -3),
      new THREE.Vector3(-1.5, 0.2, 3.5),
      new THREE.Vector3(3.5, 1.6, 2.5),
      new THREE.Vector3(5.2, 0.2, -1.5),
      new THREE.Vector3(1.2, 0.2, -4.2),
      new THREE.Vector3(-3.4, 0.2, -4.6),
    ],
    true,
    'catmullrom',
    0.5,
  )
  curve.updateArcLengths()

  // 路径可视化：管道 + 中心线
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 320, 0.07, 8, true),
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0e7490,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.4,
    }),
  )
  scene.add(tube)

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(300)),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 }),
  )
  scene.add(line)

  // 控制点标记
  curve.points.forEach((point: any) => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    )
    dot.position.copy(point)
    scene.add(dot)
  })

  car = buildTruck(THREE)
  scene.add(car)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x0d2436, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  applyProgress(0)

  stage.onFrame((dt: number) => {
    if (!playing.value) return
    progress.value = (progress.value + dt * 0.06 * speed.value) % 1
    applyProgress(progress.value)
  })

  return () => {
    stage.dispose()
    stage = null
    curve = null
    car = null
    tmpP = null
    tmpT = null
    T = null
  }
}

const intro: string[] = [
  '路径动画 = 曲线（几何）+ 参数化（时间 → 0~1）+ 朝向对齐。`CatmullRomCurve3` 是过控制点的插值曲线，`closed: true` 时首尾自动平滑衔接；`getPointAt(t)` 按「弧长」取点（速度均匀），`getPoint(t)` 按「控制点参数」取点（拐弯处会忽快忽慢），运动类动画必须用 `getPointAt`。',
  '朝向用切线：`getTangentAt(t)` 给出该点的单位切向量，让物体 `lookAt(position + tangent)` 即可对准前进方向。注意 `Object3D.lookAt` 让物体的 +Z 对准目标（相机是 -Z），所以建模时车头要朝 +Z；如果模型朝 +X，需要先套一层 `Group` 旋转 90° 再动画。',
  '实际车辆/飞行器动画还要处理「侧倾」与「俯仰」：用切线与世界上方向叉乘得到右向量，再由重力 / 弯道曲率算 roll。无人机、船舶常用这种做法；简单场景用 `lookAt` + 固定的 up 就够了。',
]

const blocks: CodeBlock[] = [
  {
    title: '闭合曲线路径',
    desc: 'closed 让首尾相接；updateArcLengths 保证 getPointAt 均匀',
    code: `const curve = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-5, 0.2, -3),
    new THREE.Vector3(-1.5, 0.2, 3.5),
    new THREE.Vector3(3.5, 1.6, 2.5),
    new THREE.Vector3(5.2, 0.2, -1.5),
  ],
  true,          // 闭合
  'catmullrom',
  0.5,           // 张力，越大越「鼓」
)
curve.updateArcLengths()

// 路径可视化
const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.07, 8, true), tubeMat)`,
  },
  {
    title: '沿路径移动并对齐朝向',
    desc: '用弧长参数 getPointAt，朝向用切线 lookAt',
    code: `let t = 0
const point = new THREE.Vector3()
const tangent = new THREE.Vector3()

function render(dt) {
  t = (t + dt * 0.06 * speed) % 1    // 0~1 循环

  curve.getPointAt(t, point)          // 按弧长取点
  curve.getTangentAt(t, tangent)      // 单位切向量

  car.position.copy(point)
  car.lookAt(point.clone().add(tangent))
}`,
  },
  {
    title: '带弧长缓动的精确位置',
    desc: '已知总长与速度，直接换算 t；也能算「已行驶里程」',
    code: `const total = curve.getLength()

// 每秒前进 meters 米
function advance(dt, meters) {
  const delta = (meters * dt) / total
  t = (t + delta) % 1
}

// 反向：某点的里程
const traveled = t * total

// 需要更平滑的起停时，t 用缓动函数包一层
t = THREE.MathUtils.smoothstep(raw, 0, 1)`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'getPoint 与 getPointAt 的区别',
    body: '`getPoint(t)` 按控制点参数均匀分布，长段走得快、短段走得慢；`getPointAt(t)` 按弧长分布，速度一致。车辆 / 相机环绕这类运动一律用 `getPointAt`。',
  },
  {
    title: 'lookAt 的朝向轴是 +Z',
    body: '`Object3D.lookAt` 对齐 +Z，相机对齐 -Z。模型朝向不对时不要改曲线，先给模型套 `Group` 转 90° 或 180°，保持动画逻辑统一。',
  },
  {
    title: '曲线控制点过密会抖动',
    body: 'Catmull-Rom 经过所有控制点，点距突变时切线会翻转，出现「瞬移转头」。平滑处理：重采样控制点、降低张力、或改用 `curve.getSpacedPoints` 后再做平滑滤波。',
  },
  {
    title: 'TubeGeometry 面数很高',
    body: '320 段 × 8 段 ≈ 5000 三角形，用它画轨迹线太重。静态路径用 `Line` / `LineSegments`（1px），需要粗细稳定的线用 `Line2`（屏幕空间线宽）。',
  },
]
</script>

<template>
  <DemoPage hint="路径动画：闭合 Catmull-Rom 曲线、弧长参数化取点、切线对齐朝向与速度控制。" :init="init">
    <template #panel>
      <el-button size="small" :type="playing ? 'default' : 'primary'" @click="playing = !playing">
        {{ playing ? '暂停' : '播放' }}
      </el-button>

      <span class="label">t {{ progress.toFixed(3) }}</span>
      <el-slider v-model="progress" :min="0" :max="1" :step="0.001" class="!w-40" @input="applyProgress" />

      <span class="label">速度 {{ speed.toFixed(1) }}×</span>
      <el-slider v-model="speed" :min="0.2" :max="4" :step="0.1" class="!w-24" />

      <el-tag size="small" type="success" effect="plain">{{ posText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="路径动画"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="路径动画两点：弧长取点保速度均匀，切线对齐保朝向正确。"
      />
    </template>
  </DemoPage>
</template>
