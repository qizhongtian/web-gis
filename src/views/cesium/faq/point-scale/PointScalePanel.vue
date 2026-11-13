<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 常见问题：大量点 + 视角拉近拉远，图标（和 label）要近大远小
 *
 * 四个关键点：
 *   1) 集合选 BillboardCollection / LabelCollection（批处理），不要 Entity（每帧逐实体求值）
 *   2) 近大远小交给 scaleByDistance = NearFarScalar，Cesium 渲染时算，不用监听相机
 *   3) label 的文字要复用（字形图集不膨胀），并用 distanceDisplayCondition 限制最远显示距离
 *   4) 参数热更新只改属性、不重建集合；换数量 / 换贴图张数才重建
 */

type ScaleMode = 'distance' | 'pixel'

/** public/image 下的图钉（跳过不存在的 map-pin-01） */
const IMAGE_URLS = [0, ...Array.from({ length: 23 }, (_, i) => i + 2)].map(
  (n) => `/image/map-pin-${String(n).padStart(2, '0')}.png`,
)

const COUNT_TIERS = [
  { label: '500 点', value: 500 },
  { label: '1 000 点', value: 1000 },
  { label: '2 000 点', value: 2000 },
  { label: '3 000 点', value: 3000 },
  { label: '5 000 点', value: 5000 },
]

const IMAGE_TIERS = [
  { label: '1 张', value: 1 },
  { label: '4 张', value: 4 },
  { label: '8 张', value: 8 },
  { label: '24 张', value: 24 },
]

/** 名称只从这几个词里组合：5000 个 label 也只有十几套字形，图集不会膨胀 */
const NAME_POOL = [
  '维港',
  '中环',
  '尖沙咀',
  '铜锣湾',
  '旺角',
  '深水埗',
  '观塘',
  '荃湾',
  '沙田',
  '大埔',
  '屯门',
  '将军澳',
]

const count = ref(2000)
const imageCount = ref(8)
const scaleMode = ref<ScaleMode>('distance')
const near = ref(300)
const nearScale = ref(2.2)
const far = ref(12000)
const farScale = ref(0.25)
const baseSize = ref(30)
/** 默认开：点贴椭球面 + 深度测试会互相 z-fighting，图钉偶尔被地表切掉 */
const depthFree = ref(true)
const resolution = ref(1)

/* label：默认固定像素（拉远也读得清），可切「跟图标一起缩放」 */
const showLabels = ref(true)
const labelSize = ref(12)
const labelScale = ref(false)
const labelMaxDist = ref(25000)

const fps = ref(0)
const built = ref(0)
const buildMs = ref(0)
const camHeight = ref(0)

/** far 必须大于 near，否则 NearFarScalar 直接抛错 */
const farValue = computed(() => Math.max(near.value + 500, far.value))
const scaleText = computed(() =>
  scaleMode.value === 'distance'
    ? `${nearScale.value.toFixed(1)}× → ${farScale.value.toFixed(2)}×`
    : '固定像素',
)

let viewer: any = null
let C: any = null
let collection: any = null
let labels: any = null
let positions: any[] = []
let texts: string[] = []
/** 每帧不 new：这些对象在 Label 构造/赋值时会被 clone，共享是安全的 */
let labelFill: any = null
let labelOutline: any = null
let offPost: (() => void) | null = null
let rafId = 0
let frames = 0
let lastAt = performance.now()

/* ---------------- 随机点位（确定性，切数量时前 N 个不变） ---------------- */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 香港城区范围，均匀撒点；点位不聊天，只要够密才能看出缩放效果 */
const BBOX = { west: 113.94, east: 114.32, south: 22.18, north: 22.43 }

function buildPositions(n: number) {
  const rnd = mulberry32(20261112)
  const arr: any[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const lon = BBOX.west + rnd() * (BBOX.east - BBOX.west)
    const lat = BBOX.south + rnd() * (BBOX.north - BBOX.south)
    arr[i] = C.Cartesian3.fromDegrees(lon, lat)
  }
  return arr
}

/** 名称从词池里循环拼：只有 12 个词 + 数字，字形图集很小 */
function buildTexts(n: number) {
  const arr: string[] = new Array(n)
  for (let i = 0; i < n; i++) {
    arr[i] = `${NAME_POOL[i % NAME_POOL.length]}-${Math.floor(i / NAME_POOL.length) + 1}`
  }
  return arr
}

/* ---------------- 距离缩放参数 ---------------- */
function makeNfs() {
  return new C.NearFarScalar(near.value, nearScale.value, farValue.value, farScale.value)
}

