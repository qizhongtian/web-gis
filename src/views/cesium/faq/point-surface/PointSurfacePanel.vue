<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { BillboardCollection, Cesium3DTileset, LabelCollection, TerrainProvider, Viewer } from 'cesium'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { createTerrainProvider, defaultMeshTilesetUrl, defaultTerrainServiceUrl, HK_POINT_CLAMP_HOME } from '@/utils/gis/cesiumConfig'
import { assetUrl } from '@/utils/publicUrl'
import { AUTO_LIMIT, CENTER, makePoints, pointHeightMode, resolveSurface, sampleTerrainSlice, sampleTile, type Cesium, type SurfaceSample } from './surface'

const pin = assetUrl('image/map-pin-02.png')
const activePin = assetUrl('image/map-pin-24.png')
const counts = [80, 500, 1000, 2000, 5000, 10000]
const count = ref(500)
const terrainOn = ref(true)
const tilesOn = ref(true)
const distanceScale = ref(true)
const ready = ref(false)
const terrainUrl = ref(defaultTerrainServiceUrl)
const tilesUrl = ref(defaultMeshTilesetUrl)
const terrainState = ref('未启用')
const tileState = ref('未启用')
const terrainReady = ref(false)
const tilesReady = ref(false)
const terrainLoading = ref(false)
const tileLoading = ref(false)
const selection = ref<number>()
const progress = ref<number>()
const sampleStats = ref<{ terrain: number; tiles: number; ellipsoid: number }>()
const sampleError = ref('')
const builtCount = ref(0)
const strategy = computed(() => {
  if (!terrainOn.value && !tilesOn.value) return 'ellipsoid'
  // 双源时高度回调可能互相覆盖。统一取两者较高值，避免瓦片后到时把图标从屋顶拉回地面。
  return (terrainOn.value && tilesOn.value) || count.value > AUTO_LIMIT ? 'batch' : 'auto'
})
const heightMode = computed(() => strategy.value === 'batch' ? 'NONE' : pointHeightMode(terrainReady.value, tilesReady.value))
const sourceLoading = computed(() => terrainLoading.value || tileLoading.value)
const selectedPoint = computed(() => selection.value === undefined ? undefined : points[selection.value])
const selectedSample = computed(() => {
  const id = selection.value
  return id === undefined ? undefined : samples.value[id]
})
const sourceLabels = { tiles: '3D Tiles', terrain: '地形', ellipsoid: '椭球回退' }
const samples = shallowRef<SurfaceSample[]>([])
let points = makePoints(count.value)
let viewer: Viewer | undefined
let C: Cesium | undefined
let icons: BillboardCollection | undefined
let labels: LabelCollection | undefined
let tileset: Cesium3DTileset | undefined
let activeTerrain: TerrainProvider | undefined
let stopTilesReady: (() => void) | undefined
let stopTilesError: (() => void) | undefined
let stopTerrainError: (() => void) | undefined
let terrainRevision = 0
let tileRevision = 0
let sampleRevision = 0
let frame = 0
let releaseFrame: (() => void) | undefined
const ownPoint = Symbol('point-surface')

function afterFrame() {
  return new Promise<void>(resolve => {
    if (!viewer) return resolve()
    releaseFrame = resolve
    frame = requestAnimationFrame(() => { frame = 0; releaseFrame = undefined; resolve() })
  })
}

function invalidateSampling() {
  sampleRevision++
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  releaseFrame?.()
  releaseFrame = undefined
  progress.value = undefined
}

function resetSampling() {
  invalidateSampling()
  samples.value = []
  sampleStats.value = undefined
  sampleError.value = ''
}

function flyToDemo(range: number, duration = 0.55) {
  if (!viewer || !C) return
  const target = C.Cartesian3.fromDegrees(CENTER.lon, CENTER.lat, 27)
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, 10), {
    offset: new C.HeadingPitchRange(0.20, -0.94, range), duration,
  })
  viewer.scene.requestRender()
}

function flyToOverview() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(...HK_POINT_CLAMP_HOME),
    orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 },
    duration: 0.65,
  })
  viewer.scene.requestRender()
}

function scaleFor(lib: Cesium) {
  return distanceScale.value ? new lib.NearFarScalar(160, 1.65, 16000, 0.42) : new lib.NearFarScalar(160, 1, 16000, 1)
}

