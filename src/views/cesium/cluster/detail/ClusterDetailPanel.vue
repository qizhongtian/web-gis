<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { ICON_RATIO, ICONS, makeClusterBadge, type DemoPoint } from '@/composables/useCesiumPoints'

/**
 * 聚合点详情：点击聚合气泡，弹窗里列出这个聚合合并了哪些点
 *
 * 难点在“怎么知道一个气泡是由哪些点聚合出来的”：
 *   1) EntityCluster 不会把聚合实体放进 dataSource.entities，而是走内部的 cluster collection
 *   2) 唯一可靠的来源是 clustering.clusterEvent(entities, cluster)，回调里能拿到成员实体
 *   3) 聚合气泡的 billboard.id 默认为空，没法从拾取结果反推成员，
 *      所以在 clusterEvent 里给 billboard/label/point 挂上 token，点击时 pick 出来的 id 就是 token
 *   4) 单个点的 billboard.id 是可拾取的 Entity，用 WeakMap 反查点位
 *
 * 弹窗定位：锚在聚合中心，scene.postRender 逐帧投屏并做视口 clamp，被地球挡住 / 出视口自动隐藏
 */

const ICON_SIZE = 26
const LABEL_DISTANCE = 12000
const POPUP_WIDTH = 300
const MARGIN = 12
const GAP = 12

interface ClusterToken {
  members: DemoPoint[]
  /** 聚合中心的世界坐标，用作弹窗锚点 */
  position: any
}

interface PopupData {
  kind: 'cluster' | 'point'
  points: DemoPoint[]
  anchor: any
}

const count = ref(400)
const clusterEnabled = ref(true)
const clusterRange = ref(48)

const points = shallowRef<DemoPoint[]>([])
const popup = shallowRef<PopupData | null>(null)
const located = ref(false)
const inView = ref(false)
const popupEl = ref<HTMLElement>()
const popupLeft = ref(0)
const popupTop = ref(0)
const viewSize = ref<[number, number]>([0, 0])
/** 是否有弹窗内容；「锚点是否在视口内 / 是否完成首次定位」交给 is-hidden 控制，避免在左上角闪一下 */
const popupVisible = computed(() => !!popup.value)

const popupTitle = computed(() => {
  const p = popup.value
  if (!p) return ''
  if (p.kind === 'cluster') return `聚合点 · ${p.points.length} 个点位`
  return p.points[0]?.name ?? '点位'
})

/** 聚合中心 / 单点坐标，弹窗副标题展示 */
const popupCenter = computed(() => {
  const list = popup.value?.points ?? []
  if (!list.length) return ''
  const lon = list.reduce((s, p) => s + p.lon, 0) / list.length
  const lat = list.reduce((s, p) => s + p.lat, 0) / list.length
  return `${lon.toFixed(5)}, ${lat.toFixed(5)}`
})

const popupStyle = computed(() => {
  const w = Math.min(POPUP_WIDTH, Math.max(180, viewSize.value[0] - MARGIN * 2))
  return { width: `${w}px`, left: `${popupLeft.value}px`, top: `${popupTop.value}px` }
})

let viewer: any = null
let C: any = null
let ds: any = null
let handler: any = null
let offPostRender: (() => void) | null = null
let scratch: any = null
let occluder: any = null
let ro: ResizeObserver | null = null
let boxW = 0
let boxH = 0
let clusterListenerAdded = false

/** 实体 → 点位（单个点被拾取时反查） */
let entityPoint = new WeakMap<object, DemoPoint>()
/** 聚合 token：挂在聚合气泡上，拾取结果里靠它识别 */
let clusterTokens = new WeakSet<object>()
/** 聚合气泡 billboard → token：拾取结果只给 primitive 时的兜底 */
let billboardTokens = new WeakMap<object, ClusterToken>()
/** 聚合气泡按数量缓存，避免每次重算都画一遍 canvas */
const badgeCache = new Map<number, { url: string; size: number }>()

function randomPoints(n: number): DemoPoint[] {
  const list: DemoPoint[] = []
  for (let i = 0; i < n; i++) {
    list.push({
      id: i + 1,
      lon: 114.1694 + (Math.random() - 0.5) * 0.16,
      lat: 22.3193 + (Math.random() - 0.5) * 0.12,
      name: `监测点 ${i + 1}`,
      value: Math.round(Math.random() * 100),
      icon: Math.floor(Math.random() * ICONS.length),
    })
  }
  return list
}