/**
 * 重建集合：只在「数量 / 贴图张数 / 基准宽度 / 深度测试」变化时调用。
 * 位置数组缓存，换数量只重算一次 fromDegrees。
 */
function rebuild() {
  if (!viewer || !C) return
  const t0 = performance.now()
  const n = count.value

  if (positions.length !== n) {
    positions = buildPositions(n)
    texts = buildTexts(n)
  }

  if (!labelFill) {
    labelFill = C.Color.fromCssColorString('#ffffff')
    labelOutline = C.Color.fromCssColorString('#0f172a')
  }

  if (!collection) {
    collection = new C.BillboardCollection()
    viewer.scene.primitives.add(collection)
  }
  collection.removeAll()

  const nfs = scaleMode.value === 'distance' ? makeNfs() : undefined
  const depth = depthFree.value ? Number.POSITIVE_INFINITY : 0
  const imgs = IMAGE_URLS.slice(0, imageCount.value)
  const width = baseSize.value
  // 只给 width 时 Cesium 不会按比例算 height（height 会回落到图片原始高度），
  // 图钉要自己按宽高比给 height，否则会被拉扁
  const height = Math.round(width * 1.3)

  for (let i = 0; i < n; i++) {
    collection.add({
      position: positions[i],
      image: imgs[i % imgs.length],
      width,
      height,
      // 针尖落在点位上，缩放时底部不动，视觉不飘
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      scaleByDistance: nfs,
      disableDepthTestDistance: depth,
    })
  }

  if (!labels) {
    labels = new C.LabelCollection()
    viewer.scene.primitives.add(labels)
  }
  rebuildLabels(false)

  built.value = collection.length
  buildMs.value = Math.round(performance.now() - t0)
  viewer.scene.requestRender()
}

/**
 * label 单独一个 LabelCollection：和 billboard 同一批位置，但换字号 / 换最大距离
 * 只重建 label，不动图钉。
 * 每个 label 的 position/text/font 都相同量级，成本主要在字形：文字复用 → 图集小。
 */
function rebuildLabels(request = true) {
  if (!viewer || !C || !labels) return
  labels.removeAll()
  const n = count.value
  if (!showLabels.value) {
    if (request) viewer.scene.requestRender()
    return
  }

  const depth = depthFree.value ? Number.POSITIVE_INFINITY : 0
  const distanceMode = scaleMode.value === 'distance'
  // 文字本身是否也跟着图标缩小（默认不，保持可读）
  const nfs = labelScale.value && distanceMode ? makeNfs() : undefined
  const font = `600 ${labelSize.value}px "Microsoft YaHei", sans-serif`
  // 超过这个距离不显示文字：远处 5000 条文字既看不清也最费 CPU
  const ddc = new C.DistanceDisplayCondition(0, Math.max(labelMaxDist.value, 100))
  // 文字挂在图钉顶端「上方」：底边对齐到 图标高度 + 2px 的位置（负 y = 向上）
  const iconH = Math.round(baseSize.value * 1.3)
  const offset = new C.Cartesian2(0, -iconH - 2)
  // 图标会按距离缩到 2.2×/0.25×，偏移量必须跟着缩放，否则拉近后文字压在图钉身上
  const offsetNfs = distanceMode ? makeNfs() : undefined

  for (let i = 0; i < n; i++) {
    labels.add({
      position: positions[i],
      text: texts[i],
      font,
      fillColor: labelFill,
      outlineColor: labelOutline,
      outlineWidth: 2,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: C.HorizontalOrigin.CENTER,
      // BOTTOM + 负方向偏移 = 整条文字落在图钉顶尖上方
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: offset,
      pixelOffsetScaleByDistance: offsetNfs,
      scaleByDistance: nfs,
      distanceDisplayCondition: ddc,
      disableDepthTestDistance: depth,
    })
  }

  if (request) viewer.scene.requestRender()
}

/** 热更新：只遍历改属性，不重建集合（5 千点 < 5 ms） */
function applyScale() {
  if (!viewer || !C || !collection) return
  const nfs = scaleMode.value === 'distance' ? makeNfs() : undefined
  const n = collection.length
  for (let i = 0; i < n; i++) collection.get(i).scaleByDistance = nfs

  if (labels) {
    const labelNfs = labelScale.value ? nfs : undefined
    const ln = labels.length
    for (let i = 0; i < ln; i++) {
      const lb = labels.get(i)
      lb.scaleByDistance = labelNfs
      // 偏移量始终跟图标缩放同步，文字才不会跑到图钉身上
      lb.pixelOffsetScaleByDistance = nfs
    }
  }
  viewer.scene.requestRender()
}

/** 滑块拖动时合并到一帧，避免每个 input 事件都跑一遍 5 万次循环 */
function scheduleScale() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    applyScale()
  })
}