function buildIcons() {
  if (!viewer || !C || !icons || !labels) return
  const lib = C
  icons.removeAll()
  labels.removeAll()
  const scaleByDistance = scaleFor(lib)
  const reference = lib.HeightReference[heightMode.value]
  for (const p of points) {
    const id = { owner: ownPoint, index: p.id }
    const position = lib.Cartesian3.fromDegrees(p.lon, p.lat, 0)
    icons.add({
      id,
      position,
      image: pin, width: 21, height: 28,
      verticalOrigin: lib.VerticalOrigin.BOTTOM,
      scaleByDistance, heightReference: reference,
    })
    labels.add({
      id,
      position,
      text: `#${p.id + 1}`,
      font: '12px "Microsoft YaHei", sans-serif',
      fillColor: lib.Color.WHITE,
      outlineColor: lib.Color.fromCssColorString('#0f172a'),
      outlineWidth: 3,
      style: lib.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: lib.VerticalOrigin.BOTTOM,
      pixelOffset: new lib.Cartesian2(0, -30),
      scaleByDistance,
      heightReference: reference,
      distanceDisplayCondition: new lib.DistanceDisplayCondition(0, 2000),
    })
  }
  builtCount.value = icons.length
  if (selection.value !== undefined) paint(selection.value, true)
  viewer.scene.requestRender()
}

function paint(index: number, selected: boolean) {
  if (!icons || index >= icons.length) return
  const billboard = icons.get(index)
  billboard.image = selected ? activePin : pin
  billboard.scale = selected ? 1.55 : 1
}

function select(index?: number) {
  if (index === selection.value) return
  if (selection.value !== undefined) paint(selection.value, false)
  selection.value = index
  if (index !== undefined) paint(index, true)
  viewer?.scene.requestRender()
}

function applyPlacement() {
  if (!icons || !labels || !viewer || !C) return
  const reference = C.HeightReference[heightMode.value]
  const precalculated = strategy.value === 'batch' && samples.value.length === points.length
  const position = new C.Cartesian3()
  for (let i = 0; i < icons.length; i++) {
    const icon = icons.get(i)
    const label = labels.get(i)
    const sample = precalculated ? samples.value[i] : undefined
    const height = sample && sample.source !== 'ellipsoid' ? sample.height + 0.25 : 0
    icon.heightReference = reference
    label.heightReference = reference
    C.Cartesian3.fromDegrees(points[i].lon, points[i].lat, height, undefined, position)
    icon.position = position
    label.position = position
  }
  viewer.scene.requestRender()
}

async function calculateHeights() {
  const v = viewer, lib = C, model = tilesReady.value ? tileset : undefined, provider = activeTerrain
  if (!v || !lib || strategy.value !== 'batch' || sourceLoading.value || (!provider && !model)) return
  invalidateSampling()
  const run = sampleRevision
  const list = points
  const results: SurfaceSample[] = []
  const totals = { terrain: 0, tiles: 0, ellipsoid: 0 }
  const scratch = new lib.Cartesian3(), ray = new lib.Ray()
  const size = 200
  progress.value = 0
  sampleError.value = ''
  try {
    for (let i = 0; i < list.length; i += size) {
      await afterFrame()
      if (run !== sampleRevision || v.isDestroyed()) return
      const cartos = list.slice(i, i + size).map(p => lib.Cartographic.fromDegrees(p.lon, p.lat))
      let heights: number[] = []
      try { heights = await sampleTerrainSlice(lib, provider, cartos) }
      catch { if (run === sampleRevision) sampleError.value = '部分地形批次取值失败，未命中处按模型或椭球回退。' }
      if (run !== sampleRevision || v.isDestroyed()) return
      for (let k = 0; k < cartos.length; k++) {
        const sample = resolveSurface(heights[k], sampleTile(lib, model, v.scene, cartos[k], scratch, ray))
        totals[sample.source]++
        results.push(sample)
      }
      progress.value = Math.round(results.length / list.length * 100)
    }
    if (run !== sampleRevision) return
    samples.value = results
    sampleStats.value = totals
    applyPlacement()
  } catch {
    if (run === sampleRevision) sampleError.value = '高度取值失败，可调整视角并重新取值。'
  } finally {
    if (run === sampleRevision) progress.value = undefined
  }
}

function refreshPlacement() {
  resetSampling()
  applyPlacement()
  void calculateHeights()
}

