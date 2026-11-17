<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { createTerrainProvider, defaultMeshTilesetUrl, defaultTerrainServiceUrl } from '@/utils/gis/cesiumConfig'

/**
 * 地形贴地图标 + 文字：Canvas 出图 → 多边形纹理 → 贴地
 *
 * 不用 billboard / label：那两个永远朝向屏幕（竖在空中的牌子）。
 * 把「图标 + 文字」画进 Canvas，作为贴地多边形的纹理铺在地表：
 *   · 平地上文字平铺，山坡上文字跟着地形起伏
 *   · 旋转 / 俯仰相机时文字始终属于地面，不转向屏幕
 *   · 纹理按经纬度轴对齐，永远是「上北下南」
 */

type DisplayMode = 'both' | 'text' | 'icon'
type SurfaceMode = 'TERRAIN' | 'BOTH'

interface LabelPoint {
  id: string
  name: string
  lon: number
  lat: number
  color: string
  /** 重要性分级：相机越高只保留级别越小的点，避免满屏标注 */
  level: number
}

const PALETTE = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0284c7', '#ca8a04']

/** 演示点位：只有经纬度，没有高程（贴地靠多边形投影，不需要高程） */
const RAW_POINTS = [
  { id: 'HK-01', name: '国际金融中心', lon: 114.1598, lat: 22.2857 },
  { id: 'HK-02', name: '中环码头', lon: 114.16218, lat: 22.28698 },
  { id: 'HK-03', name: '中环街市', lon: 114.1553, lat: 22.2846 },
  { id: 'HK-04', name: '半山扶梯', lon: 114.152, lat: 22.283 },
  { id: 'HK-05', name: '香港公园', lon: 114.1605, lat: 22.2775 },
  { id: 'HK-06', name: '金钟', lon: 114.1663, lat: 22.279 },
  { id: 'HK-07', name: '太平山顶', lon: 114.144, lat: 22.271 },
  { id: 'HK-08', name: '湾仔', lon: 114.1733, lat: 22.2775 },
  { id: 'HK-09', name: '尖沙咀钟楼', lon: 114.1694, lat: 22.293 },
  { id: 'HK-10', name: '西九龙', lon: 114.16, lat: 22.305 },
  { id: 'HK-11', name: '香港大学', lon: 114.137, lat: 22.284 },
  { id: 'HK-12', name: '铜锣湾', lon: 114.185, lat: 22.28 },
  { id: 'HK-13', name: '跑马地', lon: 114.183, lat: 22.2705 },
  { id: 'HK-14', name: '坚尼地城', lon: 114.127, lat: 22.282 },
  { id: 'HK-15', name: '北角', lon: 114.2, lat: 22.291 },
  { id: 'HK-16', name: '鲗鱼涌', lon: 114.213, lat: 22.287 },
  { id: 'HK-17', name: '红磡', lon: 114.187, lat: 22.305 },
  { id: 'HK-18', name: '旺角', lon: 114.1694, lat: 22.3193 },
  { id: 'HK-19', name: '油麻地', lon: 114.17, lat: 22.31 },
  { id: 'HK-20', name: '九龙塘', lon: 114.176, lat: 22.337 },
  { id: 'HK-21', name: '香港仔', lon: 114.155, lat: 22.248 },
  { id: 'HK-22', name: '海洋公园', lon: 114.17, lat: 22.24 },
  { id: 'HK-23', name: '沙田', lon: 114.1878, lat: 22.3774 },
  { id: 'HK-24', name: '青衣', lon: 114.1073, lat: 22.3444 },
]

/**
 * 重要性分级：相机越高只保留级别越小的点（1 最优先）。
 * 重点点位刻意分散到港岛、九龙、新界，拉远时才不会挤在一处被去重掉。
 */
const LEVEL_HINTS: Record<string, number> = {
  'HK-01': 1, // 中环
  'HK-07': 1, // 太平山顶
  'HK-09': 1, // 尖沙咀
  'HK-18': 1, // 旺角
  'HK-02': 2,
  'HK-03': 2,
  'HK-05': 2,
  'HK-06': 2,
  'HK-08': 2,
  'HK-10': 2,
}

