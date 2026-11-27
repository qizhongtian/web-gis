<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { onCesiumReady } from '@/composables/useCesium'

import type { LayerToggles } from './HKTrafficPanel.vue'
import type { PickedEntityInfo } from './types'
import type { WeatherWarning } from './feed'
import { chunkedConcurrent, fetchMtrSchedule, fetchWeatherWarnings, loadAllStatic, poller } from './feed'
import {
  drawBusStops,
  drawCenterlines,
  drawEvChargers,
  drawFerryPiers,
  drawLightRail,
  drawMtrNetwork,
  drawRoadPoints,
  removeEntities,
  setEntitiesVisible,
} from './render'

/**
 * HK Traffic Globe —— Cesium 渲染 + 实时轮询
 * 必须放在 <CesiumViewer> 标签内部（作为后代组件），否则 useCesium 会抛异常。
 */

const props = defineProps<{ layers: LayerToggles }>()

const emit = defineEmits<{
  (e: 'loading', v: boolean): void
  (e: 'ready', v: boolean): void
  (e: 'lastUpdated', v: string): void
  (e: 'weatherWarnings', v: WeatherWarning[]): void
  (e: 'picked', info: PickedEntityInfo | null, screenX?: number, screenY?: number): void
}>()

// ── 实体集合 ─────────────────────────────────────────────────────────────
type RenderBundles = {
  mtrLines: any[]; mtrStations: any[]
  lightRailRoutes: any[]; lightRailStations: any[]
  centerlines: any[]; roadPoints: any[]
  ferryPiers: any[]; evChargers: any[]
  citybusStops: any[]; kmbStops: any[]; nlbStops: any[]; gmbStops: any[]
  lwbLines: any[] // LWB 只有线路数组没有站点
}
const bundles: RenderBundles = {
  mtrLines: [], mtrStations: [],
  lightRailRoutes: [], lightRailStations: [],
  centerlines: [], roadPoints: [],
  ferryPiers: [], evChargers: [],
  citybusStops: [], kmbStops: [], nlbStops: [], gmbStops: [],
  lwbLines: [],
}

let activeViewer: any = null
let activeLib: any = null
let pollerToken = 0
let stopMtrPoll: (() => void) | null = null
let stopWeatherPoll: (() => void) | null = null
let clickHandler: any = null

// ── 显隐 watch ──────────────────────────────────────────────────────────
function applyVisibility(layers: LayerToggles) {
  setEntitiesVisible(bundles.mtrLines, layers.mtr)
  setEntitiesVisible(bundles.mtrStations, layers.mtr)
  setEntitiesVisible(bundles.lightRailRoutes, layers.lightRail)
  setEntitiesVisible(bundles.lightRailStations, layers.lightRail)
  setEntitiesVisible(bundles.centerlines, layers.centerlines)
  setEntitiesVisible(bundles.roadPoints, layers.roadPoints)
  setEntitiesVisible(bundles.ferryPiers, layers.ferryPiers)
  setEntitiesVisible(bundles.evChargers, layers.evChargers)
  setEntitiesVisible(bundles.citybusStops, layers.citybus)
  setEntitiesVisible(bundles.kmbStops, layers.kmb)
  setEntitiesVisible(bundles.nlbStops, layers.nlb)
  setEntitiesVisible(bundles.gmbStops, layers.gmb)
  setEntitiesVisible(bundles.lwbLines, layers.lwb)
}
watch(() => props.layers, (l) => applyVisibility(l), { deep: true, immediate: true })

// ── 拾取弹窗 ─────────────────────────────────────────────────────────────
function buildPopupInfo(p: any, name?: string): PickedEntityInfo | null {
  if (!p?.kind) return null
  const rows: [string, string][] = []
  const add = (label: string, val: any) => { if (val !== undefined && val !== null && val !== '') rows.push([label, String(val)]) }
  let title = name ?? ''
  let subtitle = ''
  let kind: PickedEntityInfo['kind'] = 'centerline'
  let lng: number | undefined, lat: number | undefined

  switch (p.kind) {
    case 'mtr-station':     kind='mtr-station';    title=p.tc||name||''; subtitle=`${p.en} (${p.code})`; add('车站代码',p.code); add('英文',p.en); add('中文',p.tc); lng=p.lng; lat=p.lat; break
    case 'mtr-line':        kind='mtr-line';      title='港铁路段'; add('段',p.edgeKey); add('线路代码',p.lineCode||'—'); break
    case 'light-rail-station': kind='light-rail-station'; title=p.tc||name||''; subtitle=p.en; add('ID',p.id); lng=p.lng; lat=p.lat; break
    case 'light-rail-route':   kind='light-rail-route';   title='轻铁路线'; subtitle=p.line; add('路线',p.line); break
    case 'centerline':      kind='centerline';    title=p.roadTc||p.roadEn||name||''; subtitle=p.roadEn||''; add('ID',p.id); add('方向',p.direction); break
    case 'ferry-pier':      kind='ferry-pier';    title=p.nameTc||name||''; subtitle=p.nameEn; add('ID',p.id); lng=p.lng; lat=p.lat; break
    case 'ev-charger':      kind='ev-charger';    title=p.nameTc||name||''; subtitle=p.nameEn; add('标准充',p.standard); add('中速充',p.medium); add('快速充',p.quick); add('极速充',p.fast); add('类型',p.evClass); lng=p.lng; lat=p.lat; break
    case 'bus-citybus': case 'bus-kmb': case 'bus-nlb': case 'bus-gmb': case 'bus-lwb': {
      kind = p.kind
      title = p.tc || name || ''; subtitle = p.en
      add('站点 ID', p.id)
      if (p.routes) add('途经线路', p.routes)
      lng = p.lng; lat = p.lat
      break
    }
    case 'road-point':
      kind='road-point'; title=p.tc||p.en||name||''
      lng=p.lng; lat=p.lat
      break
    default: return null
  }
  if (lng!==undefined && lat!==undefined) add('坐标', `${lng.toFixed(5)}, ${lat.toFixed(5)}`)
  return { title, subtitle, kind, rows, lng, lat }
}

