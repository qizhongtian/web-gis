<script setup lang="ts">
import { reactive } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { circleRing, clusterPoints, createMap, lineFC, pointsFC, polygonFC, waitReady } from '@/utils/gis/glDemo'

const visible = reactive({ polygon: true, line: true, points: true })
let map: any = null

function apply(id: string, on: boolean) {
  map?.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [121.4737, 31.2304], zoom: 10 })
  await waitReady(map)

  map.addSource('area', { type: 'geojson', data: polygonFC(circleRing([121.4737, 31.2304], 5), { name: '示范片区' }) })
  map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.16 } })
  map.addLayer({ id: 'area-outline', type: 'line', source: 'area', paint: { 'line-color': '#7e22ce', 'line-width': 2 } })

  map.addSource('route', { type: 'geojson', data: lineFC(clusterPoints(18, [121.4737, 31.2304], 0.08, 12)) })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#f97316', 'line-width': 3, 'line-dasharray': [2, 1.5] },
  })

  map.addSource('poi', {
    type: 'geojson',
    data: pointsFC(clusterPoints(40, [121.4737, 31.2304], 0.1, 21), (i) => ({ name: `POI-${i + 1}` })),
  })
  map.addLayer({
    id: 'poi-circle',
    type: 'circle',
    source: 'poi',
    paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  })


  map.on('click', 'poi-circle', (e: any) => {
    const f = e.features?.[0]
    if (!f) return
    new lib.Popup({ offset: 10 })
      .setLngLat(e.lngLat)
      .setHTML(`<b>${f.properties.name}</b><br/>${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`)
      .addTo(map)
  })
  map.on('mouseenter', 'poi-circle', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'poi-circle', () => (map.getCanvas().style.cursor = ''))

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      GeoJSON 图层：source + layer 分离设计，同一数据源可挂多个图层；点击蓝色 POI 查看属性弹窗
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-checkbox v-model="visible.polygon" @change="apply('area-fill', visible.polygon)">片区面</el-checkbox>
      <el-checkbox v-model="visible.line" @change="apply('route-line', visible.line)">巡检路线</el-checkbox>
      <el-checkbox v-model="visible.points" @change="apply('poi-circle', visible.points)">POI 点位</el-checkbox>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
