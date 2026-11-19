<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, pointInPolygon } from '@/utils/gis/leafletDemo'

interface Result {
  lat: number
  lng: number
  inside: boolean
  name: string
}

const results = ref<Result[]>([])
const insideCount = ref(0)

let map: any = null
let L: any = null
let testLayer: any = null
let ring: [number, number][] = []

const RING: [number, number][] = [
  [39.96, 116.3],
  [39.98, 116.48],
  [39.9, 116.56],
  [39.8, 116.48],
  [39.8, 116.32],
]

function recalc() {
  insideCount.value = results.value.filter((r) => r.inside).length
}

function onMapClick(e: any) {
  const pt: [number, number] = [e.latlng.lat, e.latlng.lng]
  const inside = pointInPolygon(pt, ring)
  const idx = results.value.length + 1
  results.value = [...results.value, { lat: pt[0], lng: pt[1], inside, name: `P${idx}` }]
  L.circleMarker(pt, {
    radius: 7,
    color: '#fff',
    weight: 2,
    fillColor: inside ? '#10b981' : '#ef4444',
    fillOpacity: 1,
  })
    .addTo(testLayer)
    .bindTooltip(`${inside ? '面内' : '面外'} · ${pt[0].toFixed(4)}, ${pt[1].toFixed(4)}`)
  recalc()
}

function clear() {
  testLayer?.clearLayers()
  results.value = []
  insideCount.value = 0
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.89, 116.43], zoom: 11 })
  ring = RING.map((p) => [...p] as [number, number])

  L.polygon(ring, {
    color: '#22d3ee',
    weight: 2,
    fillColor: '#22d3ee',
    fillOpacity: 0.14,
  })
    .addTo(map)
    .bindTooltip('判断区域（点击地图放点）', { sticky: true })

  testLayer = L.layerGroup().addTo(map)
  map.on('click', onMapClick)

  return () => {
    map?.off('click', onMapClick)
    map?.remove()
    map = null
    testLayer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">空间关系：射线法判断点是否在多边形内（几何关系判断是查询、围栏等功能的基础）</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" @click="clear">清空测试点</el-button>
      <el-tag size="small" effect="plain" type="success">面内 {{ insideCount }}</el-tag>
      <el-tag size="small" effect="plain" type="danger">面外 {{ results.length - insideCount }}</el-tag>
      <span class="text-[12px] text-[#6b7280]">在地图上点击加点，绿=面内，红=面外</span>
    </div>
    <div class="max-h-20 overflow-auto text-[12px] font-mono text-[#475569] leading-5">
      <span v-for="r in results" :key="r.name" class="mr-3" :class="r.inside ? 'text-[#10b981]' : 'text-[#ef4444]'">
        {{ r.name }}{{ r.inside ? ' 内' : ' 外' }}
      </span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