function scheduleRebuild() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  rebuild()
}

/* ---------------- FPS / 相机高度：postRender 里只计数 ---------------- */
function onPostRender() {
  frames++
  const now = performance.now()
  const dt = now - lastAt
  if (dt < 500 || !viewer) return
  fps.value = Math.round((frames * 1000) / dt)
  frames = 0
  lastAt = now
  camHeight.value = Math.round(viewer.camera.positionCartographic.height)
}

/* ---------------- 视角 ---------------- */
function flyOverview() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.17, 22.33, 22000),
    orientation: {
      heading: C.Math.toRadians(0),
      pitch: C.Math.toRadians(-55),
      roll: 0,
    },
    duration: 1.4,
  })
}

function flyClose() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.162, 22.287, 900),
    orientation: {
      heading: C.Math.toRadians(0),
      pitch: C.Math.toRadians(-45),
      roll: 0,
    },
    duration: 1.4,
  })
}

function resetParams() {
  count.value = 2000
  imageCount.value = 8
  scaleMode.value = 'distance'
  near.value = 300
  nearScale.value = 2.2
  far.value = 12000
  farScale.value = 0.25
  baseSize.value = 30
  depthFree.value = true
  resolution.value = 1
  showLabels.value = true
  labelSize.value = 12
  labelScale.value = false
  labelMaxDist.value = 25000
}

/* ---------------- 联动 ---------------- */
// 数量 / 贴图 / 宽度 / 深度测试：图钉和 label 一起重建
watch([count, imageCount, baseSize, depthFree], scheduleRebuild)
// 距离参数：只改属性
watch([scaleMode, near, far, nearScale, farScale, labelScale], scheduleScale)
// 只影响 label 的：单独重建 label，不动图钉
watch([showLabels, labelSize, labelMaxDist], () => rebuildLabels())
watch(resolution, (v) => {
  if (viewer) viewer.resolutionScale = v
})

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  positions = []
  texts = []
  v.resolutionScale = resolution.value
  rebuild()

  offPost = v.scene.postRender.addEventListener(onPostRender)

  return () => {
    offPost?.()
    offPost = null
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (v.isDestroyed?.()) return
    if (labels) v.scene.primitives.remove(labels)
    if (collection) v.scene.primitives.remove(collection)
    labels = null
    collection = null
    positions = []
    texts = []
    labelFill = null
    labelOutline = null
    viewer = null
    C = null
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
})
</script>

