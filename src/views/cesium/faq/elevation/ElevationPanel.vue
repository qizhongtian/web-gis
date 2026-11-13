<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { createTerrainProvider, defaultMeshTilesetUrl, defaultTerrainServiceUrl } from '@/utils/gis/cesiumConfig'
import { assetUrl } from '@/utils/publicUrl'

/**
 * 常见问题：点位只有经纬度、没有高程，如何取出具体的高度数值
 *
 * 和「点位贴地」页的区别：
 *   那边用 heightReference 让 Cesium 自己贴，拿不到数值；
 *   这边自己算高度（tileset.getHeight + sampleTerrainMostDetailed），
 *   再以绝对高度 + HeightReference.NONE 渲染，表格里就是算出来的数字。
 */

type Source = 'tiles' | 'terrain' | 'ellipsoid' | 'pending'

interface DemoPoint {
  id: string
  name: string
  lon: number
  lat: number
  /** 算出来的绝对高度（米） */
  height: number
  source: Source
}

/** 默认地址与「工具 → 高程提取」页面保持一致：全球高程服务 */
const DEFAULT_TILT_URL = defaultMeshTilesetUrl
const DEFAULT_TERRAIN_URL = defaultTerrainServiceUrl

const PIN_IMAGE = assetUrl('image/map-pin-02.png')

/** mock：香港区域点位，只有经纬度，没有任何高程 */
const RAW_POINTS = [
  { id: 'HK-01', name: '中环海滨', lon: 114.16178, lat: 22.28692 },
  { id: 'HK-02', name: '中环码头', lon: 114.16218, lat: 22.28698 },
  { id: 'HK-03', name: '爱丁堡广场', lon: 114.162, lat: 22.28726 },
  { id: 'HK-04', name: '国际金融中心', lon: 114.1598, lat: 22.2857 },
  { id: 'HK-05', name: '金紫荆广场', lon: 114.1733, lat: 22.2839 },
  { id: 'HK-06', name: '尖沙咀钟楼', lon: 114.1694, lat: 22.293 },
  { id: 'HK-07', name: '太平山顶', lon: 114.144, lat: 22.271 },
  { id: 'HK-08', name: '旺角', lon: 114.1694, lat: 22.3193 },
  { id: 'HK-09', name: '沙田', lon: 114.1878, lat: 22.3774 },
  { id: 'HK-10', name: '青衣', lon: 114.1073, lat: 22.3444 },
  { id: 'HK-11', name: '赤鱲角机场', lon: 113.9145, lat: 22.3084 },
  { id: 'HK-12', name: '西贡', lon: 114.273, lat: 22.3816 },
]

/**
 * 分散锚点：覆盖港岛 / 九龙 / 新界 / 大屿山 / 离岛
 * 撒点时按锚点轮转 + 簇内抖动，点位铺满全港，也能看出“分散点位采样更慢”
 */
