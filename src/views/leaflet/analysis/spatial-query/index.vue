<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const queryMode = ref(true)
const hitCount = ref(0)
const cost = ref(0)
const totalCount = ref(0)

let map: any = null
let L: any = null
let dataLayer: any = null
let rect: any = null
let startPoint: any = null
let drawing = false
let points: { ll: [number, number]; marker: any }[] = []

function runQuery(bounds: any) {
  const t0 = performance.now()
  let hits = 0
  for (const p of points) {
    const inside = bounds.contains(p.ll)
    p.marker.setStyle(
      inside
        ? { color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }
        : { color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.45 },
    )
    if (inside) hits++
  }
  hitCount.value = hits
  cost.value = Number((performance.now() - t0).toFixed(2))
}

function reset() {
  rect?.remove()
  rect = null
  hitCount.value = 0
  cost.value = 0
  points.forEach((p) =>
    p.marker.setStyle({ color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.45 }),
  )
}

function toggleMode(value: any) {
  queryMode.value = Boolean(value)
  if (map) queryMode.value ? map.dragging.enable() : map.dragging.disable()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })

  dataLayer = L.layerGroup().addTo(map)
  points = randomPoints(600, [116.15, 39.7, 116.68, 40.1], 99).map((ll) => {
    const marker = L.circleMarker(ll, {
      radius: 4,
      color: '#0ea5e9',
      weight: 1,
      fillColor: '#0ea5e9',
      fillOpacity: 0.45,
    }).addTo(dataLayer)
    return { ll, marker }
  })
  totalCount.value = points.length

  map.on('mousedown', (e: any) => {
    if (!queryMode.value) return
    drawing = true
    map.dragging.disable()
    startPoint = e.containerPoint
  })

  map.on('mousemove', (e: any) => {
    if (!drawing) return
    const bounds = L.latLngBounds(map.containerPointToLatLng(startPoint), e.latlng)
    if (!rect) {
      rect = L.rectangle(bounds, {
        color: '#f97316',
        weight: 2,
        dashArray: '6 4',
        fillColor: '#f97316',
        fillOpacity: 0.08,
      }).addTo(map)
    } else {
      rect.setBounds(bounds)
    }
  })

  map.on('mouseup', () => {
    if (!drawing) return
    drawing = false
    map.dragging.enable()
    if (rect) runQuery(rect.getBounds())
  })

  return () => {
    map?.remove()
    map = null
    dataLayer = null
    rect = null
    points = []
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">空间查询：按住左键拖出矩形，遍历点位做 bounds.contains 判断并高亮命中（按需可换成后端查询）</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-checkbox :model-value="queryMode" size="small" @change="toggleMode as any">框选模式（关闭后恢复拖动）</el-checkbox>
      <el-button size="small" @click="reset">清除结果</el-button>
      <el-tag size="small" effect="plain" type="info">总量 {{ totalCount }}</el-tag>
      <el-tag size="small" effect="plain" type="danger">命中 {{ hitCount }}</el-tag>
      <el-tag v-if="cost" size="small" effect="plain" type="success">遍历耗时 {{ cost }}ms</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
