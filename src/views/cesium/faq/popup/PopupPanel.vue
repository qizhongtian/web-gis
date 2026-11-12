<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 常见问题：点击点 / 线 / 面弹出信息窗
 *
 * 难点不在“怎么弹”，而在“弹窗跟着场景走、又不飞出视口”：
 *   1) 世界坐标每帧投到屏幕（scene.postRender，别只绑 camera.changed）
 *   2) 上方放不下就翻到下方，否则被顶部裁掉
 *   3) 左右用 clamp 顶住，箭头单独 clamp，广告牌才不会指歪
 *   4) 尺寸用 measure + ResizeObserver 量一次，不要每帧读 offsetHeight
 *   5) 背面 / 出视口就隐藏，避免留一个贴在屏幕边上的“幽灵弹窗”
 */

type FeatureType = 'point' | 'line' | 'polygon'
type PlaceMode = 'smart' | 'raw'
type ContentSize = 'short' | 'long' | 'xlong'

interface DemoFeature {
  id: string
  name: string
  type: FeatureType
  /** 点位坐标 / 线面中心，pickPosition 取不到时的兜底锚点 */
  coord: [number, number]
  /** 线、面的坐标串 */
  coords?: [number, number][]
  pin?: string
  color: string
  rows: [string, string][]
  text: string
}

const FEATURES: DemoFeature[] = [
  {
    id: 'PT-1',
    name: '中环码头',
    type: 'point',
    coord: [114.16218, 22.28698],
    pin: '/image/map-pin-02.png',
    color: '#2563eb',
    rows: [['类型', '监控点位'], ['经纬度', '114.16218, 22.28698'], ['状态', '在线']],
    text: '码头前沿的客流监控点位，接入 4 路视频与 1 路客流统计。人流高峰时段建议配合「点位贴地」页面的高度策略一起使用。',
  },
  {
    id: 'PT-2',
    name: '尖沙咀钟楼',
    type: 'point',
    coord: [114.1694, 22.293],
    pin: '/image/map-pin-05.png',
    color: '#2563eb',
    rows: [['类型', '地标'], ['经纬度', '114.16940, 22.29300'], ['状态', '正常']],
    text: '维港沿岸地标点位：点击后弹窗跟随相机移动，锚点靠近屏幕上边缘时会自动翻到点位下方。',
  },
  {
    id: 'PT-3',
    name: '金紫荆广场',
    type: 'point',
    coord: [114.1733, 22.2839],
    pin: '/image/map-pin-09.png',
    color: '#2563eb',
    rows: [['类型', '地标'], ['经纬度', '114.17330, 22.28390'], ['状态', '正常']],
    text: '把点位拖到屏幕右下角，能看到弹窗被水平 clamp 后箭头仍然指着点位。',
  },
  {
    id: 'LN-1',
    name: '维港航线',
    type: 'line',
    coord: [114.1712, 22.2925],
    coords: [
      [114.1618, 22.286],
      [114.1712, 22.2925],
      [114.1803, 22.2962],
    ],
    color: '#0ea5e9',
    rows: [['类型', '航线'], ['长度', '3.2 km'], ['等级', '一级']],
    text: '线要素的锚点取鼠标点击处，而不是整条线的中心，所以点哪儿弹哪儿，箭头始终跟着鼠标落点。',
  },
  {
    id: 'LN-2',
    name: '中环—北角',
    type: 'line',
    coord: [114.1856, 22.2808],
    coords: [
      [114.1592, 22.2848],
      [114.1856, 22.2808],
      [114.2004, 22.2906],
    ],
    color: '#f59e0b',
    rows: [['类型', '航线'], ['长度', '4.8 km'], ['等级', '二级']],
    text: '线要素 clampToGround 后贴地显示，屏幕坐标由点击位置反算，与线宽无关。',
  },
  {
    id: 'PG-1',
    name: '中环海滨地块',
    type: 'polygon',
    coord: [114.1626, 22.2875],
    coords: [
      [114.1595, 22.2855],
      [114.1662, 22.2872],
      [114.1655, 22.2898],
      [114.1588, 22.2882],
    ],
    color: '#10b981',
    rows: [['类型', '地块'], ['面积', '0.42 km²'], ['用途', '海滨长廊']],
    text: '面要素半透明填充 + 描边，点击面内任意位置都能命中，弹窗锚点就是点击点。',
  },
  {
    id: 'PG-2',
    name: '西九龙地块',
    type: 'polygon',
    coord: [114.1634, 22.2979],
    coords: [
      [114.16, 22.296],
      [114.1672, 22.2972],
      [114.1666, 22.2998],
      [114.1596, 22.2986],
    ],
    color: '#10b981',
    rows: [['类型', '地块'], ['面积', '0.51 km²'], ['用途', '文化区']],
    text: '把相机压到很低再点击该地块，弹窗会翻到点位下方，避免被视口顶部切掉。',
  },
]