const SPREAD_ANCHORS = [
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

/** 点位规模档位：用来演示取值耗时与分片进度 */
const POINT_TIERS = [
  { label: '12 个点位（示范）', value: 12 },
  { label: '500 个点位', value: 500 },
  { label: '2000 个点位', value: 2000 },
  { label: '5000 个点位', value: 5000 },
]
/** 默认 12 个：进页面先看到结果，量大的档位手动切 */
const pointTier = ref(12)

/** 表格最多渲染多少行：点位多时只列前 N 行，避免上万 DOM 节点 */
const MAX_ROWS = 100

/** 确定性伪随机：同一点位数多次重建，位置保持不变 */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function buildPoints(n: number): DemoPoint[] {
  if (n <= RAW_POINTS.length) {
    return RAW_POINTS.map((p) => ({ ...p, height: 0, source: 'pending' as Source }))
  }
  const rand = seeded(n * 7919 + 17)
  // 簇内抖动约 ±500m：块内散开，又不至于漂到海里
  const JITTER = 0.0045
  const list: DemoPoint[] = []
  for (let i = 0; i < n; i++) {
    const a = SPREAD_ANCHORS[i % SPREAD_ANCHORS.length]
    const seq = Math.floor(i / SPREAD_ANCHORS.length) + 1
    list.push({
      id: `P-${i}`,
      name: `${a.name} ${String(seq).padStart(3, '0')}`,
      lon: a.lon + (rand() - 0.5) * 2 * JITTER,
      lat: a.lat + (rand() - 0.5) * 2 * JITTER,
      height: 0,
      source: 'pending',
    })
  }
  return list
}

const points = ref<DemoPoint[]>(buildPoints(12))
/** 表格实际渲染的行（受 MAX_ROWS 限制） */
const shownRows = computed(() => points.value.slice(0, MAX_ROWS))
/**
 * label 的显示条件：相机到点位的距离 0~2000 m 才显示（和点位数量无关）。
 * 交给 distanceDisplayCondition，Cesium 每帧按距离自己裁剪，不用监听相机、不用手动显隐。
 */
const LABEL_DISTANCE = 2000
/** 取值进度 0~100 */
const progress = ref(0)
/** 最近一次取值时间 */
const syncedAt = ref('')

const tiltUrl = ref(DEFAULT_TILT_URL)
const terrainUrl = ref(DEFAULT_TERRAIN_URL)
/** 默认都打开：进页面就能直接取值，不用先点开关 */
const tilesOn = ref(true)
const terrainOn = ref(true)
const loadingTiles = ref(false)
const loadingTerrain = ref(false)
const busy = ref(false)
/** 面板内联错误提示（toast 会消失，这里常驻，便于排查） */
const tilesError = ref('')
const terrainError = ref('')

const tileset = shallowRef<any>(null)
/** 一次遍历出统计，点位上万时也不做 3 次 filter */
const summary = computed(() => {
  let tiles = 0
  let terrain = 0
  let ellipsoid = 0
  for (const p of points.value) {
    if (p.source === 'tiles') tiles++
    else if (p.source === 'terrain') terrain++
    else if (p.source === 'ellipsoid') ellipsoid++
  }
  return { tiles, terrain, ellipsoid }
})

let viewer: any = null
let C: any = null
/** 取值任务序号，避免异步覆盖新结果 */
let resolveSeq = 0
let taskOffs: Array<() => void> = []

function msgOf(e: any) {
  return e?.message || String(e)
}

/** 点位渲染：绝对高度 + NONE，针尖落在算出来的高度上 */
function syncEntities() {
  if (!viewer || !C) return
  const NONE = C.HeightReference.NONE
  for (const p of points.value) {
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, p.height)
    const entity = viewer.entities.getById(p.id)
    if (entity) {
      entity.position = position
      continue
    }
    viewer.entities.add({
      id: p.id,
      position,
      billboard: {
        image: PIN_IMAGE,
        width: 34,
        height: 44,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        heightReference: NONE,
      },
      label: {
        text: p.name,
        font: '600 14px "Microsoft YaHei", sans-serif',
        fillColor: C.Color.fromCssColorString('#FFD400'),
        outlineColor: C.Color.WHITE,
        outlineWidth: 4,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        pixelOffset: new C.Cartesian2(0, -46),
        showBackground: false,
        heightReference: NONE,
        // 视角距离 0~2000 m 才显示文字，拉远自动隐藏
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, LABEL_DISTANCE),
      },
    })
  }
}

/** 让出主线程一帧：分片计算的间隙，避免整页冻结 */
function yieldTick() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else window.setTimeout(resolve, 0)
  })
}

/**
 * 倾斜摄影每片点数：getHeight 是同步 API，一次约 3ms/点，
 * 120 点一片 ≈ 360ms，实测最大帧间隔 ~0.4s（不分片是 16s）
 */
const TILES_CHUNK = 120
/** 地形每片点数：点位分散时每个点都可能触发新瓦片请求，不能一次全丢进去 */
const TERRAIN_CHUNK = 300

/**
 * 逐点取高度
 *   倾斜摄影：tileset.getHeight() —— 同步、和相机在哪无关，但是 O(点数 × 瓦片树)，必须分片
 *   地形：sampleTerrainMostDetailed —— 会加载最精细层级，按经度纬度分片提交
 *   倾斜优先 + 地形兜底，都没有 → 椭球面 0
 */
