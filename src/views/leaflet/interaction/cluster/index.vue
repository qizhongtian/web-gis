<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const showRaw = ref(false)
const clusterCount = ref(0)
const rawCount = ref(0)

let map: any = null
let L: any = null
let rawLayer: any = null
let clusterLayer: any = null
let points: [number, number][] = []

const CELL = 76

function sizeColor(n: number) {
  if (n >= 60) return { bg: '#ef4444', size: 46 }
  if (n >= 25) return { bg: '#f97316', size: 40 }
  if (n >= 8) return { bg: '#22d3ee', size: 34 }
  return { bg: '#10b981', size: 28 }
}

/** 屏幕像素网格聚合：每次视图变化后重算，等价于 MarkerCluster 的简化实现 */
function renderClusters() {
  if (!map || !clusterLayer) return
  clusterLayer.clearLayers()
  const cells = new Map<string, { lat: number; lng: number; n: number }>()
  for (const ll of points) {
    const p = map.latLngToContainerPoint(ll)
    const key = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`
    const cell = cells.get(key)
    if (cell) {
      cell.lat += ll[0]
      cell.lng += ll[1]
      cell.n += 1
    } else {
      cells.set(key, { lat: ll[0], lng: ll[1], n: 1 })
    }
  }

  cells.forEach((cell) => {
    const center: [number, number] = [cell.lat / cell.n, cell.lng / cell.n]
    const { bg, size } = sizeColor(cell.n)
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;
        display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;
        box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid rgba(255,255,255,.85)">${cell.n}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
    const marker = L.marker(center, { icon }).addTo(clusterLayer)
    marker.on('click', () => {
      map.setView(center, Math.min(map.getZoom() + 2, 18), { animate: true })
    })
  })

  clusterCount.value = cells.size
}

function toggleRaw(value: any) {
  showRaw.value = Boolean(value)
  if (!map) return
  showRaw.value ? rawLayer.addTo(map) : map.removeLayer(rawLayer)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.91, 116.42], zoom: 11 })
  points = randomPoints(700, [116.18, 39.72, 116.65, 40.08], 2026)
  rawCount.value = points.length

  rawLayer = L.layerGroup(
    points.map((p) => L.circleMarker(p, { radius: 3, color: '#0ea5e9', fillOpacity: 0.7, weight: 1 })),
  )
  clusterLayer = L.layerGroup().addTo(map)

  renderClusters()
  map.on('moveend zoomend', renderClusters)

  return () => {
    map?.off('moveend zoomend', renderClusters)
    map?.remove()
    map = null
    rawLayer = null
    clusterLayer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">聚合：按屏幕像素网格分组，聚合点大小与颜色随数量变化，点击自动放大展开</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="showRaw" size="small" @change="toggleRaw as any">显示原始点</el-checkbox>
      <el-tag size="small" effect="plain" type="info">原始点 {{ rawCount }}</el-tag>
      <el-tag size="small" effect="plain" type="success">聚合后 {{ clusterCount }}</el-tag>
      <span class="text-[12px] text-[#6b7280]">缩放地图观察聚合数量变化</span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
