<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const showAreas = ref(true)
const showPoints = ref(true)
const count = ref(0)

/** 简化后的示例 GeoJSON：3 个区块 + 3 个点位，模拟接口返回 */
const data: any = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '中心区', kind: 'area', level: 1 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.33, 39.92],
            [116.43, 39.93],
            [116.45, 39.87],
            [116.34, 39.86],
            [116.33, 39.92],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '东部片区', kind: 'area', level: 2 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.47, 39.94],
            [116.58, 39.92],
            [116.56, 39.85],
            [116.46, 39.86],
            [116.47, 39.94],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '西南片区', kind: 'area', level: 3 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.27, 39.87],
            [116.37, 39.88],
            [116.35, 39.81],
            [116.26, 39.82],
            [116.27, 39.87],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '站点 A', kind: 'point' },
      geometry: { type: 'Point', coordinates: [116.4, 39.9] },
    },
    {
      type: 'Feature',
      properties: { name: '站点 B', kind: 'point' },
      geometry: { type: 'Point', coordinates: [116.52, 39.89] },
    },
    {
      type: 'Feature',
      properties: { name: '站点 C', kind: 'point' },
      geometry: { type: 'Point', coordinates: [116.31, 39.84] },
    },
  ],
}

let map: any = null
let L: any = null
let areaLayer: any = null
let pointLayer: any = null
let layer: any = null

const LEVEL_COLOR: Record<number, string> = { 1: '#22d3ee', 2: '#f97316', 3: '#8b5cf6' }

function apply() {
  if (!map) return
  showAreas.value ? areaLayer.addTo(map) : map.removeLayer(areaLayer)
  showPoints.value ? pointLayer.addTo(map) : map.removeLayer(pointLayer)
}

function toggle(key: 'area' | 'point', value: any) {
  if (key === 'area') showAreas.value = Boolean(value)
  else showPoints.value = Boolean(value)
  apply()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.885, 116.42], zoom: 11 })

  // style：按属性分级设色；pointToLayer：点转 circleMarker；onEachFeature：绑定交互
  layer = L.geoJSON(data, {
    filter: (f: any) => f.properties.kind === 'area',
    style: (f: any) => ({
      color: LEVEL_COLOR[f.properties.level] || '#22d3ee',
      weight: 2,
      fillColor: LEVEL_COLOR[f.properties.level] || '#22d3ee',
      fillOpacity: 0.16,
    }),
    onEachFeature: (f: any, l: any) => {
      l.bindTooltip(`${f.properties.name}（level ${f.properties.level}）`, { sticky: true })
      l.on('click', () => l.setStyle({ fillOpacity: 0.45 }))
    },
  })
  areaLayer = L.layerGroup([layer])

  pointLayer = L.geoJSON(data, {
    filter: (f: any) => f.properties.kind === 'point',
    pointToLayer: (_f: any, latlng: any) =>
      L.circleMarker(latlng, { radius: 8, color: '#fff', weight: 2, fillColor: '#10b981', fillOpacity: 1 }),
    onEachFeature: (f: any, l: any) => l.bindPopup(`<b>${f.properties.name}</b>`),
  })

  areaLayer.addTo(map)
  pointLayer.addTo(map)
  count.value = data.features.length
  map.fitBounds(layer.getBounds(), { padding: [40, 40] })

  return () => {
    map?.remove()
    map = null
    layer = areaLayer = pointLayer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">GeoJSON：L.geoJSON 一次接管数据解析、style 分级设色、pointToLayer 与 onEachFeature 交互</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="showAreas" size="small" @change="toggle('area', $event)">面要素</el-checkbox>
      <el-checkbox :model-value="showPoints" size="small" @change="toggle('point', $event)">点要素</el-checkbox>
      <el-tag size="small" effect="plain" type="info">Feature {{ count }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
