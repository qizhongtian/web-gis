<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { createTerrainProvider, defaultMeshTilesetUrl, defaultTerrainServiceUrl } from '@/utils/gis/cesiumConfig'
import { assetUrl } from '@/utils/publicUrl'

/**
 * 常见问题：点位只有经纬度、没有高程，怎么始终贴在地形 / 倾斜摄影上
 *
 * 只讲“贴合”这一件事：billboard / label 的 heightReference 交给 Cesium，
 * 开关地形与倾斜摄影时自动重贴，拿不到数值也不需要数值。
 * 需要具体高程（表格、导出、传接口）→ 见「点位高度取值」页。
 */

interface DemoPoint {
  id: string
  name: string
  lon: number
  lat: number
}

/** 默认地址与「工具 → 高程提取」页面保持一致 */
const DEFAULT_TILT_URL = defaultMeshTilesetUrl
const DEFAULT_TERRAIN_URL = defaultTerrainServiceUrl

/** 点位图标（图片） */
const PIN_IMAGE = assetUrl('image/map-pin-02.png')

/** mock：香港区域点位，只有经纬度，没有高程 */
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
 * 撒点时按锚点轮转 + 簇内抖动，450 个点位能铺满全港，而不是堆在中环
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

/**
 * 点位规模档位：1000 以内走自动贴地，超过自动降级为预计算高度
 */
const POINT_TIERS = [
  { label: '12 个点位（示范）', value: 12 },
  { label: '200 个点位', value: 200 },
  { label: '500 个点位', value: 500 },
  { label: '1000 个点位', value: 1000 },
  { label: '2000 个点位（降级）', value: 2000 },
  { label: '5000 个点位（降级）', value: 5000 },
]
/** 默认 12 个：贴地 + label 都是每帧重算的，默认档位保持轻量 */
const pointTier = ref(12)

/**
 * label 的显示条件：相机到点位的距离 0~2000 m 才显示（和点位数量无关）。
 * 交给 distanceDisplayCondition，Cesium 每帧按距离自己裁剪，不用监听相机、不用手动显隐。
 */
const LABEL_DISTANCE = 2000

/**
 * 贴地策略分界：heightReference 是「逐实体、逐帧」clamp，点越多越贵
 *   ≤ AUTO_CLAMP_LIMIT → AUTO：交给 heightReference，代码最省、瓦片变化自动跟随
 *   >  AUTO_CLAMP_LIMIT → PRECOMPUTED：先算一次高度，再用绝对高度 + NONE 渲染
 */
const AUTO_CLAMP_LIMIT = 1000
const strategy = computed<'AUTO' | 'PRECOMPUTED'>(() =>
  points.value.length <= AUTO_CLAMP_LIMIT ? 'AUTO' : 'PRECOMPUTED',
)
/** 预计算出来的高度（点位 id → 米） */
const heights = shallowRef(new Map<string, number>())
const precomputing = ref(false)
/** 取值进度 0~100：5000 点带地形兜底要跑十几秒，不给进度会像卡死 */
const precomputeProgress = ref(0)
const precomputeText = computed(() =>
  precomputing.value ? `取值中 ${precomputeProgress.value}%` : '重新取值',
)
const precomputedAt = ref('')
/** 取值任务序号：切档位 / 卸载时 +1，旧任务在分片间隙自行退出 */
let computeSeq = 0

/** 确定性伪随机：同一点位数多次重建，位置保持不变 */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function buildPoints(n: number): DemoPoint[] {
  if (n <= RAW_POINTS.length) return RAW_POINTS.map((p) => ({ ...p }))
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
    })
  }
  return list
}

const points = ref<DemoPoint[]>(buildPoints(12))

const tiltUrl = ref(DEFAULT_TILT_URL)
const terrainUrl = ref(DEFAULT_TERRAIN_URL)
/** 默认都打开：进页面就能看到贴合效果 */
const tilesOn = ref(true)
const terrainOn = ref(true)
const loadingTiles = ref(false)
const loadingTerrain = ref(false)
/** 面板内联错误提示（toast 会消失，这里常驻，便于排查） */
const tilesError = ref('')
const terrainError = ref('')

/**
 * 贴地用的 heightReference：
 *   都有 → CLAMP_TO_GROUND（倾斜摄影和地形取最高的那个）
 *   只有倾斜 → CLAMP_TO_3D_TILE（只认 3D Tiles）
 *   只有地形 → CLAMP_TO_TERRAIN（只认地形）
 *   都没开 → NONE（没有可贴的表面，落回椭球面）
 */