<template>
  <CesiumOverlay class="point-scale-panel" title="海量点图标随距离缩放" :width="318" fill>
    <p class="tip">
      <code>BillboardCollection</code> 画图标、<code>LabelCollection</code> 画文字，共 <b>{{ built }}</b> 个点。图标大小由
      <code>scaleByDistance</code> 按相机距离决定：拉远变小、拉近变大，两端自带上下限；label 可独立设字号、最远显示距离，也能跟着一起缩放。
    </p>

    <div class="row">
      <span class="row-label">点位数量</span>
      <el-select v-model="count" size="small" class="mode">
        <el-option v-for="t in COUNT_TIERS" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
    </div>

    <div class="row">
      <span class="row-label">贴图张数</span>
      <el-radio-group v-model="imageCount" size="small" class="ctl">
        <el-radio-button v-for="t in IMAGE_TIERS" :key="t.value" :value="t.value">
          {{ t.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">缩放模式</span>
      <el-radio-group v-model="scaleMode" size="small" class="ctl">
        <el-radio-button value="distance">按距离缩放</el-radio-button>
        <el-radio-button value="pixel">固定像素</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">near {{ near }} m</span>
      <el-slider v-model="near" :min="50" :max="3000" :step="50" size="small" class="ctl" />
    </div>
    <div class="row">
      <span class="row-label">nearScale {{ nearScale.toFixed(1) }}×</span>
      <el-slider v-model="nearScale" :min="0.5" :max="4" :step="0.1" size="small" class="ctl" />
    </div>
    <div class="row">
      <span class="row-label">far {{ far }} m</span>
      <el-slider v-model="far" :min="2000" :max="40000" :step="1000" size="small" class="ctl" />
    </div>
    <div class="row">
      <span class="row-label">farScale {{ farScale.toFixed(2) }}×</span>
      <el-slider v-model="farScale" :min="0.02" :max="1.5" :step="0.02" size="small" class="ctl" />
    </div>
    <div class="row">
      <span class="row-label">图标宽度 {{ baseSize }} px</span>
      <el-slider v-model="baseSize" :min="16" :max="48" :step="2" size="small" class="ctl" />
    </div>

    <div class="row">
      <span class="row-label">显示 label</span>
      <el-switch v-model="showLabels" size="small" />
    </div>
    <div class="row" :class="{ dim: !showLabels }">
      <span class="row-label">label 字号 {{ labelSize }} px</span>
      <el-slider
        v-model="labelSize"
        :min="10"
        :max="18"
        :step="1"
        size="small"
        class="ctl"
        :disabled="!showLabels"
      />
    </div>
    <div class="row" :class="{ dim: !showLabels }">
      <span class="row-label">label 随距离缩放</span>
      <el-switch v-model="labelScale" size="small" :disabled="!showLabels" />
    </div>
    <div class="row" :class="{ dim: !showLabels }">
      <span class="row-label">label 最远 {{ labelMaxDist }} m</span>
      <el-slider
        v-model="labelMaxDist"
        :min="2000"
        :max="40000"
        :step="1000"
        size="small"
        class="ctl"
        :disabled="!showLabels"
      />
    </div>

    <div class="row">
      <span class="row-label">始终置顶（关深度测试）</span>
      <el-switch v-model="depthFree" size="small" />
    </div>
    <div class="row">
      <span class="row-label">渲染分辨率 {{ resolution.toFixed(2) }}</span>
      <el-slider v-model="resolution" :min="0.6" :max="1" :step="0.05" size="small" class="ctl" />
    </div>

    <div class="stats">
      <div class="stat">
        <span class="num" :class="{ warn: fps > 0 && fps < 30 }">{{ fps || '—' }}</span>
        <span class="k">FPS</span>
      </div>
      <div class="stat">
        <span class="num">{{ built }}</span>
        <span class="k">点数</span>
      </div>
      <div class="stat">
        <span class="num">{{ camHeight }}</span>
        <span class="k">相机高度 m</span>
      </div>
      <div class="stat">
        <span class="num">{{ buildMs }}</span>
        <span class="k">重建 ms</span>
      </div>
    </div>

    <p class="meta-line">
      当前缩放：<b>{{ scaleText }}</b>（near 端 → far 端，距离越远取越小的值）
    </p>

    <div class="btns">
      <el-button size="small" @click="flyOverview">全港视角</el-button>
      <el-button size="small" type="primary" plain @click="flyClose">中环特写</el-button>
      <el-button size="small" @click="resetParams">重置</el-button>
    </div>

    <p class="foot">
      对照：切「固定像素」后拉远，图标不再缩小 → 点全糊在一起；这正是需要
      <code>scaleByDistance</code> 的原因。
    </p>
    <p class="foot">
      改 near / far / scale 只遍历改属性（不重建集合）；改数量 / 贴图张数才会重建，看「重建 ms」即可。
    </p>
    <p class="foot">
      label 成本全在字形：这里只用 12 个词的组合，字形图集很小；再用
      <code>distanceDisplayCondition</code> 把远处文字剔掉，5000 条也不掉帧。
    </p>
    <p class="foot">
      文字固定在图钉顶端上方：<code>pixelOffset</code> 取图标高度的负值，再配
      <code>pixelOffsetScaleByDistance</code> 让偏移跟着图标一起缩放，拉近拉远都不会压到图钉。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.point-scale-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
}
/* 展开时高度铺满地图：上 12 下 12，滚动交给 CesiumOverlay 的 panel-body */
.point-scale-panel.is-fill.is-fill {
  bottom: 12px;
  /* 组件的 .is-fill 写死了 height:100%，在 top/bottom 定位下会多溢出 12px，
     这里用重复类抬特异性把高度交还给 top/bottom */
  height: auto;
}
/* 折叠时只剩标题栏，不撑满 */
.point-scale-panel:not(.is-fill) {
  max-height: calc(100% - 24px);
  overflow-y: auto;
}
.tip {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.6;
}
.tip b {
  color: #1d4ed8;
  font-variant-numeric: tabular-nums;
}
.tip code,
.foot code {
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
  margin-bottom: 6px;
}
.row-label {
  flex: none;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.row.dim .row-label {
  color: #cbd5e1;
}
.mode {
  width: 120px;
}
.ctl {
  flex: 1;
  min-width: 0;
  max-width: 190px;
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
.num.warn {
  color: #dc2626;
}
.k {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}
.meta-line {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.55;
}
.meta-line b {
  color: #1d4ed8;
  font-variant-numeric: tabular-nums;
}
.btns {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.btns .el-button {
  flex: 1;
  margin-left: 0;
  padding-left: 6px;
  padding-right: 6px;
}
.foot {
  margin: 0;
  color: #94a3b8;
  font-size: 10.5px;
  line-height: 1.6;
}
</style>
