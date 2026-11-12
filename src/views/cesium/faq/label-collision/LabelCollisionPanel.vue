<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { defaultMeshTilesetUrl } from '@/utils/gis/cesiumConfig'

/**
 * 常见问题：海量点位 label 互相压字（重叠）
 *
 * 三种做法现场对比：
 *   raw       不处理，全显示 —— 用来重现“一团字”的问题
 *   declutter 自研屏幕空间避让：LabelCollection + 真实文字宽度 + 网格碰撞 + 上/下/左/右候选位置
 *   cluster   Cesium 自带 EntityCluster，把邻近点合并成「N 个点位」
 *
 * 量大时的三个关键点：
 *   1) 用 LabelCollection 渲染，不用 Entity（上万个 Entity 每帧都要过一遍数据源）
 *   2) 只在相机变化时节流重算，单次布局 O(n)，不是每帧
 *   3) 先视口裁剪再碰撞，视野外的点不参与计算
 */

type Mode = 'raw' | 'declutter' | 'cluster'

interface DemoPoint {
  id: string
  name: string
  lon: number
  lat: number
  /** 点位图标（public/image 下随机取一张） */
  pin: string
  /** 图标像素尺寸，长的短的混着来，更接近真实业务 */
  size: number
  /** 越大越优先显示 */
  priority: number
}

interface LabelItem {
  point: DemoPoint
  position: any
  label: any
  /** 量出来的文字宽度（含背景/描边留白） */
  width: number
  halfW: number
  /** 到相机距离平方，用于排序 */
  dist: number
  /** 当前生效的像素偏移 */
  dx: number
  dy: number
}

/** 字体必须和 measureText 用的一致，否则量出来的宽度对不上 */
const FONT = '600 13px "Microsoft YaHei", sans-serif'
/** label 视觉高度：13px 文字 + 4px 描边留白 */
const LABEL_H = 22
/** label 配色：黄色字 + 黑色轮廓，压在地形 / 卫星图上都读得清 */
const LABEL_FILL = '#FFD400'
const LABEL_OUTLINE = '#000000'
const LABEL_OUTLINE_WIDTH = 4

/** 点位图标：public/image 下的 map-pin 系列（没有 map-pin-01） */
const PIN_IMAGES = [0, ...Array.from({ length: 23 }, (_, i) => i + 2)].map(
  (n) => `/image/map-pin-${String(n).padStart(2, '0')}.png`,
)

/** 默认地址与「工具 → 高程提取」「点位贴地」页保持一致 */
const DEFAULT_TERRAIN_URL = import.meta.env.DEV
  ? '/hk-terrain/gis/SMPstatic/20251011HKdemqp'
  : 'https://bk.mediumvis.com:8090/gis/SMPstatic/20251011HKdemqp'
const DEFAULT_TILT_URL = defaultMeshTilesetUrl
/** 碰撞网格边长，越小越精确越慢；32px 对 13px 文字够用 */
const CELL = 32
/** 相机移动时的布局间隔，避免每帧重排；点越多间隔越大 */
const LAYOUT_INTERVAL = 80
const LAYOUT_INTERVAL_BIG = 140

const POINT_TIERS = [
  { label: '200 个点位', value: 200 },
  { label: '1000 个点位', value: 1000 },
  { label: '3000 个点位', value: 3000 },
  { label: '5000 个点位', value: 5000 },
]

const MODE_OPTIONS: Array<{ label: string; value: Mode }> = [
  { label: '不处理', value: 'raw' },
  { label: '碰撞避让', value: 'declutter' },
  { label: '实体聚簇', value: 'cluster' },
]

/** 名字长短混排：短名 2~4 字、长名 20+ 字，宽度差异就是避让要处理的东西 */
const SHORT_NAMES = ['观景台', '巴士站', '停车场', '便利店', '凉亭', '公厕', '加油站', '小食亭']
const MID_NAMES = ['海滨长廊', '社区中心', '街市入口', '行人天桥', '宠物公园', '单车径起点']
const LONG_NAMES = [
  '香港特别行政区政府康乐及文化事务署社区服务中心',
  '中西区海滨长廊（中环段）宠物公园入口 B2',
  '港铁香港站 A2 出口 · 往国际金融中心方向',
  '南丫岛榕树湾码头公众休憩处及单车停放点',
]

