<script setup lang="ts">
import { ref } from 'vue'
import DemoPage from '../../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { canvasTexture, createRoomEnvironment, createStage } from '@/utils/gis/threeStage'

const repeat = ref(3)
const rotation = ref(0)
const anisotropy = ref(1)
const wrap = ref<'repeat' | 'clamp' | 'mirror'>('repeat')
const info = ref('sRGB 采样正确（左侧）/ 错标 NoColorSpace（右侧）')

let T: any = null
let stage: any = null
let correctTexture: any = null
let wrongTexture: any = null
let maxAniso = 1

const WRAP: Record<string, string> = {
  repeat: 'RepeatWrapping',
  clamp: 'ClampToEdgeWrapping',
  mirror: 'MirroredRepeatWrapping',
}

function drawChecker(ctx: CanvasRenderingContext2D, size: number) {
  const cells = 8
  const cell = size / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#1d4ed8' : '#e2e8f0'
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  ctx.strokeStyle = '#f97316'
  ctx.lineWidth = size / 64
  ctx.strokeRect(0, 0, size, size)
  ctx.fillStyle = '#f97316'
  ctx.font = `bold ${size / 10}px sans-serif`
  ctx.fillText('UV', size * 0.06, size * 0.2)
}

function applyRepeat(value: any) {
  if (!correctTexture) return
  correctTexture.repeat.set(value, value)
  wrongTexture.repeat.set(value, value)
}

function applyRotation(value: any) {
  if (!correctTexture) return
  const rad = (value * Math.PI) / 180
  correctTexture.rotation = rad
  wrongTexture.rotation = rad
}

function applyAnisotropy(value: any) {
  if (!correctTexture) return
  correctTexture.anisotropy = value
  wrongTexture.anisotropy = value
  correctTexture.needsUpdate = true
  wrongTexture.needsUpdate = true
}

function applyWrap(value: 'repeat' | 'clamp' | 'mirror') {
  if (!T || !correctTexture) return
  const mode = T[WRAP[value] as keyof typeof T]
  correctTexture.wrapS = correctTexture.wrapT = mode
  wrongTexture.wrapS = wrongTexture.wrapT = mode
  // 改变 wrap / filter 需要重新上传纹理
  correctTexture.needsUpdate = true
  wrongTexture.needsUpdate = true
}

async function init(THREE: any, el: HTMLElement) {
  T = THREE
  stage = createStage(THREE, el, { position: [0, 2.2, 6], background: '#070f18' })
  const { scene, renderer } = stage
  maxAniso = renderer.capabilities.getMaxAnisotropy()
  anisotropy.value = Math.min(4, maxAniso)

  scene.add(new THREE.DirectionalLight(0xffffff, 2))
  const key = scene.children[0] as any
  key.position.set(4, 7, 5)
  await createRoomEnvironment(THREE, renderer, scene, 0.6)
  if (!stage) return

  correctTexture = canvasTexture(THREE, drawChecker, 256, true)
  correctTexture.repeat.set(repeat.value, repeat.value)
  correctTexture.anisotropy = anisotropy.value
  correctTexture.center.set(0.5, 0.5)

  // 故意标错色彩空间：对比 sRGB 解码缺失造成的偏色
  wrongTexture = correctTexture.clone()
  wrongTexture.colorSpace = THREE.NoColorSpace
  wrongTexture.needsUpdate = true

  const geometry = new THREE.BoxGeometry(2, 2, 2)
  const left = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: correctTexture, roughness: 0.5, metalness: 0.2 }))
  left.position.set(-1.6, 1.6, 0)
  scene.add(left)

  const right = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: wrongTexture, roughness: 0.5, metalness: 0.2 }))
  right.position.set(1.6, 1.6, 0)
  scene.add(right)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  stage.onFrame((dt: number) => {
    left.rotation.y += dt * 0.3
    right.rotation.y += dt * 0.3
  })

  return () => {
    stage.dispose()
    stage = null
    correctTexture = null
    wrongTexture = null
    T = null
  }
}

const intro: string[] = [
  '纹理是贴在几何体表面的图像，靠 UV 坐标采样。两种常用来源：外部图片（`TextureLoader`，jpg/png/ktx2）与程序化生成（`CanvasTexture` / `DataTexture` / `RenderTarget.texture`）。示例站为了不依赖外部资源，用 Canvas 画棋盘格，效果与图片纹理等价。',
  '平铺方式由 `wrapS / wrapT` 决定：`RepeatWrapping` 重复、`ClampToEdgeWrapping` 拉伸边缘像素、`MirroredRepeatWrapping` 镜像重复。`repeat` 控制平铺次数，`offset` 平移，`rotation` + `center` 旋转。注意改变 `wrap / anisotropy / minFilter` 后必须 `texture.needsUpdate = true` 才会重新上传到 GPU。',
  '采样质量靠 `anisotropy`（各向异性过滤）：地面、公路这类「斜着看」的表面，各向异性到 8~16 能显著减少远处模糊与摩尔纹，代价是采样次数增加。`minFilter` 默认带 mipmap 的三线性过滤，`magFilter` 通常保持线性；像素风素材要改成 `NearestFilter` 并关闭 mipmap。',
]