const heightRef = computed(() => {
  if (tilesOn.value && terrainOn.value) return 'CLAMP_TO_GROUND'
  if (tilesOn.value) return 'CLAMP_TO_3D_TILE'
  if (terrainOn.value) return 'CLAMP_TO_TERRAIN'
  return 'NONE'
})

let viewer: any = null
let C: any = null
/** 当前加载的倾斜摄影，预计算高度时用它 getHeight */
const tileset = shallowRef<any>(null)

/** 实际写进实体的枚举：预计算模式下固定 NONE（高度已经算进 position） */
const effectiveHeightRef = computed(() =>
  strategy.value === 'PRECOMPUTED' ? 'NONE' : heightRef.value,
)

function msgOf(e: any) {
  return e?.message || String(e)
}

/**
 * 点位渲染
 *   AUTO：高度写 0，交给 heightReference 每帧贴
 *   PRECOMPUTED：写算好的绝对高度 + NONE，每帧不再 clamp
 */
function syncEntities() {
  if (!viewer || !C) return
  const precomputed = strategy.value === 'PRECOMPUTED'
  const refValue = C.HeightReference[effectiveHeightRef.value]
  for (const p of points.value) {
    const h = precomputed ? heights.value.get(p.id) ?? 0 : 0
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, h)
    const entity = viewer.entities.getById(p.id)
    if (entity) {
      // 切换地形 / 倾斜摄影 / 策略时，改这里就会立刻生效
      entity.position = position
      if (entity.billboard) entity.billboard.heightReference = refValue
      if (entity.label) entity.label.heightReference = refValue
      continue
    }
    viewer.entities.add({
      id: p.id,
      position,
      billboard: {
        image: PIN_IMAGE,
        width: 34,
        height: 44,
        // 图标针尖（底部）落在点位上
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        heightReference: refValue,
      },
      // label 是独立图元，也要单独贴地
      label: {
        text: p.name,
        font: '600 14px "Microsoft YaHei", sans-serif',
        fillColor: C.Color.fromCssColorString('#FFD400'),
        outlineColor: C.Color.WHITE,
        outlineWidth: 4,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        // 文字整体上移到图标上方
        pixelOffset: new C.Cartesian2(0, -46),
        showBackground: false,
        heightReference: refValue,
        // 视角距离 0~2000 m 才显示文字，拉远自动隐藏
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, LABEL_DISTANCE),
      },
    })
  }
}

/**
 * 预计算高度（降级模式）：倾斜摄影 getHeight 优先，地形采样兜底
 * 分片 + 每片让出一帧，点位再多也不会把主线程占死
 */