/** 分散锚点 + 簇内抖动：让点位成簇挤在一起 */
const ANCHORS = [
  { name: '中环', lon: 114.158, lat: 22.283 },
  { name: '铜锣湾', lon: 114.185, lat: 22.28 },
  { name: '北角', lon: 114.2, lat: 22.291 },
  { name: '香港仔', lon: 114.155, lat: 22.248 },
  { name: '尖沙咀', lon: 114.172, lat: 22.297 },
  { name: '旺角', lon: 114.17, lat: 22.319 },
  { name: '红磡', lon: 114.187, lat: 22.305 },
  { name: '观塘', lon: 114.226, lat: 22.312 },
  { name: '将军澳', lon: 114.26, lat: 22.307 },
  { name: '荃湾', lon: 114.113, lat: 22.371 },
  { name: '沙田', lon: 114.187, lat: 22.377 },
  { name: '大埔', lon: 114.168, lat: 22.45 },
  { name: '元朗', lon: 114.032, lat: 22.444 },
  { name: '屯门', lon: 113.976, lat: 22.39 },
  { name: '东涌', lon: 113.945, lat: 22.288 },
  { name: '赤鱲角', lon: 113.914, lat: 22.308 },
  { name: '西贡', lon: 114.273, lat: 22.382 },
  { name: '青衣', lon: 114.107, lat: 22.344 },
]

/** 确定性伪随机：同一点位数多次重建，位置不变 */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function makeName(i: number, anchor: string, seq: number) {
  const r = i % 10
  if (r === 0) return LONG_NAMES[i % LONG_NAMES.length]
  if (r <= 3) return `${anchor}${MID_NAMES[i % MID_NAMES.length]} ${seq + 1}`
  return `${SHORT_NAMES[i % SHORT_NAMES.length]} ${seq + 1}`
}

function buildPoints(n: number): DemoPoint[] {
  const rand = seeded(n * 7919 + 31)
  // 簇内抖动约 ±600m
  const JITTER = 0.006
  const list: DemoPoint[] = []
  for (let i = 0; i < n; i++) {
    const a = ANCHORS[i % ANCHORS.length]
    const seq = Math.floor(i / ANCHORS.length)
    list.push({
      id: `L-${i}`,
      name: makeName(i, a.name, seq),
      lon: a.lon + (rand() - 0.5) * 2 * JITTER,
      lat: a.lat + (rand() - 0.5) * 2 * JITTER,
      // 图标随机取一张，尺寸 22~34px 随机，和真实业务里的多类型点位一致
      pin: PIN_IMAGES[Math.floor(rand() * PIN_IMAGES.length)],
      size: 22 + Math.round(rand() * 12),
      // 每 17 个点有一个“重点点位”，排最前面占位
      priority: i % 17 === 0 ? 3 : i % 5 === 0 ? 2 : 1,
    })
  }
  return list
}

const tier = ref(200)
const mode = ref<Mode>('declutter')
/** 是否启用 上/下/左/右 四个候选位置（关掉只放上方，显示率明显下降） */
const multiCand = ref(true)
/** 聚簇半径（像素） */
const clusterRange = ref(40)

const points = shallowRef<DemoPoint[]>(buildPoints(200))

/* ---------------- 地形 / 倾斜摄影 ---------------- */
const tiltUrl = ref(DEFAULT_TILT_URL)
const terrainUrl = ref(DEFAULT_TERRAIN_URL)
/** 默认都打开：进页面就有真实地形和楼体做背景 */
const tilesOn = ref(true)
const terrainOn = ref(true)
const loadingTiles = ref(false)
const loadingTerrain = ref(false)
/** 面板内联错误提示（toast 会消失，这里常驻便于排查） */
const tilesError = ref('')
const terrainError = ref('')
let tileset: any = null