const TYPE_LABEL: Record<FeatureType, string> = { point: '点', line: '线', polygon: '面' }

const CONTENT_OPTIONS: { label: string; value: ContentSize }[] = [
  { label: '短', value: 'short' },
  { label: '长', value: 'long' },
  { label: '超长', value: 'xlong' },
]

/** 箭头距弹窗左右边缘的最小距离（箭头本身宽 10px，见样式） */
const ARROW_INSET = 12

const placeMode = ref<PlaceMode>('smart')
const follow = ref(true)
const contentSize = ref<ContentSize>('short')
const margin = ref(12)
const gap = ref(10)
const popupWidth = ref(280)

const pinned = shallowRef<DemoFeature | null>(null)
const inView = ref(false)
const popupVisible = computed(() => !!pinned.value && inView.value)

const popupLeft = ref(0)
const popupTop = ref(0)
const arrowX = ref(0)
const side = ref<'top' | 'bottom'>('top')
const clampedX = ref(false)
const clampedY = ref(false)
const anchor = ref<[number, number]>([0, 0])
const viewSize = ref<[number, number]>([0, 0])
const boxSize = ref<[number, number]>([0, 0])
const popupEl = ref<HTMLElement>()

/** 弹窗实际尺寸：ResizeObserver 维护，避免每帧读 offsetHeight */
let boxW = 0
let boxH = 0

let viewer: any = null
let C: any = null
let handler: any = null
let ro: ResizeObserver | null = null
let offPostRender: (() => void) | null = null
let anchorWorld: any = null
let scratch: any = null
/** 背面判断：复用实例，每帧只更新相机位置，避免每帧 new */
let occluder: any = null

const popupStyle = computed(() => ({
  width: `${popupWidth.value}px`,
  maxWidth: `${Math.max(160, viewSize.value[0] - margin.value * 2)}px`,
  left: `${popupLeft.value}px`,
  top: `${popupTop.value}px`,
}))

/** 超长内容：追加属性行，用来验证“弹窗比视口还高”时的内部滚动 */
const extraRows = computed<[string, string][]>(() => {
  if (contentSize.value !== 'xlong') return []
  return Array.from({ length: 12 }, (_, i) => [`扩展属性 ${i + 1}`, `值 ${i + 1}`] as [string, string])
})

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function measure() {
  const el = popupEl.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (!w || !h) return
  boxW = w
  boxH = h
  boxSize.value = [w, h]
}

/**
 * 核心定位：给锚点屏幕坐标，算出弹窗左上角与箭头位置
 * - 上方放得下 → 上；放不下 → 翻到下方
 * - 左右 clamp 到 [margin, 视口宽 - 弹窗宽 - margin]
 * - 箭头单独 clamp，否则贴边时箭头会跑到弹窗外面
 */
function placeAt(ax: number, ay: number) {
  if (!boxW || !boxH) return
  const [vw, vh] = viewSize.value
  if (!vw || !vh) return

  // 不处理模式：直接用锚点算，故意让它在边缘溢出，用来对比
  if (placeMode.value === 'raw') {
    side.value = 'top'
    popupLeft.value = ax - boxW / 2
    popupTop.value = ay - gap.value - boxH
    arrowX.value = boxW / 2
    clampedX.value = false
    clampedY.value = false
    return
  }

  const canAbove = ay - gap.value - boxH >= margin.value
  const s: 'top' | 'bottom' = canAbove ? 'top' : 'bottom'
  side.value = s

  const rawLeft = ax - boxW / 2
  const rawTop = s === 'top' ? ay - gap.value - boxH : ay + gap.value
  const maxLeft = Math.max(margin.value, vw - boxW - margin.value)
  const maxTop = Math.max(margin.value, vh - boxH - margin.value)
  const left = clamp(rawLeft, margin.value, maxLeft)
  const top = clamp(rawTop, margin.value, maxTop)

  clampedX.value = Math.abs(left - rawLeft) > 0.5
  clampedY.value = Math.abs(top - rawTop) > 0.5
  popupLeft.value = left
  popupTop.value = top
  arrowX.value = clamp(ax - left, ARROW_INSET, boxW - ARROW_INSET)
}

