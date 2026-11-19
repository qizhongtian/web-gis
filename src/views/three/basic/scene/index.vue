<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const fogOn = ref(true)
const showHelpers = ref(true)

let stage: any = null
let fog: any = null
let city: any = null
let helpers: any = null

function applyFog() {
  if (stage) stage.scene.fog = fogOn.value ? fog : null
}

function applyHelpers() {
  if (helpers) helpers.visible = showHelpers.value
}

function init(THREE: any, el: HTMLElement) {
  stage = createStage(THREE, el, { position: [8, 5.5, 10], background: '#0a1a28' })
  const { scene } = stage

  // 雾与背景同色，远处物体才会「融进」背景而不是变灰
  fog = new THREE.Fog('#0a1a28', 10, 34)
  scene.fog = fogOn.value ? fog : null

  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9))
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(6, 10, 6)
  scene.add(sun)

  // Group：一整棵子树可以整体位移 / 旋转 / 显隐
  city = new THREE.Group()
  city.name = 'city'

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f2b40, roughness: 1, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  const palette = [0x22d3ee, 0x3b82f6, 0x60a5fa, 0x818cf8]
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const radius = 4 + (i % 3) * 1.6
    const height = 1.2 + (i % 4) * 0.7
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1, height, 1),
      new THREE.MeshStandardMaterial({
        color: palette[i % palette.length],
        metalness: 0.35,
        roughness: 0.35,
      }),
    )
    const ring = new THREE.Group() // 每栋楼自带一个父节点，方便单独摆位
    ring.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius)
    ring.rotation.y = -angle
    ring.add(block)

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.2 }),
    )
    cap.position.y = height / 2 + 0.45
    block.add(cap) // 子物体坐标是相对父级的局部坐标
    city.add(ring)
  }
  scene.add(city)

  helpers = new THREE.Group()
  helpers.add(new THREE.AxesHelper(3), new THREE.GridHelper(12, 12, 0x1e3a5f, 0x14293d))
  helpers.position.y = 0.001
  scene.add(helpers)
  helpers.visible = showHelpers.value

  stage.onFrame((dt: number) => {
    city.rotation.y += dt * 0.18
  })

  return () => {
    stage.dispose()
    stage = null
    fog = null
    city = null
    helpers = null
  }
}

const intro: string[] = [
  '`Scene` 是「舞台」，本身不渲染任何东西，只是一棵场景图（`Object3D` 树）的根节点：所有要显示的物体、灯光都要通过 `scene.add()` 挂到这棵树上，渲染器每帧从根开始遍历可见子树。因此「场景里什么都没有」和「物体没 add 进去」是两种最常见的空白画布原因。',
  '场景图是父子层级结构：父节点的位移、旋转、缩放会累计到子节点（`child.matrixWorld = parent.matrixWorld × child.matrix`）。建模时把一栋楼的窗、顶、招牌挂在一个 `Group` 下，就能整体移动这栋楼；`Group` 没有几何体，只是「空节点 + 变换」。',
  '`scene.background` 决定清屏颜色或天空盒，`scene.fog`（`Fog` / `FogExp2`）让远处物体按距离向雾色过渡，制造纵深并遮掉远处突然出现的边界。注意雾色与背景色一致才自然；雾是在材质着色阶段算的，所以它只影响内置材质，自定义 `ShaderMaterial` 需要自己加雾的代码。',
]

const blocks: CodeBlock[] = [
  {
    title: '创建场景与背景 / 雾',
    desc: '背景用颜色最省，天空盒可用 CubeTexture 或 equirect 贴图',
    code: `const scene = new THREE.Scene()
scene.background = new THREE.Color('#0a1a28')
scene.fog = new THREE.Fog('#0a1a28', 10, 34) // near 内无雾，far 外全雾

// 指数雾：密度更均匀，适合大范围户外
// scene.fog = new THREE.FogExp2('#0a1a28', 0.02)

// 天空盒：六张贴图或一张 equirect（配合 mapping）
// scene.background = new THREE.CubeTextureLoader().load([px, nx, py, ny, pz, nz])`,
  },
  {
    title: 'Group 组织层级',
    desc: 'Group 只提供变换与层级，没有几何体；父级变换会累计给子级',
    code: `const city = new THREE.Group()
city.name = 'city'          // 便于 scene.getObjectByName 查找
city.position.set(0, 0, 0)

const block = new THREE.Mesh(boxGeometry, boxMaterial)
const ring = new THREE.Group()          // 每栋楼的父节点
ring.position.set(x, y, z)
ring.rotation.y = -angle
ring.add(block)                         // block 坐标变成局部坐标
city.add(ring)

scene.add(city)
city.traverse((obj) => (obj.castShadow = true))`,
  },
  {
    title: '遍历与更新',
    desc: '只在需要时改属性；transform 变了 three 会自动把 matrixWorld 标脏',
    code: `// 每帧整体旋转：改父节点，子节点自动跟随
function render(dt) {
  city.rotation.y += dt * 0.18
  renderer.render(scene, camera)
}

// 想拿某类对象：按 name 或按类型过滤
const meshes = []
scene.traverse((obj) => {
  if (obj.isMesh) meshes.push(obj)
})

// 删除：从父节点移除后，记得释放它独占的几何体 / 材质
scene.remove(mesh)
mesh.geometry.dispose()
mesh.material.dispose()`,
  },
]

const notes: NoteItem[] = [
  {
    title: '空白画布先查这四项',
    body: '① 物体是否 `scene.add`；② 相机是否 `lookAt` 目标、是否在 `near/far` 范围外；③ 材质是否需要灯光（`MeshStandardMaterial` 无光即全黑）；④ 物体是否被父级 `visible = false` 或缩放成 0。',
  },
  {
    title: 'Fog 只对内置材质生效',
    body: '雾在内置材质的片元着色器里处理，`ShaderMaterial` / `RawShaderMaterial` 默认没有雾，需要 `fog: true` 并在着色器里手写 `fogFactor`。另外雾是线性插值到雾色，`transparent` 物体叠加雾会显脏。',
  },
  {
    title: '不要每帧 new 对象',
    body: '`new THREE.Vector3()`、`new THREE.Color()` 写进 `requestAnimationFrame` 会持续产生垃圾，低端机出现周期性掉帧。把临时向量提到模块作用域复用：`const tmp = new THREE.Vector3()`。',
  },
  {
    title: '大规模场景用可见性裁剪',
    body: '`Object3D.frustumCulled` 默认开启，但包围球是按几何体算的；对 InstancedMesh、骨骼动画要记得 `computeBoundingSphere()` 或手动给 `boundingSphere`，否则要么误裁剪要么永不被裁剪。',
  },
]
</script>

<template>
  <DemoPage hint="场景 Scene：背景色 + 线性雾、Group 层级组织、每帧只改父节点变换。" :init="init">
    <template #panel>
      <el-checkbox v-model="fogOn" size="small" @change="applyFog">雾</el-checkbox>
      <el-checkbox v-model="showHelpers" size="small" @change="applyHelpers">坐标轴 / 网格</el-checkbox>
      <span class="label">城市组整体绕 Y 轴旋转</span>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="场景 Scene"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="场景本身不渲染，排查空白画布按「挂载 → 相机 → 灯光 → 可见性」顺序查。"
      />
    </template>
  </DemoPage>
</template>