const inView = ref(0)
const shown = ref(0)
const hidden = ref(0)
const layoutMs = ref(0)

const total = computed(() => points.value.length)
const showRate = computed(() =>
  inView.value ? Math.round((shown.value / inView.value) * 100) : 0,
)

let viewer: any = null
let C: any = null
/** 点位图标：BillboardCollection 批量绘制，5000 个图标也只有一次 draw call */
let billboards: any = null
/** 文字标注集合：碰撞结果直接改 label.show */
let labels: any = null
/** 聚簇模式的数据源 */
let ds: any = null
let items: LabelItem[] = []
let measureCtx: CanvasRenderingContext2D | null = null
let rafId = 0
let lastLayoutAt = 0
let offCameraChanged: (() => void) | null = null
let offMoveEnd: (() => void) | null = null
let scratchScreen: any = null
let scratchOffset: any = null

/** 量文字宽度：按文本缓存，每条 label 只量一次 */
function measureWidth(text: string) {
  if (!measureCtx && typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = FONT
      measureCtx = ctx
    }
  }
  const w = measureCtx ? measureCtx.measureText(text).width : text.length * 13
  // +10：左右各 4px 描边 + 余量，宁可算宽一点，也别贴太紧
  return Math.ceil(w) + 10
}

/** 网格 key：把二维格子压成一个数字，比字符串快 */
function cellKey(cx: number, cy: number) {
  return (cx + 4096) * 8192 + (cy + 4096)
}

/** 矩形是否和已放下的 label 相撞 */
function collides(
  grid: Map<number, number[]>,
  rects: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const cx0 = Math.floor(x0 / CELL)
  const cx1 = Math.floor(x1 / CELL)
  const cy0 = Math.floor(y0 / CELL)
  const cy1 = Math.floor(y1 / CELL)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const bucket = grid.get(cellKey(cx, cy))
      if (!bucket) continue
      for (let k = 0; k < bucket.length; k++) {
        const idx = bucket[k] * 4
        if (x0 < rects[idx + 2] && x1 > rects[idx] && y0 < rects[idx + 3] && y1 > rects[idx + 1]) {
          return true
        }
      }
    }
  }
  return false
}

/** 占位：把矩形写进它覆盖的所有格子 */
function occupy(
  grid: Map<number, number[]>,
  rects: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const idx = rects.length / 4
  rects.push(x0, y0, x1, y1)
  const cx0 = Math.floor(x0 / CELL)
  const cx1 = Math.floor(x1 / CELL)
  const cy0 = Math.floor(y0 / CELL)
  const cy1 = Math.floor(y1 / CELL)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const key = cellKey(cx, cy)
      const bucket = grid.get(key)
      if (bucket) bucket.push(idx)
      else grid.set(key, [idx])
    }
  }
}

function applyOffset(it: LabelItem, dx: number, dy: number) {
  if (it.dx === dx && it.dy === dy) return
  it.dx = dx
  it.dy = dy
  scratchOffset.x = dx
  scratchOffset.y = dy
  // setter 内部会 clone，可以复用一个 Cartesian2
  it.label.pixelOffset = scratchOffset
}