function addEntity(p: DemoPoint) {
  const h = ICON_SIZE * ICON_RATIO
  const entity = ds.entities.add({
    position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0),
    billboard: {
      image: ICONS[p.icon % ICONS.length],
      width: ICON_SIZE,
      height: h,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: p.name,
      font: '600 12px MiSans, "Microsoft YaHei", sans-serif',
      fillColor: C.Color.fromCssColorString('#ffd400'),
      outlineColor: C.Color.BLACK,
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, -h - 4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // 几百个名字远看会糊成一片，拉近到 12 km 内才显示
      distanceDisplayCondition: new C.DistanceDisplayCondition(0, LABEL_DISTANCE),
    },
  })
  entityPoint.set(entity, p)
}

function rebuild() {
  if (!ds) return
  ds.entities.removeAll()
  entityPoint = new WeakMap()
  points.value.forEach(addEntity)
}

function applyCluster() {
  if (!ds) return
  const clustering = ds.clustering
  clustering.enabled = clusterEnabled.value
  clustering.pixelRange = clusterRange.value
  clustering.minimumClusterSize = 2

  if (clusterListenerAdded) return
  clusterListenerAdded = true
  clustering.clusterEvent.addEventListener((entities: any[], cluster: any) => {
    const n = entities.length
    let badge = badgeCache.get(n)
    if (!badge) {
      badge = makeClusterBadge(n)
      if (badgeCache.size > 400) badgeCache.clear()
      badgeCache.set(n, badge)
    }

    const members: DemoPoint[] = []
    for (const e of entities) {
      const p = entityPoint.get(e)
      if (p) members.push(p)
    }
    members.sort((a, b) => a.id - b.id)

    // 聚合气泡默认没有可拾取的 id，这里挂上 token，点击时才能反查成员
    const token: ClusterToken = {
      members,
      position: C.Cartesian3.clone(cluster.billboard.position),
    }
    clusterTokens.add(token)
    billboardTokens.set(cluster.billboard, token)
    cluster.billboard.id = token
    cluster.point.id = token
    cluster.label.id = token

    cluster.billboard.show = true
    cluster.billboard.image = badge.url
    cluster.billboard.width = badge.size
    cluster.billboard.height = badge.size
    cluster.billboard.verticalOrigin = C.VerticalOrigin.CENTER
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
    // 数字已经画在气泡里了，不要再叠一个 label
    cluster.label.show = false
  })
}

/* ---------------- 弹窗 ---------------- */
function hidePopup() {
  inView.value = false
  located.value = false
}

function closePopup() {
  popup.value = null
  hidePopup()
}