const POINT_TIERS = [
  { label: '12 个点位（示范）', value: 12 },
  { label: '24 个点位', value: 24 },
]
const pointTier = ref(12)
const displayMode = ref<DisplayMode>('both')
const surface = ref<SurfaceMode>('TERRAIN')
const sizeScale = ref(1)
/** 已应用到几何上的大小：滑杆松手才提交，避免拖动时反复重建 */
let committedScale = 1
const avoidOverlap = ref(true)
/** 显示距离（km）：相机到点的距离超过它就不画 */
const labelDistance = ref(20)
const terrainOn = ref(true)
const tilesOn = ref(false)
const terrainUrl = ref(defaultTerrainServiceUrl)
const tiltUrl = ref(defaultMeshTilesetUrl)
const loadingTerrain = ref(false)
const loadingTiles = ref(false)
const terrainError = ref('')
const tilesError = ref('')

const camHeight = ref(0)
const visibleCount = ref(0)
const hiddenCount = ref(0)

const points = computed<LabelPoint[]>(() =>
  RAW_POINTS.slice(0, pointTier.value).map((p, i) => ({
    ...p,
    color: PALETTE[i % PALETTE.length],
    level: LEVEL_HINTS[p.id] ?? 3,
  })),
)

let viewer: any = null
let C: any = null
let lastWorldH = 0
let lastVisAt = 0
/** 上一次判定为可见的点：迟滞用它区分「已显示」和「新来的」 */
let shownIds = new Set<string>()

interface Sticker {
  entity: any
  point: LabelPoint
  ratio: number
}
const stickers: Sticker[] = []

const modeOptions: { label: string; value: DisplayMode }[] = [
  { label: '图标 + 文字', value: 'both' },
  { label: '仅文字', value: 'text' },
  { label: '仅图标', value: 'icon' },
]

/* ---------------------------------- 纹理 ---------------------------------- */

const FONT_STACK = '"PingFang SC", "Microsoft YaHei", sans-serif'
/** 画布尺寸（px）：文字在上、图标在下；多边形长宽比要和它一致，否则文字变形 */
const TEX = {
  both: { w: 420, h: 202 },
  text: { w: 420, h: 118 },
  icon: { w: 160, h: 160 },
}
function textureRatio(mode: DisplayMode) {
  return TEX[mode].w / TEX[mode].h
}

/** 图钉图标：白圈 + 彩色圆 + 白色 pin，整体躺平在贴纸里 */
function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.16, r * 0.34, Math.PI, 0)
  ctx.lineTo(cx, cy + r * 0.6)
  ctx.closePath()
  ctx.fillStyle = '#fff'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.16, r * 0.13, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