/** 布局：投影到屏幕，按优先级依次找位置；O(n × 候选 × 少量格子) */
function runLayout(force = false) {
  if (!viewer || !C || !labels || mode.value !== 'declutter') return
  const now = performance.now()
  // 点越多，重排间隔越大，避免拖动时把帧率拖垮
  const interval = items.length > 2000 ? LAYOUT_INTERVAL_BIG : LAYOUT_INTERVAL
  if (!force && now - lastLayoutAt < interval) return
  lastLayoutAt = now

  const t0 = now
  const scene = viewer.scene
  const W = scene.canvas.clientWidth
  const H = scene.canvas.clientHeight
  const cam = viewer.camera.positionWC

  // 1) 近的先占位
  for (const it of items) it.dist = C.Cartesian3.distanceSquared(cam, it.position)
  // 2) 优先级高的先占位，同优先级按距离
  const order = items
    .slice()
    .sort((a, b) => b.point.priority - a.point.priority || a.dist - b.dist)

  const grid = new Map<number, number[]>()
  const rects: number[] = []
  const cands = multiCand.value ? 4 : 1
  let visible = 0
  let placedCount = 0

  for (const it of order) {
    // 3) 投影（相机背后返回 undefined）
    const sp = C.SceneTransforms.wgs84ToWindowCoordinates(scene, it.position, scratchScreen)
    // 4) 视口裁剪：视野外直接关掉
    if (!sp || sp.x < -it.width || sp.x > W + it.width || sp.y < -LABEL_H || sp.y > H + LABEL_H) {
      if (it.label.show) it.label.show = false
      continue
    }
    visible++

    // 5) 候选位置：上 / 下 / 左 / 右，取第一个不撞的
    //    图标以针尖（底部）落在点位上，向上占 size px，所以上下要避开图标本身
    const half = it.point.size / 2
    let placed = false
    for (let c = 0; c < cands; c++) {
      const dx = c === 2 ? -(it.halfW + half + 6) : c === 3 ? it.halfW + half + 6 : 0
      const dy
        = c === 0
          ? -(it.point.size + LABEL_H / 2 + 4)
          : c === 1
            ? LABEL_H / 2 + 6
            : -half
      const x0 = sp.x + dx - it.halfW
      const y0 = sp.y + dy - LABEL_H / 2
      const x1 = x0 + it.width
      const y1 = y0 + LABEL_H
      if (collides(grid, rects, x0, y0, x1, y1)) continue
      occupy(grid, rects, x0, y0, x1, y1)
      applyOffset(it, dx, dy)
      placed = true
      placedCount++
      break
    }

    // 6) 四个位置都撞 → 隐藏，而不是叠着画
    if (!placed) {
      if (it.label.show) it.label.show = false
      continue
    }
    if (!it.label.show) it.label.show = true
  }

  inView.value = visible
  shown.value = placedCount
  hidden.value = Math.max(0, items.length - placedCount)
  layoutMs.value = Math.round((performance.now() - t0) * 10) / 10
}

/** “不处理”模式只统计视野内数量，不做碰撞 */
function countView() {
  if (!viewer || !C) return
  const scene = viewer.scene
  const W = scene.canvas.clientWidth
  const H = scene.canvas.clientHeight
  let visible = 0
  for (const it of items) {
    const sp = C.SceneTransforms.wgs84ToWindowCoordinates(scene, it.position, scratchScreen)
    if (!sp) continue
    if (sp.x < -it.width || sp.x > W + it.width || sp.y < -LABEL_H || sp.y > H + LABEL_H) continue
    visible++
  }
  inView.value = visible
}

/** 相机变化时用 rAF 合帧 + 节流 */
function scheduleLayout() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (mode.value === 'declutter') runLayout()
    else if (mode.value === 'raw') countView()
  })
}

function clearScene() {
  if (!viewer || viewer.isDestroyed?.()) return
  if (billboards) {
    viewer.scene.primitives.remove(billboards)
    billboards = null
  }
  if (labels) {
    viewer.scene.primitives.remove(labels)
    labels = null
  }
  if (ds) {
    offClusterEvent?.()
    offClusterEvent = null
    viewer.dataSources.remove(ds, true)
    ds = null
  }
  items = []
}

/** 方案一 / 方案二：图标用 BillboardCollection，文字用 LabelCollection */
function buildLabels() {
  if (!viewer || !C) return
  billboards = new C.BillboardCollection()
  labels = new C.LabelCollection()
  viewer.scene.primitives.add(billboards)
  viewer.scene.primitives.add(labels)

  const declutter = mode.value === 'declutter'
  for (const p of points.value) {
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, 0)
    billboards.add({
      position,
      image: p.pin,
      width: p.size,
      height: p.size,
      // 图标针尖（底部）落在点位上
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })

    const width = measureWidth(p.name)
    // 默认放在图标上方
    const offsetY = -(p.size + LABEL_H / 2 + 4)
    const label = labels.add({
      position,
      text: p.name,
      font: FONT,
      fillColor: C.Color.fromCssColorString(LABEL_FILL),
      outlineColor: C.Color.fromCssColorString(LABEL_OUTLINE),
      outlineWidth: LABEL_OUTLINE_WIDTH,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: C.HorizontalOrigin.CENTER,
      verticalOrigin: C.VerticalOrigin.CENTER,
      pixelOffset: new C.Cartesian2(0, offsetY),
      showBackground: false,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // “不处理”模式全显示，用来对比
      show: !declutter,
    })

    items.push({
      point: p,
      position,
      label,
      width,
      halfW: width / 2,
      dist: 0,
      dx: 0,
      dy: offsetY,
    })
  }
}