/**
 * 每帧（postRender）把世界坐标投到屏幕并重新定位
 * 用 postRender 而不是 camera.changed：缩放 / 惯性滑行时 changed 不一定触发
 */
function tick(force = false) {
  if (!pinned.value || !viewer || !C) return
  const scene = viewer.scene
  const canvas = scene.canvas
  const vw = canvas.clientWidth
  const vh = canvas.clientHeight
  if (viewSize.value[0] !== vw || viewSize.value[1] !== vh) viewSize.value = [vw, vh]

  // 关闭跟随后不再逐帧更新（打开弹窗 / 改配置时用 force 补一次）
  if (!follow.value && !force) return

  const win = C.SceneTransforms.wgs84ToWindowCoordinates(scene, anchorWorld, scratch)
  // 背面（被地球挡住）或算不出来 → 直接隐藏，别让弹窗贴在边上不动
  if (!win) {
    inView.value = false
    return
  }
  if (occluder) {
    occluder.cameraPosition = scene.camera.positionWC
    if (!occluder.isPointVisible(anchorWorld)) {
      inView.value = false
      return
    }
  }

  // win 是 canvas 内坐标；弹窗是相对 Viewer 容器定位的，要减掉容器偏移
  const rect = canvas.getBoundingClientRect()
  const host = viewer.container?.getBoundingClientRect?.()
  const ax = win.x + rect.left - (host?.left ?? 0)
  const ay = win.y + rect.top - (host?.top ?? 0)
  anchor.value = [ax, ay]
  inView.value = ax >= 0 && ax <= vw && ay >= 0 && ay <= vh
  if (inView.value) placeAt(ax, ay)
}

async function openPopup(f: DemoFeature, world: any) {
  pinned.value = f
  anchorWorld = world
  anchor.value = [0, 0]
  inView.value = true
  await nextTick()
  measure()
  tick(true)
}

function closePopup() {
  pinned.value = null
  inView.value = false
}

function typeLabel(t: FeatureType) {
  return TYPE_LABEL[t]
}

/* ---------------- 要素绘制 ---------------- */
function addFeatures(v: any, lib: any) {
  for (const f of FEATURES) {
    if (f.type === 'point') {
      v.entities.add({
        id: f.id,
        position: lib.Cartesian3.fromDegrees(f.coord[0], f.coord[1], 0),
        billboard: {
          image: f.pin,
          width: 30,
          height: 38,
          verticalOrigin: lib.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: f.name,
          font: '600 12px "Microsoft YaHei", sans-serif',
          fillColor: lib.Color.fromCssColorString('#ffffff'),
          outlineColor: lib.Color.fromCssColorString('#0f172a'),
          outlineWidth: 3,
          style: lib.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: lib.VerticalOrigin.BOTTOM,
          pixelOffset: new lib.Cartesian2(0, -42),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    } else if (f.type === 'line') {
      v.entities.add({
        id: f.id,
        polyline: {
          positions: lib.Cartesian3.fromDegreesArray(f.coords!.flat()),
          width: 5,
          clampToGround: true,
          material: lib.Color.fromCssColorString(f.color),
        },
      })
    } else {
      const color = lib.Color.fromCssColorString(f.color)
      v.entities.add({
        id: f.id,
        polygon: {
          hierarchy: lib.Cartesian3.fromDegreesArray(f.coords!.flat()),
          material: color.withAlpha(0.45),
        },
      })
      // 描边单独一条 polyline：地面多边形自带的 outline 在贴地时不可靠
      v.entities.add({
        id: `${f.id}-outline`,
        polyline: {
          positions: lib.Cartesian3.fromDegreesArray([...f.coords!, f.coords![0]].flat()),
          width: 3,
          clampToGround: true,
          material: color,
        },
      })
    }
  }
}

function pickFeature(picked: any): DemoFeature | null {
  if (!picked?.id) return null
  const raw = typeof picked.id === 'string' ? picked.id : picked.id.id
  if (typeof raw !== 'string') return null
  const id = raw.replace('-outline', '')
  return FEATURES.find((f) => f.id === id) ?? null
}

function onLeftClick(v: any, lib: any, movement: any) {
  const f = pickFeature(v.scene.pick(movement.position))
  if (!f) {
    closePopup()
    return
  }
  let world: any = null
  try {
    if (v.scene.pickPositionSupported) world = v.scene.pickPosition(movement.position)
  } catch {
    world = null
  }
  if (!world) world = lib.Cartesian3.fromDegrees(f.coord[0], f.coord[1], 0)
  void openPopup(f, world)
}

/* ---------------- 视角 ---------------- */
function flyOverview() {
  if (!viewer || !C) return
  viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(114.169, 22.291, 6000) })
}

function flyClose() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.166, 22.289, 1500),
    orientation: { heading: 0, pitch: C.Math.toRadians(-50), roll: 0 },
  })
}

