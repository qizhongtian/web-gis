<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const count = ref(4000)
const gradient = ref(true)
const shake = ref(false)
const stats = ref('')

let T: any = null
let stage: any = null
let instanced: any = null
let dummyMatrix: any = null
let baseMatrices: any[] = []
let statsAcc = 0

function build() {
  if (!stage || !T) return
  const THREE = T
  if (instanced) {
    stage.scene.remove(instanced)
    instanced.dispose()
    instanced = null
  }

  const total = count.value
  const geometry = new THREE.BoxGeometry(0.22, 1.2, 0.22)
  const material = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.35 })
  instanced = new THREE.InstancedMesh(geometry, material, total)
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  dummyMatrix = new THREE.Object3D()
  baseMatrices = []
  const side = Math.ceil(Math.sqrt(total))
  const color = new THREE.Color()

  for (let i = 0; i < total; i++) {
    const x = (i % side) - side / 2
    const z = Math.floor(i / side) - side / 2
    const dist = Math.sqrt(x * x + z * z)
    const height = 0.6 + Math.max(0, 2.6 - dist * 0.32) * (0.4 + Math.random() * 0.6)

    dummyMatrix.position.set(x * 0.32, height / 2, z * 0.32)
    dummyMatrix.scale.set(1, height, 1)
    dummyMatrix.rotation.y = Math.random() * Math.PI
    dummyMatrix.updateMatrix()
    instanced.setMatrixAt(i, dummyMatrix.matrix)
    baseMatrices.push(dummyMatrix.matrix.clone())

    const t = Math.min(1, dist / (side * 0.5))
    color.setHSL(0.58 - t * 0.12, 0.75, gradient.value ? 0.35 + (1 - t) * 0.4 : 0.55)
    instanced.setColorAt(i, color)
  }

  instanced.instanceMatrix.needsUpdate = true
  if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
  // 实例化后包围球不会自动覆盖所有实例，手动算一次避免被误裁剪
  instanced.computeBoundingSphere()
  stage.scene.add(instanced)

  stats.value = `实例 ${total.toLocaleString()} · 几何体 1 份 · 理论 DrawCall 1 次`
}

function applyCount() {
  build()
}

function applyGradient() {
  build()
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 6.5, 12], background: '#0a1a28' })
  const { scene, camera } = stage
  camera.lookAt(0, 1, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(6, 10, 6)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0d2436, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  build()

  stage.onFrame((dt: number) => {
    if (instanced) {
      instanced.rotation.y += dt * 0.08
      instanced.rotation.x = 0
    }
    if (shake.value && instanced) {
      // 每帧改全部实例矩阵：这就是 InstancedMesh 的「CPU 上限」演示
      const t = stage.clock.elapsedTime
      for (let i = 0; i < instanced.count; i++) {
        // 直接复用基础矩阵，只改平移分量（elements[13] = ty）
        dummyMatrix.matrix.copy(baseMatrices[i])
        dummyMatrix.matrix.elements[13] += Math.sin(t * 3 + i) * 0.05
        instanced.setMatrixAt(i, dummyMatrix.matrix)
      }
      instanced.instanceMatrix.needsUpdate = true
    }

    statsAcc += dt
    if (statsAcc > 0.5) {
      statsAcc = 0
      const info = stage.renderer.info.render
      stats.value = `实例 ${instanced?.count ?? 0} · DrawCall ${info.calls} · 三角形 ${info.triangles.toLocaleString()}`
    }
  })

  return () => {
    stage.dispose()
    stage = null
    instanced = null
    dummyMatrix = null
    baseMatrices = []
    T = null
  }
}

const intro: string[] = [
  '`InstancedMesh` 用一次 DrawCall 画出成百上千个「同几何体、同材质」的实例：顶点数据只上传一份，每个实例额外带一个 4×4 的实例矩阵（`instanceMatrix`），可以在着色器里把这些矩阵展开成各自的变换。城市里的树、路灯、车辆，粒子化的方块云，都适合它。',
  '用法核心是一个「模板 `Object3D`」：给 dummy 设 position / rotation / scale，`updateMatrix()` 后 `setMatrixAt(i, dummy.matrix)`；全部填完 `instanceMatrix.needsUpdate = true`。颜色用 `setColorAt(i, color)` 写进 `instanceColor`，配合材质的 `vertexColors` 自动生效（材质本身不需要 vertexColors，实例色是独立通道）。',
  '实例化的边界要清楚：所有实例共享同一份 geometry / material，不能单独换模型或换材质；每个实例能单独控制变换与颜色，复杂差异（不同贴图、不同拓扑）就得退回多个 Mesh 或分批 InstancedMesh。另外每帧改 `instanceMatrix` 需要把整个矩阵缓冲重新上传，几万个实例会明显吃 CPU，动态位移建议交给着色器（自定义 `InstancedBufferAttribute` + 顶点着色器）。',
]

