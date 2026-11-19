<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, sphericalArea } from '@/utils/gis/leafletDemo'
import { formatArea } from '@/utils/gis/coord'

const areaText = ref('')
const vertexCount = ref(0)

const BASE: [number, number][] = [
  [39.95, 116.32],
  [39.96, 116.48],
  [39.88, 116.52],
  [39.84, 116.4],
  [39.88, 116.3],
]

let map: any = null
let L: any = null
let polygon: any = null
let vertices: any[] = []
let ring: [number, number][] = []

function updateArea() {
  areaText.value = formatArea(sphericalArea(ring))
  vertexCount.value = ring.length
}

function sync() {
  polygon.setLatLngs(ring)
  updateArea()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.41], zoom: 11 })
  ring = BASE.map((p) => [...p] as [number, number])

  polygon = L.polygon(ring, {
    color: '#f97316',
    weight: 2,
    fillColor: '#f97316',
    fillOpacity: 0.16,
  }).addTo(map)

  vertices = []
  ring.forEach((_, i) => {
    const marker = L.marker(ring[i], {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #f97316;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(map)

    marker.on('drag', (e: any) => {
      const ll = e.target.getLatLng()
      ring[i] = [ll.lat, ll.lng]
      // 拖拽过程中直接改几何，实时看到形状变化
      polygon.setLatLngs(ring)
      updateArea()
    })
    marker.on('dragend', () => sync())
    vertices.push(marker)
  })

  updateArea()
  map.fitBounds(polygon.getBounds(), { padding: [40, 40] })

  return () => {
    map?.remove()
    map = null
    polygon = null
    vertices = []
  }
}

function reset() {
  if (!map || !polygon) return
  ring = BASE.map((p) => [...p] as [number, number])
  vertices.forEach((m, i) => m.setLatLng(ring[i]))
  sync()
}

function insertVertex() {
  if (!map || !polygon) return
  // 在最长的边上插入顶点，演示「加点」后几何与统计同步
  let best = 0
  let bestLen = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const len = map.distance(a, b)
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const a = ring[best]
  const b = ring[(best + 1) % ring.length]
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  ring.splice(best + 1, 0, mid)
  polygon.setLatLngs(ring)
  // 顶点变化后重建编辑点
  vertices.forEach((m) => m.remove())
  vertices = ring.map((p) => {
    const m = L.marker(p, { draggable: true }).addTo(map)
    m.on('drag', (e: any) => {
      const ll = e.target.getLatLng()
      const idx = vertices.indexOf(m)
      if (idx >= 0) {
        ring[idx] = [ll.lat, ll.lng]
        polygon.setLatLngs(ring)
        updateArea()
      }
    })
    return m
  })
  updateArea()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">编辑：拖动橙色顶点实时改几何，绕开 Leaflet.draw 用原生 Marker 也能做轻量编辑</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" @click="reset">重置几何</el-button>
      <el-button size="small" type="primary" plain @click="insertVertex">最长边插点</el-button>
      <el-tag size="small" effect="plain" type="info">顶点 {{ vertexCount }}</el-tag>
      <el-tag v-if="areaText" size="small" effect="plain" type="warning">面积 {{ areaText }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