async function loadTerrain() {
  const v = viewer, lib = C
  if (!v || !lib) return
  const rev = ++terrainRevision
  stopTerrainError?.()
  stopTerrainError = undefined
  activeTerrain = undefined
  terrainReady.value = false
  terrainLoading.value = terrainOn.value
  v.terrainProvider = new lib.EllipsoidTerrainProvider()
  terrainState.value = terrainOn.value ? '加载中…' : '未启用'
  refreshPlacement()
  if (!terrainOn.value) return
  try {
    const url = terrainUrl.value.trim()
    if (!url) throw new Error('请填写地形服务地址。')
    const provider: TerrainProvider = await createTerrainProvider(lib, url)
    if (rev !== terrainRevision || v.isDestroyed()) return
    activeTerrain = provider
    v.terrainProvider = provider
    stopTerrainError = provider.errorEvent.addEventListener(() => { terrainState.value = '部分地形瓦片未能加载' })
    terrainReady.value = true
    terrainState.value = '已接入地形'
  } catch (error) {
    if (rev === terrainRevision) terrainState.value = error instanceof Error ? `加载失败：${error.message}` : '地形加载失败'
  } finally {
    if (rev === terrainRevision) { terrainLoading.value = false; refreshPlacement() }
  }
}

function detachTiles() {
  stopTilesReady?.(); stopTilesReady = undefined
  stopTilesError?.(); stopTilesError = undefined
  if (tileset && viewer && !viewer.isDestroyed()) viewer.scene.primitives.remove(tileset)
  tileset = undefined
}

async function loadTiles() {
  const v = viewer, lib = C
  if (!v || !lib) return
  const rev = ++tileRevision
  detachTiles()
  tilesReady.value = false
  tileLoading.value = tilesOn.value
  tileState.value = tilesOn.value ? '加载中…' : '未启用'
  refreshPlacement()
  if (!tilesOn.value) return
  try {
    const url = tilesUrl.value.trim()
    if (!url) throw new Error('请填写倾斜摄影 tileset.json 地址。')
    const model = await lib.Cesium3DTileset.fromUrl(url, { enableCollision: true, maximumScreenSpaceError: 12 })
    if (rev !== tileRevision || v.isDestroyed()) { model.destroy(); return }
    tileset = v.scene.primitives.add(model)
    // 清单可用不代表瓦片已可取高。先让地形兜底，第一批网格出来再自动补算一次。
    tileState.value = '等待当前视野瓦片…'
    stopTilesReady = model.initialTilesLoaded.addEventListener(() => {
      tilesReady.value = true
      tileState.value = '已接入倾斜摄影'
      refreshPlacement()
    })
    stopTilesError = model.tileFailed.addEventListener(() => { tileState.value = '部分模型瓦片未能加载' })
  } catch (error) {
    if (rev === tileRevision) tileState.value = error instanceof Error ? `加载失败：${error.message}` : '3D Tiles 加载失败'
  } finally {
    if (rev === tileRevision) { tileLoading.value = false; refreshPlacement() }
  }
}

watch(count, value => {
  points = makePoints(value)
  if (selection.value !== undefined && selection.value >= value) select()
  resetSampling()
  buildIcons()
  void calculateHeights()
})
watch(terrainOn, loadTerrain)
watch(tilesOn, loadTiles)
watch(distanceScale, () => {
  if (!C || !icons || !labels || !viewer) return
  const scale = scaleFor(C)
  for (let i = 0; i < icons.length; i++) {
    icons.get(i).scaleByDistance = scale
    labels.get(i).scaleByDistance = scale
  }
  viewer.scene.requestRender()
})

onCesiumReady((v: Viewer, lib: Cesium) => {
  viewer = v; C = lib
  v.scene.globe.baseColor = lib.Color.fromCssColorString('#8aaba1')
  v.scene.globe.depthTestAgainstTerrain = true
  v.scene.screenSpaceCameraController.minimumZoomDistance = 60
  icons = v.scene.primitives.add(new lib.BillboardCollection({ scene: v.scene }))
  labels = v.scene.primitives.add(new lib.LabelCollection({ scene: v.scene }))
  const ownedIcons = icons
  const ownedLabels = labels
  const pick = new lib.ScreenSpaceEventHandler(v.scene.canvas)
  pick.setInputAction(({ position }: { position: InstanceType<Cesium['Cartesian2']> }) => {
    // 只选可见的点；建筑遮住的点不应被点穿。
    const hit = v.scene.pick(position)?.id as { owner?: symbol; index?: number } | undefined
    const id = hit?.owner === ownPoint ? hit.index : undefined
    select(id === selection.value ? undefined : id)
  }, lib.ScreenSpaceEventType.LEFT_CLICK)
  buildIcons()
  ready.value = true
  void loadTerrain()
  void loadTiles()
  return () => {
    ready.value = false
    terrainRevision++; tileRevision++
    resetSampling()
    stopTerrainError?.(); stopTerrainError = undefined
    pick.destroy()
    detachTiles()
    if (!v.isDestroyed()) {
      if (ownedIcons) v.scene.primitives.remove(ownedIcons)
      if (ownedLabels) v.scene.primitives.remove(ownedLabels)
    }
    icons = undefined; labels = undefined; viewer = undefined; C = undefined; activeTerrain = undefined
  }
})
</script>

