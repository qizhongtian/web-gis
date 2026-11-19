<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const WFS_URL =
  'https://ahocevar.com/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature' +
  '&typename=osm:water_areas&outputFormat=application/json&srsname=EPSG:3857&count=300'

const status = ref('点击「加载 WFS 数据」请求 GeoServer')
const count = ref(0)
const cost = ref(0)

let map: any = null
let L: any = null
let layer: any = null

/** WFS 返回 Web 墨卡托米，Leaflet 要经纬度 */
function mercatorToLatLng(x: number, y: number): [number, number] {
  const R = 6378137
  const lng = ((x / R) * 180) / Math.PI
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
  return [lat, lng]
}

function transformCoords(coords: any): any {
  if (typeof coords[0] === 'number') return mercatorToLatLng(coords[0], coords[1])
  return coords.map((c: any) => transformCoords(c))
}

function transformGeom(geom: any) {
  if (!geom) return geom
  return { ...geom, coordinates: transformCoords(geom.coordinates) }
}

async function load() {
  if (!map) return
  status.value = '请求 WFS GetFeature…'
  const t0 = performance.now()
  try {
    const res = await fetch(WFS_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    json.features = (json.features || []).map((f: any) => ({ ...f, geometry: transformGeom(f.geometry) }))

    if (layer) map.removeLayer(layer)
    layer = L.geoJSON(json, {
      style: { color: '#22d3ee', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.25 },
      onEachFeature: (f: any, l: any) => {
        const p = f.properties || {}
        l.bindTooltip(p.name || p.waterway || '水体', { sticky: true })
      },
    }).addTo(map)

    const b = layer.getBounds()
    if (b.isValid()) map.fitBounds(b, { padding: [30, 30] })
    count.value = json.features.length
    cost.value = Math.round(performance.now() - t0)
    status.value = `已加载 ${count.value} 个要素，耗时 ${cost.value}ms`
  } catch (e: any) {
    status.value = `加载失败：${e?.message || e}（服务可能限流，重试即可）`
  }
}

function clear() {
  if (layer && map) map.removeLayer(layer)
  layer = null
  count.value = 0
  status.value = '已清空'
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [52, 10], zoom: 5 })
  return () => {
    map?.remove()
    map = null
    layer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      WFS：GetFeature 拿矢量数据，服务端按 srsname 投影，前端转回经纬度后交给 L.geoJSON 渲染
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="load">加载 WFS 数据</el-button>
      <el-button size="small" @click="clear">清空</el-button>
      <el-tag size="small" effect="plain" type="info">要素 {{ count }}</el-tag>
      <span class="text-[12px] text-[#6b7280]">{{ status }}</span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