function measure() {
  const el = popupEl.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (!w || !h) return
  boxW = w
  boxH = h
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

/** 锚点屏幕坐标 → 弹窗左上角：上方放得下就放上方，否则翻到下方，左右 / 上下都夹在视口内 */
function placeAt(ax: number, ay: number, vw: number, vh: number) {
  if (!boxW || !boxH) return
  const canAbove = ay - GAP - boxH >= MARGIN
  const rawTop = canAbove ? ay - GAP - boxH : ay + GAP
  const maxTop = Math.max(MARGIN, vh - boxH - MARGIN)
  popupTop.value = clamp(rawTop, MARGIN, maxTop)
  popupLeft.value = clamp(ax - boxW / 2, MARGIN, Math.max(MARGIN, vw - boxW - MARGIN))
}

/** 每帧把聚合中心的世界坐标投到屏幕，弹窗跟着场景走 */
function tick() {
  if (!popup.value || !viewer || !C) return
  const scene = viewer.scene
  const canvas = scene.canvas
  const vw = canvas.clientWidth
  const vh = canvas.clientHeight
  if (!vw || !vh) return
  if (viewSize.value[0] !== vw || viewSize.value[1] !== vh) viewSize.value = [vw, vh]

  const win = C.SceneTransforms.wgs84ToWindowCoordinates(scene, popup.value.anchor, scratch)
  if (!win) return hidePopup()
  if (occluder) {
    occluder.cameraPosition = scene.camera.positionWC
    // 被地球挡住的点不显示弹窗，避免留下贴在屏幕边上的“幽灵”
    if (!occluder.isPointVisible(popup.value.anchor)) return hidePopup()
  }

  // win 是 canvas 内坐标，弹窗相对 Viewer 容器定位，要减掉容器偏移
  const rect = canvas.getBoundingClientRect()
  const host = viewer.container?.getBoundingClientRect?.()
  const ax = win.x + rect.left - (host?.left ?? 0)
  const ay = win.y + rect.top - (host?.top ?? 0)
  if (ax < 0 || ax > vw || ay < 0 || ay > vh) return hidePopup()

  inView.value = true
  if (!boxW || !boxH) return
  placeAt(ax, ay, vw, vh)
  located.value = true
}

async function openPopup(kind: PopupData['kind'], list: DemoPoint[], anchor: any) {
  popup.value = { kind, points: list, anchor }
  inView.value = true
  located.value = false
  await nextTick()
  measure()
  tick()
}

/* ---------------- 拾取 ---------------- */
function resolveEntity(id: any) {
  if (!id) return null
  // 老版本 Cesium 的 billboard.id 是字符串，新版本是 Entity 本身
  if (typeof id === 'string') return ds?.entities.getById(id) ?? null
  if (typeof id === 'object' && typeof id.id === 'string') return id
  return null
}

function onClick(movement: any) {
  if (!viewer || !C) return
  const picked = viewer.scene.pick(movement.position)
  if (!C.defined(picked) || !picked.id) return closePopup()

  const id = picked.id
  // 聚合气泡：优先看 id（我们自己挂的 token），兜底看 primitive
  const token =
    (id && typeof id === 'object' && clusterTokens.has(id) ? (id as ClusterToken) : null) ??
    billboardTokens.get(picked.primitive) ??
    billboardTokens.get(id)
  if (token) {
    void openPopup('cluster', token.members, token.position)
    return
  }

  const entity = resolveEntity(id)
  const p = entity ? entityPoint.get(entity) : null
  if (p) {
    void openPopup('point', [p], C.Cartesian3.fromDegrees(p.lon, p.lat, 0))
    return
  }
  closePopup()
}

/** 鼠标移到聚合气泡 / 点位上时给个手型光标，提示可点击 */
function onMove(movement: any) {
  if (!viewer) return
  const picked = viewer.scene.pick(movement.endPosition)
  const id = picked?.id
  const hit = !!id && (clusterTokens.has(id) || !!entityPoint.get(resolveEntity(id)))
  viewer.scene.canvas.style.cursor = hit ? 'pointer' : ''
}

/* ---------------- 交互 ---------------- */
function generate(n = count.value) {
  if (n <= 0) return
  count.value = n
  closePopup()
  points.value = randomPoints(n)
  rebuild()
  applyCluster()
}

/** 清空点位但保留数量输入，方便一键重新生成 */
function clearPoints() {
  closePopup()
  points.value = []
  if (!ds) return
  ds.entities.removeAll()
  entityPoint = new WeakMap()
}

function flyToPoint(p: DemoPoint) {
  if (!viewer || !C) return
  // 用包围球定位，保证目标落在屏幕正中（否则细长的弹窗锚点容易飘出视口）
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(p.lon, p.lat, 0), 300), {
    duration: 1.4,
  })
  closePopup()
}

function flyToCluster() {
  if (!viewer || !C || !popup.value) return
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(popup.value.anchor, 600), { duration: 1.4 })
}

function resetView() {
  if (!viewer || !C) return
  closePopup()
  viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(114.1694, 22.3193, 42000) })
}

watch([clusterEnabled, clusterRange], () => {
  applyCluster()
  closePopup()
})