<template>
  <CesiumOverlay class="point-surface-controls" title="点位实验" :width="274">
    <div class="controls-body">
      <label class="control-row"><span>点位数量</span>
        <select v-model.number="count" :disabled="!ready" aria-label="点位数量">
          <option v-for="n in counts" :key="n" :value="n">{{ n.toLocaleString('zh-CN') }} 点</option>
        </select>
      </label>
      <label class="control-row"><span>随距离缩放</span><input v-model="distanceScale" type="checkbox" :disabled="!ready"></label>
      <label class="control-row"><span>显示地形</span><input v-model="terrainOn" type="checkbox" :disabled="!ready"></label>
      <p class="source" role="status">{{ terrainState }}</p>
      <label class="control-row"><span>显示 3D Tiles</span><input v-model="tilesOn" type="checkbox" :disabled="!ready"></label>
      <p class="source" role="status">{{ tileState }}</p>
      <details class="custom-sources" open>
        <summary>地形 / 倾斜摄影地址</summary>
        <label>地形服务<input v-model="terrainUrl" placeholder="地形服务地址" :disabled="!ready"></label>
        <label>倾斜摄影（tileset.json）<input v-model="tilesUrl" placeholder="tileset.json 地址" :disabled="!ready"></label>
        <el-button size="small" :disabled="!ready || sourceLoading" @click="() => { loadTerrain(); loadTiles() }">应用地址</el-button>
      </details>
      <div class="readout" role="status">
        <strong>{{ builtCount.toLocaleString('zh-CN') }} 点 · {{ strategy === 'batch' ? '分批预计算' : strategy === 'auto' ? '自动贴附' : '椭球面' }}</strong>
        <code>{{ heightMode }}</code>
        <p v-if="progress !== undefined">高度取值 {{ progress }}%</p>
        <p v-else-if="sampleStats">模型 {{ sampleStats.tiles }} · 地形 {{ sampleStats.terrain }} · 椭球 {{ sampleStats.ellipsoid }}</p>
        <p v-if="sampleError" class="notice">{{ sampleError }}</p>
      </div>
      <div class="actions">
        <el-button size="small" :disabled="!ready" @click="flyToOverview">中国香港全景</el-button>
        <el-button size="small" :disabled="!ready" @click="flyToDemo(240); select(0)">近看基准点</el-button>
        <el-button v-if="strategy === 'batch'" size="small" :disabled="sourceLoading || progress !== undefined || (!terrainReady && !tilesReady)" @click="calculateHeights">重新取值</el-button>
      </div>
      <div class="selection" aria-live="polite">
        <template v-if="selectedPoint">
          <strong>已选中 #{{ selectedPoint.id + 1 }}</strong>
          <span v-if="selectedSample">{{ sourceLabels[selectedSample.source] }} · {{ selectedSample.height.toFixed(2) }} m</span>
          <el-button size="small" text @click="select()">取消</el-button>
        </template>
        <span v-else>点图标高亮；再点同一个或空白取消。</span>
      </div>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.point-surface-controls { position: absolute; z-index: 5; left: 10px; top: 10px; max-width: calc(100% - 20px); max-height: calc(100% - 20px); }
.point-surface-controls :deep(.panel-body) { max-height: min(60vh, 470px); padding: 0; }
.controls-body { display: grid; gap: 7px; padding: 10px 12px; font-size: 12px; color: #334155; }
.control-row { display: flex; justify-content: space-between; align-items: center; min-height: 22px; gap: 8px; }
.control-row input { accent-color: var(--app-primary, #2563eb); width: 16px; height: 16px; }
select, .custom-sources input { min-width: 0; border: 1px solid #dbe3ec; border-radius: 5px; background: #fff; color: #334155; padding: 2px 6px; font: inherit; }
.source { margin: -5px 0 0; color: #53647a; font-size: 11px; overflow-wrap: anywhere; }
.custom-sources summary { cursor: pointer; color: #2563a7; }
.custom-sources label { display: grid; gap: 3px; margin-block: 6px; }
.readout { display: grid; gap: 3px; padding: 7px 8px; background: #eff5fd; border-radius: 5px; }
.readout code { color: #215691; overflow-wrap: anywhere; }
.readout p { margin: 0; }
.notice { color: #9a5417; }
.actions, .selection { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.actions :deep(.el-button + .el-button) { margin-left: 0; }
.selection { padding-top: 6px; border-top: 1px solid #e3eaf3; }
.selection strong { color: #1e4c86; }
</style>
