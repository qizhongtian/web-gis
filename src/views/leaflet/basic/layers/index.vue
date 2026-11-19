<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createBaseLayer, createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const opacity = ref(1)
const showPoints = ref(true)
const order = ref(false)

let map: any = null
let L: any = null
let points: any = null
let lines: any = null
let areas: any = null

function setOpacity(value: any) {
  opacity.value = Number(value)
  points?.setOpacity?.(opacity.value)
  lines?.setOpacity?.(opacity.value)
  areas?.setOpacity?.(opacity.value)
}

function togglePoints(value: any) {
  showPoints.value = Boolean(value)
  if (!map) return
  showPoints.value ? points.addTo(map) : map.removeLayer(points)
}

function swapOrder(value: any) {
  order.value = Boolean(value)
  if (!map) return
  // 图层顺序：后添加的在上层，可用 bringToFront / bringToBack 调整
  order.value ? areas.bringToFront() : areas.bringToBack()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9042, 116.4074], zoom: 10 })

  const osm = createBaseLayer(L, 'osm')
  const light = createBaseLayer(L, 'light')
  osm.addTo(map)

  points = L.layerGroup(
    randomPoints(120, [116.1, 39.7, 116.7, 40.05], 7).map((p) =>
      L.circleMarker(p, { radius: 4, color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.8 }),
    ),
  ).addTo(map)

  lines = L.layerGroup(
    randomPoints(8, [116.1, 39.7, 116.7, 40.05], 11).map((p, i) =>
      L.polyline([p, [p[0] + 0.08, p[1] + 0.06], [p[0] + 0.14, p[1] - 0.02]], {
        color: i % 2 ? '#f97316' : '#8b5cf6',
        weight: 2,
      }),
    ),
  ).addTo(map)

  areas = L.layerGroup([
    L.polygon(
      [
        [39.95, 116.25],
        [39.95, 116.55],
        [39.78, 116.55],
        [39.78, 116.25],
      ],
      { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.12 },
    ),
  ]).addTo(map)

  // 图层控制器：底图组 + 叠加组，勾选即增删图层
  L.control
    .layers(
      { OSM: osm, 'CARTO 浅色': light },
      { 点位: points, 线网: lines, 区域: areas },
      { collapsed: false },
    )
    .addTo(map)

  return () => {
    map?.remove()
    map = null
    points = lines = areas = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">图层控制：L.control.layers 管理底图与叠加层，bringToFront / bringToBack 调整叠放顺序</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="showPoints" size="small" @change="togglePoints as any">显示点位</el-checkbox>
      <el-checkbox :model-value="order" size="small" @change="swapOrder as any">区域置顶</el-checkbox>
      <span class="text-[12px] text-[#64748b]">整体不透明度</span>
      <el-slider class="max-w-36" :model-value="opacity" :min="0.2" :max="1" :step="0.1" size="small" @input="setOpacity" />
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