onMounted(() => {
  if (!popupEl.value || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(() => {
    measure()
    if (popup.value && inView.value) tick()
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

  const source = new lib.CustomDataSource('cluster-detail-points')
  ds = source
  v.dataSources.add(source)
  generate(count.value)

  handler = new lib.ScreenSpaceEventHandler(v.scene.canvas)
  handler.setInputAction((m: any) => onClick(m), lib.ScreenSpaceEventType.LEFT_CLICK)
  handler.setInputAction((m: any) => onMove(m), lib.ScreenSpaceEventType.MOUSE_MOVE)

  const onPostRender = () => tick()
  const off = v.scene.postRender.addEventListener(onPostRender)
  offPostRender = typeof off === 'function' ? off : () => v.scene.postRender.removeEventListener(onPostRender)

  viewSize.value = [v.scene.canvas.clientWidth, v.scene.canvas.clientHeight]

  return () => {
    offPostRender?.()
    offPostRender = null
    handler?.destroy?.()
    handler = null
    ro?.disconnect()
    ro = null
    if (!v.isDestroyed?.()) v.dataSources.remove(source, true)
    ds = null
    points.value = []
    clusterListenerAdded = false
    clusterTokens = new WeakSet()
    billboardTokens = new WeakMap()
    entityPoint = new WeakMap()
    closePopup()
    scratch = null
    occluder = null
    viewer = null
    C = null
  }
})
</script>

<template>
  <CesiumOverlay title="聚合点详情" class="absolute left-3 top-3 z-20" :width="290">
    <div class="row">
      <span class="label">数量</span>
      <el-input-number v-model="count" :min="0" :max="3000" :step="100" size="small" controls-position="right" class="flex-1" />
      <el-button size="small" type="primary" @click="generate()">生成</el-button>
      <el-button size="small" plain :disabled="!points.length" @click="clearPoints">清空</el-button>
    </div>

    <div class="row">
      <span class="label">聚合</span>
      <el-switch v-model="clusterEnabled" size="small" />
      <span class="value">{{ clusterEnabled ? '点击气泡查看成员' : '点击单个点位' }}</span>
    </div>

    <div class="slider-row" :class="{ disabled: !clusterEnabled }">
      <span class="label">聚合半径</span>
      <el-slider v-model="clusterRange" :min="20" :max="120" :step="4" size="small" :disabled="!clusterEnabled" />
      <b>{{ clusterRange }}</b>
    </div>

    <div class="btns">
      <el-button size="small" :disabled="!popup" @click="flyToCluster">定位聚合</el-button>
      <el-button size="small" :disabled="!popup" @click="closePopup">关闭弹窗</el-button>
      <el-button size="small" plain class="span-2" @click="resetView">重置视角</el-button>
    </div>

    <p class="hint">
      当前 <b>{{ points.length }}</b> 个点位。点击 <b>聚合气泡</b> 后弹窗列出被合并的全部点位，
      点列表任意一行可飞至该点；关闭聚合后则直接点单个点位查看详情。
    </p>
  </CesiumOverlay>

  <!-- 弹窗本体：绝对定位在 Viewer 容器内，跟随聚合中心 -->
  <div
    v-show="popupVisible"
    ref="popupEl"
    class="map-popup"
    :class="{ 'is-hidden': !inView || !located }"
    :style="popupStyle"
    @mousedown.stop
    @wheel.stop
  >
    <template v-if="popup">
      <header class="p-head">
        <i class="p-dot" :class="popup.kind" />
        <span class="p-title">{{ popupTitle }}</span>
        <button class="p-close" title="关闭" @click="closePopup">×</button>
      </header>
      <div class="p-sub">
        <span>{{ popup.kind === 'cluster' ? '聚合中心' : '坐标' }}</span>
        <b>{{ popupCenter }}</b>
      </div>
      <div class="p-body">
        <button
          v-for="(p, i) in popup.points"
          :key="p.id"
          class="p-row"
          type="button"
          :title="`飞至 ${p.name}`"
          @click="flyToPoint(p)"
        >
          <span class="p-idx">{{ i + 1 }}</span>
          <span class="p-name">{{ p.name }}</span>
          <span class="p-val">{{ p.value }}</span>
          <span class="p-coord">{{ p.lon.toFixed(5) }}, {{ p.lat.toFixed(5) }}</span>
        </button>
      </div>
      <footer class="p-foot">
        <span class="p-hint">{{ popup.points.length > 1 ? '点击行飞至该点位' : '点击按钮定位到该点位' }}</span>
        <el-button size="small" type="primary" plain @click="flyToCluster">定位</el-button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.label {
  flex: 0 0 48px;
  color: #6b7280;
  font-size: 12px;
}
.value {
  font-size: 11px;
  color: #9ca3af;
}
.slider-row {
  display: grid;
  grid-template-columns: 48px 1fr 30px;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.slider-row.disabled {
  opacity: 0.5;
}
.btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 6px;
}
.btns .el-button {
  width: 100%;
  margin-left: 0;
}
.btns .span-2 {
  grid-column: 1 / -1;
}
.hint {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 10px;
  line-height: 1.5;
  color: #9ca3af;
}
.hint b {
  color: #6b7280;
}

/* ---------------- 弹窗本体 ---------------- */
.map-popup {
  position: absolute;
  /* 高于左侧控制面板：贴到左侧时也不会被面板裁掉 */
  z-index: 30;
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
/* 出视口 / 尚未定位时用 visibility 而不是 display，保证能测到尺寸 */
.map-popup.is-hidden {
  visibility: hidden;
  pointer-events: none;
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
  background: #2563eb;
}
.p-dot.cluster {
  background: #ea580c;
  box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.14);
}
.p-title {
  flex: 1;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.p-sub {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 10.5px;
}
.p-sub b {
  color: #475569;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.p-body {
  flex: 1;
  min-height: 0;
  max-height: 248px;
  overflow: auto;
  padding: 4px;
}
.p-row {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.p-row:hover {
  background: #eff6ff;
}
.p-idx {
  color: #cbd5e1;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.p-name {
  overflow: hidden;
  color: #334155;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-val {
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.p-coord {
  grid-column: 2 / 4;
  margin-top: -2px;
  color: #9ca3af;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
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
