<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { createStage } from '@/utils/gis/threeStage'

const hoverText = ref('悬停未命中')
const pickText = ref('点击任意立方体')

let T: any = null
let stage: any = null
let raycaster: any = null
let pointer: any = null
let cubes: any[] = []
let hovered: any = null
let selected: any = null

function setHover(next: any) {
  if (hovered === next) return
  if (hovered) {
    hovered.material.emissiveIntensity = 0.15
    hovered.scale.setScalar(1)
  }
  hovered = next
  if (hovered) {
    hovered.material.emissiveIntensity = 1.4
    hovered.scale.setScalar(1.08)
    hoverText.value = `悬停 #${hovered.userData.index} · ${hovered.userData.name}`
  } else {
    hoverText.value = '悬停未命中'
  }
}

function setSelected(next: any) {
  if (selected) selected.material.emissive.setHex(0x0e7490)
  selected = next
  if (!selected) return
  selected.material.emissive.setHex(0xf97316)
  selected.material.emissiveIntensity = 1.2
  pickText.value = `选中 #${selected.userData.index} · ${selected.userData.name}`
}

function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 6.5, 10], background: '#0a1a28' })
  const { scene, camera, renderer } = stage
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x0b1220, 1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(5, 9, 6)
  scene.add(key)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  const names = ['基站', '机房', '变电站', '水厂', '泵站']
  const base = new THREE.BoxGeometry(0.9, 0.9, 0.9)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const index = row * 4 + col
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.55 + index * 0.012, 0.55, 0.5),
        emissive: 0x0e7490,
        emissiveIntensity: 0.15,
        metalness: 0.4,
        roughness: 0.35,
      })
      const cube = new THREE.Mesh(base, material)
      cube.position.set((col - 1.5) * 1.7, 0.45 + (index % 3) * 0.35, (row - 1.5) * 1.7)
      cube.userData = { index, name: names[index % names.length] }
      scene.add(cube)
      cubes.push(cube)
    }
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x102a3d, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const canvas = renderer.domElement
  const toPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  const onMove = (event: PointerEvent) => {
    toPointer(event)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(cubes, false)
    setHover(hits[0]?.object ?? null)
    canvas.style.cursor = hits.length ? 'pointer' : 'default'
  }

  const onDown = (event: PointerEvent) => {
    toPointer(event)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(cubes, false)
    setSelected(hits[0]?.object ?? null)
  }

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerdown', onDown)

  stage.onFrame((dt: number) => {
    // 轻微上下浮动：验证「矩阵每帧变化后射线拾取依然准确」
    const t = stage.clock.elapsedTime
    cubes.forEach((cube: any, i: number) => {
      cube.position.y = 0.45 + (i % 3) * 0.35 + Math.sin(t * 1.4 + i * 0.4) * 0.12
    })
    void dt
  })

  return () => {
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerdown', onDown)
    stage.dispose()
    stage = null
    raycaster = null
    pointer = null
    cubes = []
    hovered = null
    selected = null
    T = null
  }
}

const intro: string[] = [
  '射线拾取的本质是：把屏幕坐标反投影成一条从相机出发的空间射线，再和场景中的几何体求交。`Raycaster.setFromCamera(ndc, camera)` 负责前半段，`intersectObjects(objects, recursive)` 负责后半段，返回按距离升序排列的命中数组，`hits[0]` 就是最近的那个。',
  'NDC（标准化设备坐标）换算必须用画布的真实显示尺寸：`x = (clientX - rect.left) / rect.width * 2 - 1`，`y` 轴要取反（屏幕向下为正，NDC 向上为正）。常见错误是用 `offsetWidth` 或忘记了画布 CSS 尺寸与 `drawingBuffer` 尺寸被 `setPixelRatio` 区分开——拾取偏移就是这么来的。',
  '求交本身是 CPU 计算：先用包围球快速排除，再逐三角形测试。几十个物体没问题，上万个就要优化：给静态物体建 BVH（three-mesh-bvh）、把可拾取对象放进单独数组或 `layers`、只对 `recursive: false` 的顶层做一次命中再向下找，或者干脆用 GPU 拾取（颜色编码渲染一帧）。',
]

const blocks: CodeBlock[] = [
  {
    title: '屏幕坐标 → 射线 → 命中',
    desc: 'NDC 换算 + setFromCamera，命中按距离排序',
    code: `const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(pickables, false)
  if (hits.length) {
    const { object, point, distance, face } = hits[0]
    console.log(object.userData, point, distance, face?.normal)
  }
}`,
  },
  {
    title: '常用求交参数',
    desc: 'threshold 对点/线生效；firstHitOnly 需要 BVH 插件支持',
    code: `// 点精灵的命中半径（世界单位）
raycaster.params.Points.threshold = 0.2
// 线宽命中容差
raycaster.params.Line.threshold = 0.1

// 递归：objects 传 Group 时设 true 会遍历子树
raycaster.intersectObjects([buildingGroup], true)

// 只要最近一个：自己截断，避免无谓的全量排序
const hits = raycaster.intersectObjects(pickables, false)
const nearest = hits.length ? hits[0].object : null`,
  },
  {
    title: '高亮与恢复',
    desc: '共享材质会被一起改色，交互物体建议每个实例 clone 一份',
    code: `function setHover(obj) {
  if (hovered === obj) return
  if (hovered) {
    hovered.material.emissiveIntensity = 0.15
    hovered.scale.setScalar(1)
  }
  hovered = obj
  if (obj) {
    obj.material.emissiveIntensity = 1.4
    obj.scale.setScalar(1.08)
  }
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '坐标要用 getBoundingClientRect',
    body: '画布可能被缩放（CSS 宽高 ≠ 绘制宽高）、被父容器偏移、或嵌入滚动页。用 `getBoundingClientRect()` 取实时矩形，别用 `offsetLeft / clientWidth` 拼。',
  },
  {
    title: 'intersectObjects 传的是数组',
    body: '`intersectObject(obj, true)` 是单对象版本，`intersectObjects([...], recursive)` 是数组版本。传数组且 `recursive: false` 时只测数组里的对象本身，Group 内部不会被命中。',
  },
  {
    title: '每帧拾取要节流',
    body: '把 `pointermove` 里的求交直接做成渲染事件，鼠标移动越快越卡。常见做法是事件里只记录坐标，在实际渲染帧里再做一次拾取（或用 `requestAnimationFrame` 合并）。',
  },
  {
    title: '被遮挡也算命中',
    body: '射线与「所有」相交物体都算命中，即使它被墙挡住。需要「只拾取看得见的」时，从最近命中往上检查是否被不透明物体遮挡，或用 GPU 拾取（深度判断由显卡完成）。',
  },
]
</script>

<template>
  <DemoPage hint="射线拾取 Raycaster：NDC 反投影、命中最近对象、悬停高亮与点击选中。" :init="init">
    <template #panel>
      <el-tag size="small" type="info" effect="plain">{{ hoverText }}</el-tag>
      <el-tag size="small" type="warning" effect="plain">{{ pickText }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="射线拾取"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="拾取偏移九成是 NDC 算错；拾取卡顿则要减少候选对象或改用 BVH。"
      />
    </template>
  </DemoPage>
</template>