async function resolveHeights() {
  if (!viewer || !C) return
  const seq = ++computeSeq
  precomputing.value = true
  precomputeProgress.value = 0
  const next = new Map<string, number>()
  const list = points.value
  const CHUNK = 100
  try {
    for (let i = 0; i < list.length; i += CHUNK) {
      if (seq !== computeSeq || !C || !viewer) return
      precomputeProgress.value = Math.round((i / list.length) * 100)
      const slice = list.slice(i, i + CHUNK)
      // 先逐点问倾斜摄影：命中的点不用再请求地形瓦片
      const ts = tileset.value
      const missed: number[] = []
      for (let k = 0; k < slice.length; k++) {
        const p = slice[k]
        let h: number | undefined
        if (ts && tilesOn.value) {
          // getHeight 取的是当前已加载瓦片的高度：瓦片细化后数值会变
          h = ts.getHeight(C.Cartographic.fromDegrees(p.lon, p.lat), viewer.scene)
        }
        if (Number.isFinite(h)) next.set(p.id, h as number)
        else missed.push(k)
      }
      // 没命中的再用地形兜底：整片一次性批量采样，比逐点采样快得多
      if (missed.length && terrainOn.value && viewer.terrainProvider) {
        const cartos = missed.map((k) => C.Cartographic.fromDegrees(slice[k].lon, slice[k].lat))
        const sampled = await C.sampleTerrainMostDetailed(viewer.terrainProvider, cartos)
        if (seq !== computeSeq) return
        missed.forEach((k, idx) => next.set(slice[k].id, sampled[idx]?.height ?? 0))
      } else {
        for (const k of missed) next.set(slice[k].id, 0)
      }
      precomputeProgress.value = Math.min(100, Math.round(((i + CHUNK) / list.length) * 100))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    if (seq !== computeSeq) return
    heights.value = next
    precomputedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (e) {
    if (viewer) ElMessage.error(`高度预计算失败：${msgOf(e)}`)
  } finally {
    if (seq === computeSeq) {
      precomputing.value = false
      precomputeProgress.value = 0
      if (viewer) syncEntities()
    }
  }
}

/** 数据源就绪 / 开关变化：降级模式重算高度，自动模式只重设枚举 */
function onSourceReady() {
  if (strategy.value === 'PRECOMPUTED') void resolveHeights()
  else syncEntities()
}

/** 倾斜摄影：按输入框地址加载 */
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
    // heightReference 的 CLAMP_TO_3D_TILE / CLAMP_TO_GROUND 只认 enableCollision 为 true 的瓦片
    ts.enableCollision = true
    viewer.scene.primitives.add(ts)
    tileset.value = ts
    onSourceReady()
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
  tileset.value = null
}

/** 地形：按输入框地址加载 quantized-mesh 地形 */
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
    onSourceReady()
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

watch(tilesOn, (on) => {
  void (on ? loadTiles() : removeTiles())
})
watch(terrainOn, (on) => {
  void (on ? loadTerrain() : unloadTerrain())
})
/** 开关组合变化 → 重设实体枚举（自动模式）／重算高度（降级模式） */
watch(effectiveHeightRef, () => syncEntities())

/**
 * 切换点位规模：清空重建
 * 跨过 1000 时策略自动切换：升档降级为预计算，降档回到 heightReference
 */
watch(pointTier, (n) => {
  points.value = buildPoints(n)
  heights.value = new Map()
  precomputedAt.value = ''
  if (viewer) viewer.entities.removeAll()
  syncEntities()
  if (strategy.value === 'PRECOMPUTED') void resolveHeights()
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

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  syncEntities()

  // 地形 / 倾斜默认就是开着的，这里补一次加载（开关初始值不会触发 watch）
  void loadTerrain()
  void loadTiles()

  return () => {
    computeSeq++
    tileset.value = null
    viewer = null
    C = null
  }
})
</script>

<template>
  <CesiumOverlay class="clamp-panel" title="点位贴地 · 无高程数据" :width="300">
    <p class="tip">
      点位只有经纬度：1000 点以内高度写 0，交给 <code>heightReference</code> 逐帧贴；超过 1000 点自动降级为「先算高度 + <code>NONE</code>」，渲染不再逐帧 clamp。
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

    <p class="hint">
      billboard / label 的 heightReference = <b>{{ effectiveHeightRef }}</b><template v-if="effectiveHeightRef === 'NONE'">（没开地形 / 倾斜摄影，或已降级为预计算高度）</template>
    </p>

    <p class="hint">
      贴地策略：<b>{{ strategy === 'AUTO' ? 'heightReference 自动贴' : '预计算高度 + NONE' }}</b>
      <template v-if="strategy === 'PRECOMPUTED'">
        （{{ points.length }} 点 &gt; {{ AUTO_CLAMP_LIMIT }}，每帧不再 clamp）
      </template>
    </p>

    <div v-if="strategy === 'PRECOMPUTED'" class="btns">
      <el-button size="small" :loading="precomputing" @click="resolveHeights">
        {{ precomputeText }}
      </el-button>
    </div>

    <div class="btns">
      <el-button size="small" type="primary" plain @click="flyToScene">全港视角</el-button>
    </div>

    <p v-if="strategy === 'PRECOMPUTED'" class="foot">
      最近取值：{{ precomputedAt || '—' }}；高度取自当前已加载瓦片，瓦片细化后点「重新取值」
    </p>
    <p class="foot">
      文字标注按视角距离控制：<code>distanceDisplayCondition</code> = 0~{{ LABEL_DISTANCE }} m，拉近显示、拉远隐藏
    </p>
    <p class="foot">3D Tiles 需 <code>enableCollision = true</code>，否则贴不到倾斜摄影</p>
  </CesiumOverlay>
</template>

<style scoped>
.clamp-panel {
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
.tip code,
.notes code {
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
  margin-bottom: 10px;
}
.btns .el-button {
  flex: 1;
  margin-left: 0;
}
.foot {
  margin: 0;
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