/* ---------------- 聚簇气泡样式：蓝底白圈 + 数量 ---------------- */
const clusterImages = new Map<string, { canvas: HTMLCanvasElement, size: number }>()
let offClusterEvent: (() => void) | null = null

/** 按数量画一张气泡图（同一数量复用，避免每帧新建 canvas） */
function clusterImage(count: number) {
  const label = count > 999 ? '999+' : String(count)
  const size = count > 999 ? 52 : count > 99 ? 44 : 38
  const key = `${size}:${label}`
  const cached = clusterImages.get(key)
  if (cached) return cached

  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const r = size / 2 - 1.5
  const c = size / 2

  // 外圈淡阴影，压在地形上更有层次
  ctx.beginPath()
  ctx.arc(c, c, r + 1.2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)'
  ctx.fill()

  // 主体：蓝色渐变 + 白色描边
  const grad = ctx.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#60a5fa')
  grad.addColorStop(1, '#1d4ed8')
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  // 数量：位数越多字号越小，保证不出圈
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${label.length > 2 ? size * 0.3 : size * 0.42}px "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, c, c + 0.5)

  const img = { canvas, size }
  clusterImages.set(key, img)
  return img
}

/** 方案三：EntityCluster，几行开启，邻近点合并成一个数量气泡 */
function buildCluster() {
  if (!viewer || !C) return
  ds = new C.CustomDataSource('label-cluster')
  viewer.dataSources.add(ds)

  // 注意：属性名是 clustering，不是 cluster
  const cl = ds.clustering
  cl.enabled = true
  cl.pixelRange = clusterRange.value
  cl.minimumClusterSize = 2
  cl.clusterPoints = true
  cl.clusterLabels = true
  cl.clusterBillboards = true

  // 默认只会给一个纯数字 label；这里换成图片气泡 + 数量
  offClusterEvent?.()
  offClusterEvent = cl.clusterEvent.addEventListener((entities: any[], cluster: any) => {
    const { canvas, size } = clusterImage(entities.length)
    cluster.label.show = false
    cluster.billboard.show = true
    cluster.billboard.image = canvas
    cluster.billboard.width = size
    cluster.billboard.height = size
    cluster.billboard.verticalOrigin = C.VerticalOrigin.BOTTOM
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
  })

  for (const p of points.value) {
    ds.entities.add({
      id: p.id,
      position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0),
      billboard: {
        image: p.pin,
        width: p.size,
        height: p.size,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: p.name,
        font: FONT,
        fillColor: C.Color.fromCssColorString(LABEL_FILL),
        outlineColor: C.Color.fromCssColorString(LABEL_OUTLINE),
        outlineWidth: LABEL_OUTLINE_WIDTH,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.CENTER,
        pixelOffset: new C.Cartesian2(0, -(p.size + LABEL_H / 2 + 4)),
        showBackground: false,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }
}

function rebuild() {
  clearScene()
  if (!viewer || !C) return
  inView.value = 0
  shown.value = 0
  hidden.value = 0
  layoutMs.value = 0

  if (mode.value === 'cluster') {
    buildCluster()
    return
  }
  buildLabels()
  if (mode.value === 'declutter') {
    runLayout(true)
  } else {
    countView()
    shown.value = points.value.length
  }
}

/** 全港视角：点位铺满各区，能看出成簇压字 */
function flyOverview() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.17, 22.33, 24000),
    orientation: {
      heading: C.Math.toRadians(0),
      pitch: C.Math.toRadians(-55),
      roll: 0,
    },
    duration: 1.2,
  })
}