async function resolveAll() {
  if (!viewer || !C) return
  const seq = ++resolveSeq
  busy.value = true
  progress.value = 0
  const list = points.value
  const total = list.length
  try {
    const scene = viewer.scene
    const terrainH: number[] = new Array(total).fill(0)

    // 1) 地形高程（分片异步采样）
    if (terrainOn.value) {
      const provider = viewer.terrainProvider
      for (let i = 0; i < total; i += TERRAIN_CHUNK) {
        // 页面已卸载 / 有新任务时，C 会被置空，这里必须先退出
        if (seq !== resolveSeq || !C) return
        const end = Math.min(i + TERRAIN_CHUNK, total)
        const cartos: any[] = []
        for (let k = i; k < end; k++) {
          cartos.push(C.Cartographic.fromDegrees(list[k].lon, list[k].lat))
        }
        try {
          const sampled = await C.sampleTerrainMostDetailed(provider, cartos)
          if (seq !== resolveSeq) return
          sampled.forEach((c: any, k: number) => {
            if (Number.isFinite(c?.height)) terrainH[i + k] = c.height
          })
        } catch {
          /* 本片采样失败就保留 0 */
        }
        progress.value = Math.round((end / total) * 50)
        await yieldTick()
        if (seq !== resolveSeq) return
      }
    }

    // 2) 倾斜摄影 / 3D Tiles 表面（同步 API，自己切片）
    const ts = tileset.value
    for (let i = 0; i < total; i += TILES_CHUNK) {
      if (seq !== resolveSeq || !C) return
      const end = Math.min(i + TILES_CHUNK, total)
      for (let k = i; k < end; k++) {
        const p = list[k]
        let height = terrainOn.value ? terrainH[k] : 0
        let source: Source = terrainOn.value ? 'terrain' : 'ellipsoid'
        if (tilesOn.value && ts) {
          const h = ts.getHeight?.(C.Cartographic.fromDegrees(p.lon, p.lat), scene)
          if (Number.isFinite(h) && (!terrainOn.value || h > height)) {
            height = h
            source = 'tiles'
          }
        }
        p.height = height
        p.source = source
      }
      progress.value = terrainOn.value
        ? 50 + Math.round((end / total) * 50)
        : Math.round((end / total) * 100)
      await yieldTick()
      if (seq !== resolveSeq) return
    }

    if (seq !== resolveSeq) return
    syncEntities()
    progress.value = 100
    syncedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } finally {
    if (seq === resolveSeq) busy.value = false
  }
}

/** 监听“瓦片全部进入场景”的一次性回调（带超时兜底） */
function onceWhen(target: any, eventName: string, test: () => boolean, cb: () => void) {
  let done = false
  const run = () => {
    if (done || !test()) return
    done = true
    cb()
  }
  target[eventName].addEventListener(run)
  const timer = window.setTimeout(run, 8000)
  return () => {
    window.clearTimeout(timer)
    target[eventName].removeEventListener(run)
  }
}

/** 倾斜摄影：按输入框地址加载；needResolve=false 时由调用方统一取值 */
async function loadTiles(needResolve = true) {
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
    tileset.value = ts
    // 瓦片铺满后再取一次；正在取值时别插队，否则会把当前任务打断重跑
    taskOffs.push(
      onceWhen(ts, 'allTilesLoaded', () => true, () => {
        if (!busy.value) void resolveAll()
      }),
    )
    // 先取一次（还没加载的瓦片会按地形兜底），加载完再取一次
    if (needResolve) await resolveAll()
  } catch (e) {
    tilesOn.value = false
    tilesError.value = msgOf(e)
    ElMessage.error(`倾斜摄影加载失败：${msgOf(e)}`)
  } finally {
    loadingTiles.value = false
  }
}

function removeTiles() {
  const ts = tileset.value
  tileset.value = null
  // remove 默认 destroy=true，无需再单独 destroy
  if (ts && viewer) viewer.scene.primitives.remove(ts)
  void resolveAll()
}

/** 地形：按输入框地址加载 quantized-mesh 地形；needResolve=false 时由调用方统一取值 */
async function loadTerrain(needResolve = true) {
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
    // 地形瓦片铺满后再取一次，避免用低层级高程（误差几十米）
    taskOffs.push(
      onceWhen(
        viewer.scene.globe,
        'tileLoadProgressEvent',
        () => !!viewer?.scene.globe.tilesLoaded,
        () => {
          if (!busy.value) void resolveAll()
        },
      ),
    )
    if (needResolve) await resolveAll()
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
  void resolveAll()
}

watch(tilesOn, (on) => {
  void (on ? loadTiles() : removeTiles())
})
watch(terrainOn, (on) => {
  void (on ? loadTerrain() : unloadTerrain())
})

/** 切换点位规模：清空旧实体重建，再重新取值 */
watch(pointTier, (n) => {
  points.value = buildPoints(n)
  if (viewer) viewer.entities.removeAll()
  progress.value = 0
  syncedAt.value = ''
  syncEntities()
  void resolveAll()
})

/** 地址改完（回车/失焦）时，如果已开启就重新加载 */
function onTiltUrlChange() {
  if (tilesOn.value) {
    removeTiles()
    void loadTiles()
  }
}
function onTerrainUrlChange() {
  if (!terrainOn.value) return
  nextTick(() => {
    terrainOn.value = false
    nextTick(() => {
      terrainOn.value = true
    })
  })
}

/** 定位到全港视角：点位铺满各区，拉太近只能看到一簇 */
function flyToScene() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.17, 22.33, 26000),
    orientation: {
      heading: C.Math.toRadians(0),
      pitch: C.Math.toRadians(-55),
      roll: 0,
    },
    duration: 1.4,
  })
}