const blocks: CodeBlock[] = [
  {
    title: '创建实例化网格',
    desc: 'dummy 模板 + setMatrixAt，最后置 needsUpdate',
    code: `const geometry = new THREE.BoxGeometry(0.22, 1.2, 0.22)
const material = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.35 })

const mesh = new THREE.InstancedMesh(geometry, material, 4000)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

const dummy = new THREE.Object3D()
const color = new THREE.Color()

for (let i = 0; i < 4000; i++) {
  dummy.position.set(x, y, z)
  dummy.rotation.y = Math.random() * Math.PI
  dummy.scale.set(1, height, 1)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  mesh.setColorAt(i, color.setHSL(0.58, 0.75, 0.5))
}

mesh.instanceMatrix.needsUpdate = true
mesh.instanceColor.needsUpdate = true
scene.add(mesh)`,
  },
  {
    title: '拾取与包围体',
    desc: '射线命中后从 instanceId 反查实例数据',
    code: `const hit = raycaster.intersectObject(mesh, false)[0]
if (hit) {
  const index = hit.instanceId          // 第几个实例
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  const position = new THREE.Vector3().setFromMatrixPosition(matrix)
  mesh.setColorAt(index, new THREE.Color('#f97316'))
  mesh.instanceColor.needsUpdate = true
}

// 实例分布超出几何体包围球时，手动算一次
mesh.computeBoundingSphere()`,
  },
  {
    title: '动态实例（建议交给 GPU）',
    desc: '每实例自定义属性，位移在顶点着色器里算',
    code: `const offsets = new Float32Array(count * 3)
// ... 填充偏移
geometry.setAttribute(
  'aOffset',
  new THREE.InstancedBufferAttribute(offsets, 3),
)

// 顶点着色器里：
// vec3 transformed = position + aOffset;
// 或在 onBeforeCompile 中注入，保留 PBR 光照`,
  },
]

const notes: NoteItem[] = [
  {
    title: '一次 DrawCall ≠ 零成本',
    body: '实例化的收益在 CPU 提交次数，GPU 仍要处理每个实例的顶点。几万个高面数实例照样掉帧，LOD / 视距裁剪 / 降低几何体面数依然要做。',
  },
  {
    title: 'count 可以动态调小',
    body: '`mesh.count = n` 只渲染前 n 个实例，不必重建对象；这比反复增删 Mesh 高效得多，适合「逐步加载 / 分批出现」的效果。',
  },
  {
    title: '每帧 update 矩阵开销大',
    body: '`instanceMatrix.needsUpdate = true` 会把整个 Float32Array 重新上传。1 万个实例 = 64 万个浮点，每帧上传会吃满带宽；静态实例只在初始化时上传一次。',
  },
  {
    title: '实例色需要材质支持',
    body: '`setColorAt` 依赖 `instanceColor` 属性，材质会自动注入对应逻辑；若自定义 `ShaderMaterial`，要自己声明 `instanceColor` 并在片元里相乘。',
  },
]
</script>

<template>
  <DemoPage hint="InstancedMesh：一份几何体渲染数千实例，实例矩阵 / 实例色与动态更新的代价。" :init="init">
    <template #panel>
      <span class="label">实例数 {{ count }}</span>
      <el-slider v-model="count" :min="500" :max="12000" :step="500" class="!w-40" @change="applyCount" />
      <el-checkbox v-model="gradient" size="small" @change="applyGradient">实例色渐变</el-checkbox>
      <el-checkbox v-model="shake" size="small">每帧更新矩阵</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ stats }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="InstancedMesh"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="实例化的收益是 CPU 提交，GPU 顶点量不会变少。"
      />
    </template>
  </DemoPage>
</template>