/** 生成贴纸纹理：透明背景，只有「文字 + 图标」，没有白底板 */
function makeTexture(name: string, color: string, mode: DisplayMode): HTMLCanvasElement {
  const { w, h } = TEX[mode]
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  const cx = w / 2

  if (mode === 'icon') {
    drawPin(ctx, cx, h / 2, 52, color)
    return cv
  }

  // 文字超宽时自动缩字号，保证一张贴纸内放得下
  const maxW = w - 30
  let fontSize = 60
  ctx.font = `bold ${fontSize}px ${FONT_STACK}`
  while (ctx.measureText(name).width > maxW && fontSize > 26) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px ${FONT_STACK}`
  }

  // 白色描边当「底」：去掉了白底板，靠文字外描边保证地图上读得清
  const ty = mode === 'both' ? 62 : h / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 12
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeText(name, cx, ty)
  ctx.fillStyle = color
  ctx.fillText(name, cx, ty)

  // 图标在下：文字在上，图钉指向地面
  if (mode === 'both') drawPin(ctx, cx, 142, 36, color)

  return cv
}

/* -------------------------------- 尺寸换算 -------------------------------- */

/** 相机高度处的「米 / 像素」：只用来估算贴纸在屏幕上占多大，供避让判断用 */
function metersPerPixel() {
  const camera = viewer.camera
  const h = Math.max(camera.positionCartographic.height, 1)
  const fovy = camera.frustum.fovy ?? Math.PI / 3
  const px = viewer.scene.canvas.clientHeight || viewer.container?.clientHeight || 800
  return (2 * h * Math.tan(fovy / 2)) / px
}

/**
 * 贴纸基准宽度（米）：纯米制尺寸 → 拉近自然变大、拉远自然变小。
 * 三种排版用同样的宽度，高度按各自长宽比推，切换模式时视觉宽度才一致。
 */
const BASE_WORLD_W: Record<DisplayMode, number> = { both: 1080, text: 1100, icon: 240 }

function worldHeightFor(mode: DisplayMode) {
  return (BASE_WORLD_W[mode] * sizeScale.value) / textureRatio(mode)
}

/** 以点位为中心、按经纬度轴对齐的矩形：上北下南，纹理不随相机旋转 */
function rectFor(p: LabelPoint, worldH: number, ratio: number) {
  const dLat = worldH / 2 / 111320
  const dLon = (worldH * ratio) / 2 / (111320 * Math.cos(C.Math.toRadians(p.lat)))
  return C.Cartesian3.fromDegreesArray([
    p.lon - dLon, p.lat - dLat,
    p.lon + dLon, p.lat - dLat,
    p.lon + dLon, p.lat + dLat,
    p.lon - dLon, p.lat + dLat,
  ])
}

/* --------------------------------- 实体 --------------------------------- */

/** 全量重建：切换点位数量 / 显示模式 / 贴地目标时用 */
function rebuildStickers() {
  if (!viewer || !C) return
  for (const s of stickers) viewer.entities.remove(s.entity)
  stickers.length = 0

  const mode = displayMode.value
  const ratio = textureRatio(mode)
  const worldH = worldHeightFor(mode)
  lastWorldH = worldH
  shownIds.clear()

  for (const p of points.value) {
    const entity = viewer.entities.add({
      id: `sticker-${p.id}`,
      show: false, // 先关着，等 updateVisibility 决定谁露出来，不会闪一下再消失
      polygon: {
        // 不写 height / extrudedHeight → Cesium 走贴地图元，自动投影到地形表面
        hierarchy: new C.PolygonHierarchy(rectFor(p, worldH, ratio)),
        material: new C.ImageMaterialProperty({
          image: makeTexture(p.name, p.color, mode),
          transparent: true,
        }),
        // TERRAIN 只贴地形；BOTH 连倾斜摄影表面一起贴
        classificationType: C.ClassificationType[surface.value],
        zIndex: 20,
      },
    })
    stickers.push({ entity, point: p, ratio })
  }

  updateVisibility()
}

/**
 * 只在用户改「贴纸大小」时改几何。
 * 相机缩放时绝不动 hierarchy：贴地图元每重建一次都要重新分类，看起来就是一闪一闪。
 */
function applySize() {
  const worldH = worldHeightFor(displayMode.value)
  lastWorldH = worldH
  for (const s of stickers) {
    if (!s.entity.polygon) continue
    s.entity.polygon.hierarchy = new C.PolygonHierarchy(rectFor(s.point, worldH, s.ratio))
  }
}

/** 左侧控制面板在画布坐标系里的占位矩形（面板折叠时自动缩成标题栏） */
function panelRect() {
  const el = document.querySelector('.sticker-panel') as HTMLElement | null
  if (!el || !viewer) return null
  const c = viewer.scene.canvas.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return null
  return { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top }
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 与已占位矩形的最大交集占比 */
function maxOverlap(box: Box, placed: Box[]) {
  const area = Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0))
  let worst = 0
  for (const r of placed) {
    const ix = Math.min(box.x1, r.x1) - Math.max(box.x0, r.x0)
    const iy = Math.min(box.y1, r.y1) - Math.max(box.y0, r.y0)
    if (ix > 0 && iy > 0) worst = Math.max(worst, (ix * iy) / area)
  }
  return worst
}

/**
 * 显隐：先按「该不该显示」（级别 + 距离）筛，再按「有没有地方放」（屏幕包围盒）筛
 *
 * 防闪烁的两个要点：
 *  1. 迟滞：已显示的只要不让位（重叠 > 25%）就继续显示；新来的必须几乎不压别人（重叠 < 3%）才出现
 *  2. 只写变化项：不再「先全部 show=false 再逐个打开」，否则每帧都整批闪一次
 */
function updateVisibility() {
  if (!viewer || !C || !stickers.length) return
  const camera = viewer.camera
  const camH = camera.positionCartographic.height
  camHeight.value = Math.round(camH)

  // 相机越高，只保留级别越小的点位（1 最重要，3 最次要）
  const maxLevel = camH < 3600 ? 3 : camH < 12000 ? 2 : camH < 20000 ? 1 : 0
  const maxDist = labelDistance.value * 1000
  const pitchFactor = Math.max(0.42, Math.abs(Math.sin(camera.pitch)))
  const pxH = (lastWorldH * pitchFactor) / metersPerPixel()
  const toWindow =
    C.SceneTransforms.worldToWindowCoordinates || C.SceneTransforms.wgs84ToWindowCoordinates
  const canvas = viewer.scene.canvas
  const camPos = camera.positionWC
  const tmp = new C.Cartesian3()
  const candidates: { s: Sticker; dist: number; box: Box }[] = []

  for (const s of stickers) {
    const p = s.point
    if (p.level > maxLevel) continue
    const world = C.Cartesian3.fromDegrees(p.lon, p.lat, 0)
    const dist = C.Cartesian3.distance(camPos, world)
    if (dist > maxDist) continue
    // 相机背后的点投影会翻折，先剔掉
    C.Cartesian3.subtract(world, camPos, tmp)
    if (C.Cartesian3.dot(camera.directionWC, tmp) <= 0) continue
    const win = toWindow(viewer.scene, world)
    if (!win) continue
    const pxW = pxH * s.ratio
    const box: Box = {
      x0: win.x - pxW / 2,
      y0: win.y - pxH / 2,
      x1: win.x + pxW / 2,
      y1: win.y + pxH / 2,
    }
    // 视口外的直接丢弃：否则「可见数」会算多，屏幕上看不到
    const vw = canvas.clientWidth
    const vh = canvas.clientHeight
    if (box.x1 < 0 || box.x0 > vw || box.y1 < 0 || box.y0 > vh) continue
    // 挤到只剩一角的不画：文字被地图边缘切一半比不显示更难看
    const insideW = Math.min(box.x1, vw) - Math.max(box.x0, 0)
    const insideH = Math.min(box.y1, vh) - Math.max(box.y0, 0)
    const boxArea = Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0))
    if ((insideW * insideH) / boxArea < 0.6) continue
    // 贴到镜头前已经比屏幕还宽，留着也是糊的
    if (pxW > vw * 0.62 || pxH > vh * 0.55) continue

    candidates.push({ s, dist, box })
  }

  candidates.sort((a, b) => a.dist - b.dist)

  // 控制面板也要占位：贴纸不能压在面板下面，否则等于白画
  const placed: Box[] = []
  const panel = panelRect()
  if (panel) placed.push(panel)

  const nextShown = new Set<string>()
  const keep = candidates.filter((c) => shownIds.has(c.s.point.id))
  const fresh = candidates.filter((c) => !shownIds.has(c.s.point.id))

  const decide = (c: { s: Sticker; box: Box }, limit: number) => {
    // 面板是硬约束：压上一律不显示，迟滞也不放宽
    if (panel && maxOverlap(c.box, [panel]) > 0.02) return
    if (avoidOverlap.value && maxOverlap(c.box, placed) > limit) return
    nextShown.add(c.s.point.id)
    placed.push(c.box)
  }

  // 老点位先占位（宽阈值），新点位再抢剩下的空位（严阈值）
  for (const c of keep) decide(c, 0.25)
  for (const c of fresh) decide(c, 0.03)

  // 只写有变化的实体：避免整批开关造成闪烁
  for (const s of stickers) {
    const want = nextShown.has(s.point.id)
    if (s.entity.show !== want) s.entity.show = want
  }

  shownIds = nextShown
  visibleCount.value = nextShown.size
  hiddenCount.value = stickers.length - nextShown.size
}

function onCameraChanged() {
  if (!viewer) return
  const now = performance.now()
  if (now - lastVisAt < 140) return
  lastVisAt = now
  updateVisibility()
}

/* -------------------------------- 数据源 -------------------------------- */

function msgOf(e: any) {
  return e?.message || String(e)
}

async function loadTerrain() {
  if (!viewer || !C) return
  const url = terrainUrl.value.trim()
  if (!url) {
    terrainOn.value = false
    terrainError.value = '请填写地形服务地址（quantized-mesh）'
    return
  }
  terrainError.value = ''
  loadingTerrain.value = true
  try {
    const provider = await createTerrainProvider(C, url)
    if (!terrainOn.value || !viewer) return
    viewer.terrainProvider = provider
    updateVisibility()
  } catch (e) {
    terrainOn.value = false
    viewer.terrainProvider = new C.EllipsoidTerrainProvider()
    terrainError.value = msgOf(e)
    ElMessage.error(`地形加载失败：${msgOf(e)}`)
  } finally {
    loadingTerrain.value = false
  }
}

function unloadTerrain() {
  if (!viewer || !C) return
  viewer.terrainProvider = new C.EllipsoidTerrainProvider()
}

async function loadTiles() {
  if (!viewer || !C) return
  const url = tiltUrl.value.trim()
  if (!url) {
    tilesOn.value = false
    tilesError.value = '请填写倾斜摄影 tileset.json 地址'
    return
  }
  tilesError.value = ''
  loadingTiles.value = true
  try {
    const ts = await C.Cesium3DTileset.fromUrl(url, { maximumScreenSpaceError: 16 })
    if (!tilesOn.value || !viewer) {
      ts.destroy?.()
      return
    }
    ts.enableCollision = true
    viewer.scene.primitives.add(ts)
    updateVisibility()
  } catch (e) {
    tilesOn.value = false
    tilesError.value = msgOf(e)
    ElMessage.error(`倾斜摄影加载失败：${msgOf(e)}`)
  } finally {
    loadingTiles.value = false
  }
}

function removeTiles() {
  if (!viewer) return
  const list = viewer.scene.primitives
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list.get(i)
    if (p?.isCesium3DTileset) list.remove(p)
  }
}

/* -------------------------------- 交互控制 -------------------------------- */

/** 山坡视角：香港公园到中环这一带是坡地，用来验证贴纸跟着坡面起伏 */
function flyToHill() {
  if (!viewer || !C) return
  const center = C.Cartesian3.fromDegrees(114.156, 22.28, 0)
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center, 1), {
    // 仰角比默认视角更平：贴纸的透视压扁最明显，能看出它躺在坡上而不是竖着
    offset: new C.HeadingPitchRange(C.Math.toRadians(18), C.Math.toRadians(-42), 2000),
    duration: 1.5,
  })
}

function flyTo(kind: 'close' | 'far') {
  if (!viewer || !C) return
  // 视中心偏西：保证点位始终落在左侧面板的右边
  const center = C.Cartesian3.fromDegrees(114.1475, 22.2855, 0)
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center, 1), {
    offset: new C.HeadingPitchRange(
      C.Math.toRadians(18),
      C.Math.toRadians(kind === 'close' ? -50 : -58),
      kind === 'close' ? 2900 : 12000,
    ),
    duration: 1.3,
  })
}

watch(pointTier, () => rebuildStickers())
watch(displayMode, () => rebuildStickers())
watch(surface, () => rebuildStickers())
// 拖滑杆期间不动几何（等于每帧重建贴地图元），松手时才统一改一次
function onSizeCommit() {
  if (sizeScale.value === committedScale) return
  committedScale = sizeScale.value
  applySize()
  updateVisibility()
}
watch(avoidOverlap, () => updateVisibility())
watch(labelDistance, () => updateVisibility())
watch(terrainOn, (on) => void (on ? loadTerrain() : unloadTerrain()))
watch(tilesOn, (on) => void (on ? loadTiles() : removeTiles()))
function onTerrainUrlChange() {
  if (!terrainOn.value) return
  nextTick(() => {
    terrainOn.value = false
    nextTick(() => {
      terrainOn.value = true
    })
  })
}
function onTiltUrlChange() {
  if (!tilesOn.value) return
  removeTiles()
  void loadTiles()
}

onCesiumReady((v, lib) => {
  viewer = v
  C = lib

  // 初始视角：斜视中环，能同时看到海边平地与半山坡地
  // 视中心略偏西：左侧控制面板会压住一片区域，点位需要落在它右边
  const center = C.Cartesian3.fromDegrees(114.1475, 22.2855, 0)
  viewer.camera.lookAt(
    center,
    new C.HeadingPitchRange(C.Math.toRadians(18), C.Math.toRadians(-45), 5600),
  )
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)

  rebuildStickers()
  void loadTerrain()
  if (tilesOn.value) void loadTiles()

  viewer.camera.changed.addEventListener(onCameraChanged)

  return () => {
    viewer?.camera.changed.removeEventListener(onCameraChanged)
    for (const s of stickers) viewer?.entities.remove(s.entity)
    stickers.length = 0
    viewer = null
    C = null
  }
})
</script>

<template>
  <CesiumOverlay class="sticker-panel" title="地形贴地标注 · 文字铺在地表" :width="286">
    <p class="tip">
      不用 billboard / label：Canvas 画「文字在上、图标在下」的透明贴纸，作为贴地多边形的纹理铺在地表，旋转视角也不会竖起来。
    </p>

    <div class="row">
      <span class="row-label">点位数量</span>
      <el-select v-model="pointTier" size="small" class="mode">
        <el-option v-for="t in POINT_TIERS" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
    </div>

    <div class="row">
      <span class="row-label">贴纸内容</span>
      <el-radio-group v-model="displayMode" size="small">
        <el-radio-button v-for="m in modeOptions" :key="m.value" :value="m.value">
          {{ m.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">贴纸大小</span>
      <el-slider
        v-model="sizeScale"
        class="slider"
        :min="0.6"
        :max="1.8"
        :step="0.1"
        size="small"
        @change="onSizeCommit"
      />
    </div>

    <div class="row">
      <span class="row-label">防重叠</span>
      <el-switch v-model="avoidOverlap" size="small" />
    </div>

    <div class="row">
      <span class="row-label">显示距离 {{ labelDistance }} km</span>
    </div>
    <el-slider v-model="labelDistance" :min="2" :max="40" :step="1" size="small" />

    <div class="row">
      <span class="row-label">贴地目标</span>
      <el-radio-group v-model="surface" size="small">
        <el-radio-button value="TERRAIN">地形</el-radio-button>
        <el-radio-button value="BOTH">地形 + 倾斜</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">地形</span>
      <el-switch v-model="terrainOn" size="small" :loading="loadingTerrain" />
    </div>
    <el-input
      v-model="terrainUrl"
      class="url"
      size="small"
      placeholder="地形服务地址（quantized-mesh）"
      @change="onTerrainUrlChange"
    />
    <p v-if="terrainError" class="err">{{ terrainError }}</p>

    <div class="row">
      <span class="row-label">倾斜摄影</span>
      <el-switch v-model="tilesOn" size="small" :loading="loadingTiles" />
    </div>
    <el-input
      v-model="tiltUrl"
      class="url"
      size="small"
      placeholder="tileset.json 地址"
      @change="onTiltUrlChange"
    />
    <p v-if="tilesError" class="err">{{ tilesError }}</p>

    <div class="btns">
      <el-button size="small" @click="flyTo('far')">拉远</el-button>
      <el-button size="small" @click="flyToHill">山坡</el-button>
      <el-button size="small" type="primary" plain @click="flyTo('close')">低空</el-button>
    </div>

    <p class="hint">
      相机高度 <b>{{ camHeight }}</b> m · 可见 <b>{{ visibleCount }}</b> / {{ points.length }}
      <template v-if="hiddenCount">（{{ hiddenCount }} 个被距离或防重叠隐藏）</template>
    </p>
    <p class="foot">贴纸是固定米制尺寸：拉近变大、拉远变小，像真的铺在地上</p>
    <p class="foot">相机缩放时不重建几何，显示状态只写变化项，所以不会闪</p>
    <p class="foot">贴地多边形不写 height：Cesium 自动投影到地形表面，纹理随坡面起伏</p>
  </CesiumOverlay>
</template>

<style scoped>
.sticker-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  max-height: calc(100% - 72px);
  overflow-y: auto;
}
.tip {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.6;
}
.tip code {
  padding: 0 3px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 10.5px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.row-label {
  flex: none;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
}
.mode {
  width: 152px;
}
.slider {
  width: 132px;
  margin-right: 2px;
}
.url {
  margin-bottom: 8px;
}
.hint {
  margin: 2px 0 8px;
  color: #475569;
  font-size: 10.5px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.hint b {
  color: #2563eb;
  font-weight: 600;
}
.err {
  margin: -4px 0 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 10.5px;
  line-height: 1.55;
  word-break: break-all;
}
.btns {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.btns .el-button {
  flex: 1;
  margin-left: 0;
}
.foot {
  margin: 0 0 4px;
  color: #94a3b8;
  font-size: 10.5px;
  line-height: 1.6;
}
</style>
