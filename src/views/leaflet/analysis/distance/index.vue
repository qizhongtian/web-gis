<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, distanceToSegment } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

const AB = ref('')
const TO_LINE = ref('')
const LINE = ref('')

let map: any = null
let L: any = null
let group: any = null
let road: any = null
let picks: any[] = []

const ROAD: [number, number][] = [
  [39.86, 116.3],
  [39.9, 116.36],
  [39.94, 116.44],
  [39.9, 116.52],
]

function nearestOnRoad(pt: [number, number]) {
  let best = Infinity
  let bestSeg = 0
  for (let i = 1; i < ROAD.length; i++) {
    const d = distanceToSegment(pt, ROAD[i - 1], ROAD[i])
    if (d < best) {
      best = d
      bestSeg = i
    }
  }
  return { distance: best, segment: bestSeg }
}

function onMapClick(e: any) {
  if (picks.length >= 2) clearPicks()
  picks.push(e.latlng)
  if (picks.length === 1) {
    L.circleMarker(e.latlng, { radius: 6, color: '#fff', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 })
      .addTo(group)
      .bindTooltip('起点')
    AB.value = '再点一次设置终点'
    return
  }

  L.circleMarker(e.latlng, { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 })
    .addTo(group)
    .bindTooltip('终点')
  const line = L.polyline([picks[0], picks[1]], { color: '#22d3ee', weight: 3 }).addTo(group)
  const d = map.distance(picks[0], picks[1])
  AB.value = `两点球面距离 ${formatDistance(d)}`
  line.bindTooltip(formatDistance(d), { permanent: true, direction: 'center', className: 'dash-label' })

  const near = nearestOnRoad([e.latlng.lat, e.latlng.lng])
  TO_LINE.value = `终点到最近道路 ${formatDistance(near.distance)}（第 ${near.segment} 段）`
  L.polyline([e.latlng, ROAD[near.segment - 1]], {
    color: '#f97316',
    weight: 2,
    dashArray: '5 5',
  }).addTo(group)
}

function clearPicks() {
  group?.clearLayers()
  picks = []
  AB.value = ''
  TO_LINE.value = ''
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })
  group = L.layerGroup().addTo(map)

  road = L.polyline(ROAD, { color: '#94a3b8', weight: 4 })
    .addTo(map)
    .bindTooltip('参考道路（用于点到线距离）', { sticky: true })

  let total = 0
  for (let i = 1; i < ROAD.length; i++) total += map.distance(ROAD[i - 1], ROAD[i])
  LINE.value = formatDistance(total)

  map.on('click', onMapClick)

  return () => {
    map?.off('click', onMapClick)
    map?.remove()
    map = null
    group = null
    road = null
    picks = []
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">距离：两点球面距离用 map.distance，点到线用局部平面投影求垂足，避免逐点插值</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" @click="clearPicks">清空</el-button>
      <el-tag size="small" effect="plain" type="info">{{ AB || '点击地图设置起点' }}</el-tag>
      <el-tag v-if="TO_LINE" size="small" effect="plain" type="warning">{{ TO_LINE }}</el-tag>
      <el-tag size="small" effect="plain">道路全长 {{ LINE }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