/* ---------------- 配置变化即时重算 ---------------- */
watch([placeMode, margin, gap, popupWidth], () => {
  measure()
  tick(true)
})

watch(contentSize, async () => {
  await nextTick()
  measure()
  tick(true)
})

watch(follow, () => tick(true))

onMounted(() => {
  if (!popupEl.value || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(() => {
    measure()
    if (inView.value) placeAt(anchor.value[0], anchor.value[1])
  })
  ro.observe(popupEl.value)
})

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  scratch = new lib.Cartesian2()
  try {
    occluder = new lib.EllipsoidalOccluder(lib.Ellipsoid.WGS84, v.camera.positionWC)
  } catch {
    occluder = null
  }

  addFeatures(v, lib)

  handler = new lib.ScreenSpaceEventHandler(v.scene.canvas)
  handler.setInputAction(
    (movement: any) => onLeftClick(v, lib, movement),
    lib.ScreenSpaceEventType.LEFT_CLICK,
  )

  // 新版 addEventListener 返回移除函数，老版要自己 removeEventListener
  const onPostRender = () => tick()
  const off = v.scene.postRender.addEventListener(onPostRender)
  offPostRender =
    typeof off === 'function'
      ? off
      : () => v.scene.postRender.removeEventListener(onPostRender)

  viewSize.value = [v.scene.canvas.clientWidth, v.scene.canvas.clientHeight]
  measure()
  tick(true)

  return () => {
    offPostRender?.()
    offPostRender = null
    handler?.destroy?.()
    handler = null
    ro?.disconnect()
    ro = null
    if (!v.isDestroyed?.()) v.entities.removeAll()
    pinned.value = null
    anchorWorld = null
    scratch = null
    occluder = null
    viewer = null
    C = null
  }
})
</script>