const blocks: CodeBlock[] = [
  {
    title: '程序化画布纹理',
    desc: 'CanvasTexture 适合生成网格、棋盘、文字标牌',
    code: `function draw(ctx, size) {
  const cells = 8
  const cell = size / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#1d4ed8' : '#e2e8f0'
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
}

const canvas = document.createElement('canvas')
canvas.width = canvas.height = 256
draw(canvas.getContext('2d'), 256)

const texture = new THREE.CanvasTexture(canvas)
texture.colorSpace = THREE.SRGBColorSpace
texture.needsUpdate = true`,
  },
  {
    title: '平铺、旋转与各向异性',
    desc: '改 wrap / 过滤后要 needsUpdate 才会上传',
    code: `texture.wrapS = texture.wrapT = THREE.RepeatWrapping
texture.repeat.set(4, 4)
texture.offset.set(0.1, 0.2)
texture.center.set(0.5, 0.5)
texture.rotation = Math.PI / 6

texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
texture.minFilter = THREE.LinearMipmapLinearFilter
texture.magFilter = THREE.LinearFilter

texture.needsUpdate = true    // wrap / anisotropy 变更后必须调用`,
  },
  {
    title: '色彩空间与数据纹理',
    desc: '颜色贴图 sRGB，法线 / 粗糙度等数据贴图保持线性',
    code: `const albedo = new THREE.TextureLoader().load('/tex/albedo.jpg')
albedo.colorSpace = THREE.SRGBColorSpace   // 颜色数据要解码

const normal = new THREE.TextureLoader().load('/tex/normal.jpg')
normal.colorSpace = THREE.NoColorSpace     // 数据不能解码

// 程序化生成数据纹理（噪声、高度图）
const data = new Uint8Array(64 * 64 * 4)
const heightTex = new THREE.DataTexture(data, 64, 64, THREE.RGBAFormat)
heightTex.needsUpdate = true`,
  },
]

const notes: NoteItem[] = [
  {
    title: '贴图尺寸尽量是 2 的幂',
    body: 'WebGL2 支持非 2 次幂纹理的 mipmap，但部分压缩格式、`repeat` 与三线性过滤仍有约束。UI 纹理、图标等非重复贴图用任意尺寸没问题，地形 / 路面这类重复贴图建议 512/1024。',
  },
  {
    title: '纹理要主动 dispose',
    body: '`texture.dispose()` 才会释放显存，`renderer.info.memory.textures` 是唯一可靠的观测指标。动态生成的 CanvasTexture（如每帧刷新的仪表盘）必须手动管理，否则显存持续增长。',
  },
  {
    title: '各向异性不是越高越好',
    body: '16× 各向异性在移动端有明显带宽开销，大面积地面才需要。只对「斜视角」的贴图开高值，其它保持 1~4。',
  },
  {
    title: '翻转 Y 轴（flipY）',
    body: 'three 默认 `flipY = true`，与多数图片格式的存储顺序匹配；但用 `DataTexture`、Canvas 或某些压缩格式时可能需要手动关闭，否则贴图上下颠倒。',
  },
]
</script>

<template>
  <DemoPage hint="纹理 Texture：程序化棋盘贴图、重复 / 旋转 / 各向异性，以及色彩空间对比。" :init="init">
    <template #panel>
      <span class="label">重复 {{ repeat }}</span>
      <el-slider v-model="repeat" :min="1" :max="8" :step="1" class="!w-24" @input="applyRepeat" />

      <span class="label">旋转 {{ rotation }}°</span>
      <el-slider v-model="rotation" :min="-180" :max="180" class="!w-24" @input="applyRotation" />

      <span class="label">各向异性 {{ anisotropy }} / {{ maxAniso }}</span>
      <el-slider v-model="anisotropy" :min="1" :max="maxAniso" :step="1" class="!w-24" @input="applyAnisotropy" />

      <el-select v-model="wrap" size="small" class="!w-28" @change="applyWrap">
        <el-option label="重复" value="repeat" />
        <el-option label="拉伸" value="clamp" />
        <el-option label="镜像" value="mirror" />
      </el-select>

      <el-tag size="small" type="info" effect="plain" class="!max-w-80 !truncate">{{ info }}</el-tag>
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="纹理 Texture"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="纹理三件事：wrap/repeat 管平铺、colorSpace 管颜色、anisotropy 管清晰度。"
      />
    </template>
  </DemoPage>
</template>
