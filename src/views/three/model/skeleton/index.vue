<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage, disposeObject } from '@/utils/gis/threeStage'
import { loadThreeAddon } from '@/utils/gis/threeLoader'
import { assetUrl } from '@/utils/publicUrl'

const bend = ref(0.6)
const showSkeleton = ref(true)
const info = ref('手写蒙皮：2 根骨骼驱动一根可弯曲的柱体')

let T: any = null
let stage: any = null
let skinned: any = null
let boneRoot: any = null
let boneMid: any = null
let skeletonHelper: any = null
let timed = false

function applyBend(value: any) {
  if (!boneMid) return
  boneMid.rotation.z = value
  boneMid.rotation.x = value * 0.6
}

function applySkeleton(value: any) {
  if (skeletonHelper) skeletonHelper.visible = value
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  timed = false
  stage = createStage(THREE, el, { position: [4.2, 3.4, 5.6], background: '#0a1a28' })
  const { scene, camera } = stage
  camera.lookAt(0, 1.6, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 8, 6)
  scene.add(key)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  scene.add(new THREE.GridHelper(12, 12, 0x24506e, 0x16324a))

  // 1. 几何体：一根 3 单位高的柱体，平移到 y ∈ [0, 3]
  const geometry = new THREE.CylinderGeometry(0.36, 0.36, 3, 24, 24, true)
  geometry.translate(0, 1.5, 0)

  // 2. 蒙皮数据：每个顶点最多受 4 根骨骼影响
  //    skinIndex = 骨骼下标，skinWeight = 权重（必须归一化到 1）
  const position = geometry.getAttribute('position')
  const skinIndices: number[] = []
  const skinWeights: number[] = []
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    // 0.6 ~ 1.8 之间从「全归骨骼 0」平滑过渡到「全归骨骼 1」
    const w1 = THREE.MathUtils.smoothstep(y, 0.6, 1.8)
    skinIndices.push(0, 1, 0, 0)
    skinWeights.push(1 - w1, w1, 0, 0)
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))

  // 3. 骨骼：父子 bone 构成骨架，bone 的变换会带动受它影响的顶点
  boneRoot = new THREE.Bone()
  boneRoot.name = 'root'
  boneMid = new THREE.Bone()
  boneMid.name = 'mid'
  boneMid.position.set(0, 1.5, 0) // 关节在柱体中间
  boneRoot.add(boneMid)

  const material = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    metalness: 0.35,
    roughness: 0.3,
    emissive: 0x0e7490,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  })

  skinned = new THREE.SkinnedMesh(geometry, material)
  skinned.add(boneRoot) // 骨架必须挂进场景图，才能每帧更新 matrixWorld
  skinned.updateMatrixWorld(true)

  // 4. 生成骨架并绑定：Skeleton 会记录每根骨骼的绑定逆矩阵
  const skeleton = new THREE.Skeleton([boneRoot, boneMid])
  skinned.bind(skeleton)
  scene.add(skinned)

  skeletonHelper = new THREE.SkeletonHelper(skinned)
  skeletonHelper.visible = showSkeleton.value
  scene.add(skeletonHelper)

  applyBend(bend.value)

  stage.onFrame((dt: number) => {
    if (timed) return
    bend.value = 0.35 + Math.sin(stage.clock.elapsedTime * 1.2) * 0.45
    applyBend(bend.value)
    void dt
  })

  return () => {
    stage.dispose()
    stage = null
    skinned = null
    boneRoot = null
    boneMid = null
    skeletonHelper = null
    T = null
  }
}

/** 加载一个真实骨骼动画模型，验证「同一套 skeleton / mixer 机制」 */
async function loadRealModel() {
  if (!stage || !T) return
  timed = true
  info.value = '加载骨骼动画模型…'
  try {
    const { GLTFLoader } = await loadThreeAddon('GLTFLoader')
    const gltf = await new Promise<any>((resolve, reject) => {
      new GLTFLoader().load(assetUrl('data/models/CesiumMilkTruck.glb'), resolve, undefined, reject)
    })
    if (!stage) return
    const object = gltf.scene
    object.position.set(0, 0, 0)
    object.scale.setScalar(0.9)
    stage.scene.add(object)
    const mixer = new T.AnimationMixer(object)
    gltf.animations?.forEach((clip: any) => mixer.clipAction(clip).play())
    stage.onFrame((dt: number) => mixer.update(dt))
    info.value = `已加载 CesiumMilkTruck.glb · 动画 ${gltf.animations?.length ?? 0} 段（节点动画，非蒙皮）`
  } catch (e: any) {
    info.value = `加载失败：${e?.message || e}`
  }
}