<template>
  <CesiumOverlay class="popup-panel" title="弹窗跟随与边缘避让" :width="330">
    <p class="tip">
      点击地图上的<b>点 / 线 / 面</b>弹出信息窗：弹窗跟着锚点走，遇到视口上边缘自动翻到下方，左右贴边时用 <code>clamp</code> 顶住、箭头单独夹紧。切到「不处理」可以看溢出效果。
    </p>

    <div class="row">
      <span class="row-label">定位策略</span>
      <el-radio-group v-model="placeMode" size="small" class="ctl">
        <el-radio-button value="smart">智能避让</el-radio-button>
        <el-radio-button value="raw">不处理</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">跟随视口</span>
      <el-switch v-model="follow" size="small" />
    </div>

    <div class="row">
      <span class="row-label">弹窗内容</span>
      <el-radio-group v-model="contentSize" size="small" class="ctl">
        <el-radio-button v-for="c in CONTENT_OPTIONS" :key="c.value" :value="c.value">
          {{ c.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">宽度 {{ popupWidth }}px</span>
      <el-slider v-model="popupWidth" :min="200" :max="380" :step="20" size="small" class="ctl" />
    </div>

    <div class="row">
      <span class="row-label">边距 {{ margin }}px</span>
      <el-slider v-model="margin" :min="4" :max="40" :step="2" size="small" class="ctl" />
    </div>

    <div class="row">
      <span class="row-label">箭头间距 {{ gap }}px</span>
      <el-slider v-model="gap" :min="2" :max="30" :step="2" size="small" class="ctl" />
    </div>

    <div class="stats">
      <div class="stat">
        <span class="num">{{ viewSize[0] }}×{{ viewSize[1] }}</span>
        <span class="k">视口</span>
      </div>
      <div class="stat">
        <span class="num">{{ boxSize[0] }}×{{ boxSize[1] }}</span>
        <span class="k">弹窗</span>
      </div>
      <div class="stat">
        <span class="num">{{ Math.round(anchor[0]) }},{{ Math.round(anchor[1]) }}</span>
        <span class="k">锚点</span>
      </div>
      <div class="stat">
        <span class="num">{{ side === 'top' ? '上' : '下' }}</span>
        <span class="k">方向</span>
      </div>
    </div>

    <div class="meta-line">
      贴边：
      <b :class="{ on: clampedX }">{{ clampedX ? '水平已 clamp' : '水平正常' }}</b> ·
      <b :class="{ on: clampedY }">{{ clampedY ? '垂直已 clamp' : '垂直正常' }}</b>
    </div>

    <div class="btns">
      <el-button size="small" @click="closePopup">关闭弹窗</el-button>
      <el-button size="small" @click="flyOverview">全港视角</el-button>
      <el-button size="small" type="primary" plain @click="flyClose">中环特写</el-button>
    </div>

    <p class="foot">
      定位走 <code>scene.postRender</code>（缩放、惯性滑行都能跟），尺寸靠 <code>ResizeObserver</code> 量一次，背面 / 出视口直接隐藏。
    </p>
  </CesiumOverlay>

  <!-- 弹窗本体：绝对定位在场景容器内，跟随锚点屏幕坐标 -->
  <div
    v-show="popupVisible"
    ref="popupEl"
    class="map-popup"
    :style="popupStyle"
    @mousedown.stop
    @wheel.stop
  >
    <i class="arrow" :class="side" :style="{ left: `${arrowX}px` }" />
    <template v-if="pinned">
      <header class="p-head">
        <i class="p-dot" :style="{ background: pinned.color }" />
        <span class="p-title">{{ pinned.name }}</span>
        <span class="p-tag">{{ typeLabel(pinned.type) }}</span>
        <button class="p-close" title="关闭" @click="closePopup">×</button>
      </header>
      <div class="p-body">
        <div v-for="row in [...pinned.rows, ...extraRows]" :key="row[0]" class="p-row">
          <span class="p-k">{{ row[0] }}</span>
          <span class="p-v">{{ row[1] }}</span>
        </div>
        <p v-if="contentSize !== 'short'" class="p-text">{{ pinned.text }}</p>
      </div>
      <footer class="p-foot">
        <span class="p-hint">
          {{ side === 'top' ? '弹窗在锚点上方' : '上方放不下，已翻到下方' }}
        </span>
        <el-button size="small" type="primary" plain @click="flyClose">定位</el-button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.popup-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
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
  gap: 8px;
  margin-bottom: 8px;
}
.row-label {
  flex: none;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.ctl {
  flex: 1;
  min-width: 0;
  max-width: 200px;
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
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
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
  color: #94a3b8;
}
.meta-line b.on {
  color: #1d4ed8;
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

/* ---------------- 弹窗本体 ---------------- */
.map-popup {
  position: absolute;
  /* 高于 canvas 与右下状态栏，低于左侧控制面板（顶到左上角时不影响操作） */
  z-index: 12;
  display: flex;
  flex-direction: column;
  max-height: calc(100% - 24px);
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
  color: #0f172a;
  font-size: 12px;
  will-change: left, top;
}
.arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #ffffff;
  transform: translateX(-50%) rotate(45deg);
}
.arrow.top {
  bottom: -5px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}
.arrow.bottom {
  top: -5px;
  border-left: 1px solid #e2e8f0;
  border-top: 1px solid #e2e8f0;
}
.p-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.p-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.p-title {
  flex: 1;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
}
.p-close {
  flex: none;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.p-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.p-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
}
.p-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  font-size: 11.5px;
  line-height: 1.7;
}
.p-k {
  flex: none;
  width: 62px;
  color: #94a3b8;
}
.p-v {
  flex: 1;
  color: #334155;
  word-break: break-all;
}
.p-text {
  margin: 6px 0 0;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.7;
}
.p-foot {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  border-radius: 0 0 10px 10px;
}
.p-hint {
  color: #94a3b8;
  font-size: 10.5px;
}
</style>