/**
 * 默认地形 + 倾斜都开着：并行加载，等两边都就绪后统一取一次值，
 * 避免加载过程中连跑两轮采样（点位分散时，翻倍很伤）
 */
async function bootSources() {
  const tasks: Array<Promise<void>> = []
  if (terrainOn.value) tasks.push(loadTerrain(false))
  if (tilesOn.value) tasks.push(loadTiles(false))
  await Promise.all(tasks)
  await resolveAll()
}

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  syncEntities()
  void bootSources()

  return () => {
    taskOffs.forEach((off) => off())
    taskOffs = []
    // 让进行中的取值任务立刻失效，否则它醒来时 C 已经是 null
    resolveSeq++
    viewer = null
    C = null
  }
})
</script>

<template>
  <CesiumOverlay class="elevation-panel" title="点位高度取值 · 无高程数据" :width="300">
    <p class="tip">
      点位只有经纬度：这里自己算绝对高度（倾斜摄影 <code>getHeight</code> + 地形采样），再用绝对高度渲染，表格里就是算出来的数值。
    </p>

    <div class="row">
      <span class="row-label">点位数量</span>
      <el-select v-model="pointTier" size="small" class="mode">
        <el-option v-for="t in POINT_TIERS" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
    </div>

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

    <div class="btns">
      <el-button size="small" type="primary" plain :loading="busy" @click="resolveAll">重新取值</el-button>
      <el-button size="small" @click="flyToScene">全港视角</el-button>
    </div>

    <div v-if="busy" class="progress">
      <div class="progress-bar" :style="{ width: `${progress}%` }" />
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <div class="summary">
      <span class="tag tag-tiles">倾斜摄影 {{ summary.tiles }}</span>
      <span class="tag tag-terrain">地形 {{ summary.terrain }}</span>
      <span class="tag tag-ellipsoid">椭球 {{ summary.ellipsoid }}</span>
    </div>

    <div class="table">
      <div class="tr th">
        <span class="td name">点位</span>
        <span class="td h">高度(m)</span>
        <span class="td src">来源</span>
      </div>
      <div v-for="p in shownRows" :key="p.id" class="tr">
        <span class="td name" :title="p.name">{{ p.name }}</span>
        <span class="td h">{{ p.height.toFixed(2) }}</span>
        <span class="td src" :class="`src-${p.source}`">{{ p.source }}</span>
      </div>
    </div>
    <p v-if="points.length > MAX_ROWS" class="more-count">
      共 {{ points.length }} 条，表格只渲染前 {{ MAX_ROWS }} 条
    </p>

    <p class="foot">
      最近取值：{{ syncedAt || '—' }}；高度取自当前已加载的瓦片层级，拉远/拉近后可点「重新取值」
    </p>
    <p class="foot">
      文字标注按视角距离显隐：<code>distanceDisplayCondition</code> = 0~{{ LABEL_DISTANCE }} m，与点位数量无关
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.elevation-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  /* 小屏时面板内容比视口高，允许内部滚动，别被底部状态栏切掉 */
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
  margin-bottom: 6px;
}
.row-label {
  color: #334155;
  font-size: 12px;
  font-weight: 500;
}
.url {
  margin-bottom: 8px;
}
.mode {
  width: 152px;
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
  gap: 8px;
  margin-bottom: 10px;
}
.btns .el-button {
  flex: 1;
  margin-left: 0;
}
.progress {
  position: relative;
  height: 14px;
  margin-bottom: 8px;
  border-radius: 4px;
  background: #eef2f7;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  transition: width 0.15s linear;
}
.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1e3a8a;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.more-count {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 10.5px;
  text-align: center;
}
.summary {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.tag {
  flex: 1;
  padding: 3px 0;
  border-radius: 5px;
  text-align: center;
  font-size: 10.5px;
}
.tag-tiles {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.tag-terrain {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}
.tag-ellipsoid {
  background: rgba(100, 116, 139, 0.12);
  color: #475569;
}
.table {
  max-height: 168px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  overflow: auto;
}
.tr {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}
.tr:last-child {
  border-bottom: 0;
}
.tr.th {
  background: #f8fafc;
  color: #94a3b8;
  font-weight: 600;
}
.td.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.td.h {
  width: 66px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #0f172a;
}
.td.src {
  width: 62px;
  text-align: right;
  font-size: 10px;
}
.src-tiles {
  color: #2563eb;
}
.src-terrain {
  color: #059669;
}
.src-ellipsoid {
  color: #94a3b8;
}
.src-pending {
  color: #cbd5e1;
}
.foot {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 10.5px;
}
.foot code {
  padding: 0 3px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 10px;
}
</style>