const intro: string[] = [
  '骨骼动画（蒙皮）的核心是「顶点跟着骨头走」：模型在建模软件里绑定一套骨架（`Bone` 层级），每个顶点记录「受哪几根骨骼影响、权重多少」，这两组数据以 `skinIndex` / `skinWeight` 属性写进 `BufferGeometry`。渲染时顶点着色器按骨骼的当前姿态矩阵做加权变换，所以骨骼动，网格就跟着弯。',
  '`SkinnedMesh` 把几何体、材质、骨架绑在一起。`Skeleton` 保存骨骼数组与每根骨骼的「绑定逆矩阵」（bindMatrixInverse），用于把顶点从模型空间换算到骨骼局部空间，再乘上骨骼当前的世界矩阵——`SkinnedMesh.bind(skeleton)` 做完这件事。骨架必须挂进场景图，否则 `matrixWorld` 不更新，模型会保持绑定姿态。',
  '实际项目里几乎不会手写蒙皮数据，都用 glTF / FBX 里已经做好的骨骼 + `AnimationClip`，用 `AnimationMixer` 播放。但要理解两个上限：一是每顶点最多 4 根骨骼影响（`skinWeight` 是 vec4），二是骨骼数量受 uniform 数量限制（大骨架要用纹理存矩阵，three 已支持）。',
]

const blocks: CodeBlock[] = [
  {
    title: '手写蒙皮属性',
    desc: 'skinIndex 是骨骼下标，skinWeight 必须每顶点归一化',
    code: `const geometry = new THREE.CylinderGeometry(0.36, 0.36, 3, 24, 24, true)
geometry.translate(0, 1.5, 0)

const position = geometry.getAttribute('position')
const skinIndices = []
const skinWeights = []

for (let i = 0; i < position.count; i++) {
  const y = position.getY(i)
  const w1 = THREE.MathUtils.smoothstep(y, 0.6, 1.8)  // 中间过渡
  skinIndices.push(0, 1, 0, 0)      // 受骨骼 0、1 影响
  skinWeights.push(1 - w1, w1, 0, 0)
}

geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))`,
  },
  {
    title: '骨架 + SkinnedMesh 绑定',
    desc: '先 updateMatrixWorld 再 new Skeleton，绑定逆矩阵才算得对',
    code: `const root = new THREE.Bone()
const mid = new THREE.Bone()
mid.position.set(0, 1.5, 0)
root.add(mid)

const mesh = new THREE.SkinnedMesh(geometry, material)
mesh.add(root)
mesh.updateMatrixWorld(true)          // 关键：骨骼世界矩阵要先就位

const skeleton = new THREE.Skeleton([root, mid])
mesh.bind(skeleton)
scene.add(mesh)

// 动画就是改骨骼的旋转
mid.rotation.z = Math.sin(t) * 0.5`,
  },
  {
    title: '加载真实骨骼动画',
    desc: 'glTF 的 skin + animation 由 Mixer 驱动，无需手动 bind',
    code: `new GLTFLoader().load('/models/character.glb', (gltf) => {
  scene.add(gltf.scene)

  const mixer = new THREE.AnimationMixer(gltf.scene)
  gltf.animations.forEach((clip) => mixer.clipAction(clip).play())

  // 每帧推进；crossFadeTo 做动作切换
  renderer.setAnimationLoop(() => {
    mixer.update(clock.getDelta())
    renderer.render(scene, camera)
  })
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: '骨骼必须先进入场景图',
    body: '`Bone` 只有挂在 `SkinnedMesh`（或场景）下，渲染时才会被 `updateMatrixWorld` 更新。漏挂的表现是：改骨骼旋转，模型纹丝不动。',
  },
  {
    title: '新增骨骼后要重新绑定',
    body: '运行期给骨架加骨骼，需要重新 `computeBoneTexture` / `bind`，否则蒙皮矩阵数量对不上。常规做法是建模阶段定好骨架，运行期只做动画与换装。',
  },
  {
    title: '骨骼动画不吃 frustumCulled 的默认包围球',
    body: '蒙皮变形后包围球不会自动扩张，大幅摆动的角色会被误裁剪。给 `mesh.geometry.boundingSphere` 手动放大，或 `mesh.frustumCulled = false`。',
  },
  {
    title: '一个模型一个 Mixer',
    body: 'Mixer 绑定的是根节点，多个模型共享会互相覆盖。切换动作用 `action.crossFadeTo(next, 0.3)`，并在切换后 `stop()` 旧动作，避免权重叠加。',
  },
]
</script>

<template>
  <DemoPage hint="骨骼动画：手写 skinIndex / skinWeight 与两根骨骼，SkeletonHelper 观察骨架。" :init="init">
    <template #panel>
      <span class="label">弯曲 {{ bend.toFixed(2) }}</span>
      <el-slider v-model="bend" :min="-1" :max="1" :step="0.01" class="!w-32" @input="applyBend" />
      <el-checkbox v-model="showSkeleton" size="small" @change="applySkeleton">显示骨架</el-checkbox>
      <el-button size="small" @click="loadRealModel">加载真实模型</el-button>
      <el-tag size="small" type="info" effect="plain" class="!max-w-80 !truncate">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="骨骼动画"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="蒙皮三要素：skinIndex / skinWeight / bindMatrix，缺一个就绑定姿态僵硬。"
      />
    </template>
  </DemoPage>
</template>