/** 中环特写：点密度最高，避让效果最直观 */
function flyClose() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.162, 22.289, 3000),
    orientation: {
      heading: C.Math.toRadians(0),
      pitch: C.Math.toRadians(-50),
      roll: 0,
    },
    duration: 1.2,
  })
}

function msgOf(e: any) {
  return e?.message || String(e)
}

/* ---------------- 地形 / 倾斜摄影：按输入框地址加载 ---------------- */

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
    viewer.scene.primitives.add(ts)
    tileset = ts
  } catch (e) {
    tilesOn.value = false
    tilesError.value = msgOf(e)
  } finally {
    loadingTiles.value = false
  }
}

function removeTiles() {
  if (!viewer || viewer.isDestroyed?.()) return
  const list = viewer.scene.primitives
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list.get(i)
    if (p?.isCesium3DTileset) list.remove(p)
  }
  tileset = null
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
    const provider = await C.CesiumTerrainProvider.fromUrl(url, { requestVertexNormals: true })
    if (!terrainOn.value || !viewer) return
    viewer.terrainProvider = provider
  } catch (e) {
    terrainOn.value = false
    viewer.terrainProvider = new C.EllipsoidTerrainProvider()
    terrainError.value = msgOf(e)
  } finally {
    loadingTerrain.value = false
  }
}

function unloadTerrain() {
  if (!viewer || !C) return
  viewer.terrainProvider = new C.EllipsoidTerrainProvider()
}

/** 地址改完（回车 / 失焦）时重载 */
function onTiltUrlChange() {
  if (!tilesOn.value) return
  removeTiles()
  void loadTiles()
}
function onTerrainUrlChange() {
  if (!terrainOn.value) return
  void loadTerrain()
}

watch(tilesOn, (on) => {
  void (on ? loadTiles() : removeTiles())
})
watch(terrainOn, (on) => {
  void (on ? loadTerrain() : unloadTerrain())
})

watch(tier, (n) => {
  points.value = buildPoints(n)
  rebuild()
})

watch(mode, () => rebuild())

watch(multiCand, () => runLayout(true))

watch(clusterRange, (v) => {
  if (ds) ds.clustering.pixelRange = v
})

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  scratchScreen = new lib.Cartesian2()
  scratchOffset = new lib.Cartesian2()

  // 相机一动就重排：百分比阈值调小，转动过程中也能持续避让
  v.camera.percentageChanged = 0.01
  offCameraChanged = v.camera.changed.addEventListener(scheduleLayout)
  offMoveEnd = v.camera.moveEnd.addEventListener(() => {
    if (mode.value === 'declutter') runLayout(true)
    else if (mode.value === 'raw') countView()
  })

  rebuild()

  // 默认地形 / 倾斜摄影：进页面就有真实地表和楼体
  void loadTerrain()
  void loadTiles()

  return () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    offCameraChanged?.()
    offMoveEnd?.()
    offCameraChanged = null
    offMoveEnd = null
    clearScene()
    removeTiles()
    unloadTerrain()
    clusterImages.clear()
    viewer = null
    C = null
    measureCtx = null
  }
})
</script>