function onLeftClick(movement: any) {
  const v = activeViewer; if (!v) return
  const picked = v.scene?.pick?.(movement?.position)
  if (!picked?.id) { emit('picked', null); return }
  const entity = picked.id
  const info = buildPopupInfo(entity?.properties, entity?.name)
  if (!info) { emit('picked', null); return }
  emit('picked', info, (movement?.position?.x ?? 0) + 16, (movement?.position?.y ?? 0) - 12)
}

// ── 清理 ──────────────────────────────────────────────────────────────────
function cleanupPollers() { stopMtrPoll?.(); stopMtrPoll=null; stopWeatherPoll?.(); stopWeatherPoll=null; pollerToken++ }
function clearBundles() {
  if (!activeViewer) return
  for (const k of Object.keys(bundles) as (keyof RenderBundles)[]) { removeEntities(activeViewer, bundles[k]); bundles[k] = [] }
}

defineExpose({ reload: async () => { emit('ready', false); await renderAll() } })

// ── 核心渲染 ──────────────────────────────────────────────────────────────
async function renderAll() {
  const v = activeViewer; const C = activeLib
  if (!v || !C) return
  emit('loading', true)
  try {
    clearBundles()
    const data = await loadAllStatic()
    if (v.isDestroyed?.()) return

    const mtr = drawMtrNetwork(v, C, data.mtrNetwork, data.railTracks)
    bundles.mtrLines = mtr.lineEntities; bundles.mtrStations = mtr.stationEntities

    const lr = drawLightRail(v, C, data.lightRailStations, data.lightRailRoutes)
    bundles.lightRailRoutes = lr.routeEntities; bundles.lightRailStations = lr.stationEntities

    bundles.centerlines = drawCenterlines(v, C, data.centerlines)
    bundles.roadPoints = drawRoadPoints(v, C, data.roadPoints)
    bundles.ferryPiers = drawFerryPiers(v, C, data.ferryPiers)
    bundles.evChargers = drawEvChargers(v, C, data.evChargers?.places ?? null)

    bundles.citybusStops = drawBusStops(v, C, data.citybusStops, 'citybus')
    bundles.kmbStops = drawBusStops(v, C, data.kmbStops, 'kmb')
    bundles.nlbStops = drawBusStops(v, C, data.nlbStops, 'nlb')
    bundles.gmbStops = drawBusStops(v, C, data.gmbStops, 'gmb')

    // LWB 只有线路数组 ['A30','A35',...] ，没有坐标数据；仅作为面板开关占位
    bundles.lwbLines = []

    applyVisibility(props.layers)

    emit('lastUpdated', new Date().toLocaleTimeString())
    emit('ready', true)
    ElMessage.success('香港交通图层已加载')
  } catch (e: any) {
    console.error('[hk-traffic] renderAll failed:', e)
    ElMessage.error('图层加载失败：' + (e?.message ?? String(e)))
  } finally { emit('loading', false) }
}

// ── onCesiumReady ──────────────────────────────────────────────────────────
onCesiumReady((v, C) => {
  activeViewer = v; activeLib = C

  clickHandler?.destroy?.()
  clickHandler = new C.ScreenSpaceEventHandler(v.scene.canvas)
  clickHandler.setInputAction(onLeftClick, C.ScreenSpaceEventType.LEFT_CLICK)

  void renderAll()

  const token = ++pollerToken
  const stop$ = () => token !== pollerToken || v.isDestroyed?.()
  stopWeatherPoll = poller(async () => { emit('weatherWarnings', await fetchWeatherWarnings()) }, 60_000, { stop$ })

  stopMtrPoll = poller(async () => {
    if (stop$() || bundles.mtrStations.length === 0) return
    const sample = bundles.mtrStations.slice(0, 10)
    await chunkedConcurrent(sample, 3, async (ent) => {
      const code = ent?.properties?.code; if (!code) return
      for (const line of ['TCL','TWL','ISL','KTL','EAL','TML','SIL']) await fetchMtrSchedule(line, code)
    })
  }, 20_000, { stop$ })

  return () => { clickHandler?.destroy?.(); clickHandler = null; cleanupPollers(); clearBundles(); activeViewer = null; activeLib = null }
})

void computed
</script>

<!-- 纯逻辑组件：所有 Cesium 渲染都在 script 中完成，不需要 DOM 输出 -->
<template>
  <div class="hk-traffic-globe" />
</template>
