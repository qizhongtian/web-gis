<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { circleRing, clusterPoints, createMap, lineFC, pointsFC, polygonFC, waitReady } from '@/utils/gis/glDemo'

const items = reactive([
  { id: 'area', name: '片区面', on: true },
  { id: 'route', name: '巡检路线', on: true },
  { id: 'poi', name: 'POI 点位', on: true },
])
const order = ref('')
let map: any = null

function refreshOrder() {
  const layers = map?.getStyle()?.layers ?? []
  order.value = layers.map((l: any) => l.id).filter((id: string) => id !== 'bg' && id !== 'base').join(' → ')
}

function toggle(item: { id: string; on: boolean }) {
  map?.setLayoutProperty(item.id, 'visibility', item.on ? 'visible' : 'none')
}

function bringToTop(item: { id: string }) {
  // 不传第二个参数即移到最上层
  map?.moveLayer(item.id)
  refreshOrder()
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [116.4074, 39.9042], zoom: 9.8 })
  await waitReady(map)

  map.addSource('area', { type: 'geojson', data: polygonFC(circleRing([116.4074, 39.9042], 7)) })
  map.addLayer({ id: 'area', type: 'fill', source: 'area', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.2 } })

  map.addSource('route', { type: 'geojson', data: lineFC(clusterPoints(14, [116.4074, 39.9042], 0.08, 6)) })
  map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#f97316', 'line-width': 3 } })

  map.addSource('poi', {
    type: 'geojson',
    data: pointsFC(clusterPoints(24, [116.4074, 39.9042], 0.09, 8), (i) => ({ name: `POI-${i}` })),
  })
  map.addLayer({
    id: 'poi',
    type: 'circle',
    source: 'poi',
    paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  })

  refreshOrder()

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      图层管理：layer 的先后顺序就是绘制顺序，moveLayer 可随时置顶；MapLibre 没有内置图层控件，业务里通常自己拼一个面板
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <template v-for="item in items" :key="item.id">
        <el-checkbox v-model="item.on" @change="toggle(item)">{{ item.name }}</el-checkbox>
        <el-button size="small" text type="primary" @click="bringToTop(item)">置顶</el-button>
      </template>
    </div>
    <div class="text-[12px] text-[#94a3b8]">绘制顺序：{{ order }}</div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