<template>
  <CesiumOverlay class="label-panel" title="海量点位 label 避让" :width="334">
    <p class="tip">
      点位一多，label 就会叠成一团。这里三种做法实时对比：<b>不处理</b>（重现问题）、<b>碰撞避让</b>（自研屏幕空间检测，长度长短都按真实宽度算）、<b>实体聚簇</b>（Cesium 自带合并）。
    </p>

    <div class="row">
      <span class="row-label">点位数量</span>
      <el-select v-model="tier" size="small" class="ctl">
        <el-option v-for="t in POINT_TIERS" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
    </div>

    <div class="row">
      <span class="row-label">label 处理</span>
      <el-radio-group v-model="mode" size="small" class="ctl">
        <el-radio-button v-for="m in MODE_OPTIONS" :key="m.value" :value="m.value">
          {{ m.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="mode === 'declutter'" class="row">
      <span class="row-label">四向候选位置</span>
      <el-switch v-model="multiCand" size="small" />
    </div>

    <div v-if="mode === 'cluster'" class="row">
      <span class="row-label">聚簇半径 {{ clusterRange }}px</span>
      <el-slider
        v-model="clusterRange"
        :min="20"
        :max="120"
        :step="10"
        size="small"
        class="ctl"
      />
    </div>

    <el-divider class="sep" />

    <div class="row">
      <span class="row-label">地形</span>
      <el-switch v-model="terrainOn" size="small" :loading="loadingTerrain" />
    </div>
    <el-input
      v-model="terrainUrl"
      size="small"
      class="url"
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
      size="small"
      class="url"
      placeholder="倾斜 tileset.json 地址"
      @change="onTiltUrlChange"
    />
    <p v-if="tilesError" class="err">{{ tilesError }}</p>

    <el-divider class="sep" />

    <div v-if="mode !== 'cluster'" class="stats">
      <div class="stat">
        <span class="num">{{ total }}</span>
        <span class="k">总点位</span>
      </div>
      <div class="stat">
        <span class="num">{{ inView }}</span>
        <span class="k">视野内</span>
      </div>
      <div class="stat">
        <span class="num c-shown">{{ shown }}</span>
        <span class="k">显示</span>
      </div>
      <div class="stat">
        <span class="num c-hidden">{{ hidden }}</span>
        <span class="k">被挤掉</span>
      </div>
    </div>

    <div v-if="mode === 'declutter'" class="meta-line">
      显示率 <b>{{ showRate }}%</b> · 单次布局 <b>{{ layoutMs }} ms</b>
    </div>
    <div v-else-if="mode === 'raw'" class="meta-line">
      全部 {{ total }} 个点都显示：名字互相覆盖，数量越多越糊（这就是要解决的问题）
    </div>
    <div v-else class="meta-line">
      共 {{ total }} 个点，邻近点合并成蓝色气泡（气泡里是点数，样式由 <code>clusterEvent</code> 自己画）；看不到具体名字，Entity 数量大时本身更重
    </div>

    <div class="btns">
      <el-button size="small" type="primary" plain @click="rebuild">重新布局</el-button>
      <el-button size="small" @click="flyOverview">全港视角</el-button>
      <el-button size="small" @click="flyClose">中环特写</el-button>
    </div>

    <p class="foot">
      转动视角时按 <code>camera.changed</code> 节流重排，<code>camera.moveEnd</code> 再强制算一次。图标从
      <code>public/image</code> 随机取、label 统一黄字黑描边；点位高度固定在椭球面，只为演示 label 避让，不参与地形/倾斜贴地（贴地见「点位贴地」页）。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.label-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
}
.tip {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.6;
}
.tip b {
  color: #334155;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.row-label {
  flex: none;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
}
.ctl {
  flex: 1;
  min-width: 0;
  max-width: 196px;
}
.sep {
  margin: 2px 0 8px;
}
.url {
  margin-bottom: 8px;
}
.url :deep(.el-input__inner) {
  font-size: 11px;
}
.err {
  margin: -4px 0 8px;
  color: #dc2626;
  font-size: 10.5px;
  line-height: 1.5;
  word-break: break-all;
}
.row .el-slider {
  max-width: 150px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 4px 0 6px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 0;
  border-radius: 7px;
  background: #f8fafc;
}
.num {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.c-shown {
  color: #2563eb;
}
.c-hidden {
  color: #94a3b8;
}
.k {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}
.meta-line {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.55;
}
.meta-line b {
  color: #1d4ed8;
  font-variant-numeric: tabular-nums;
}
.meta-line code {
  padding: 0 3px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 10px;
}
.btns {
  display: flex;
  gap: 6px;
}
.btns .el-button {
  flex: 1;
  margin-left: 0;
}
.foot {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 10.5px;
  line-height: 1.6;
}
.foot code {
  padding: 0 3px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 10px;
}
</style>
