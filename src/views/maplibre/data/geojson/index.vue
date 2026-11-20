<script setup lang="ts">
import { reactive } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import {
  circleRing,
  clusterPoints,
  createMap,
  lineFC,
  pointsFC,
  polygonFC,
  waitReady,
} from '@/utils/gis/glDemo'

const visible = reactive({ polygon: true, line: true, points: true })
let map: any = null

function apply(id: string, on: boolean) {
  if (!map) return
  map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [116.4074, 39.9042], zoom: 10 })
  await waitReady(map)

  // 面：面图层 + 描边
  map.addSource('demo-area', { type: 'geojson', data: polygonFC(circleRing([116.4074, 39.9042], 6), { name: '核心片区' }) })
  map.addLayer({ id: 'area-fill', type: 'fill', source: 'demo-area', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.18 } })
  map.addLayer({ id: 'area-outline', type: 'line', source: 'demo-area', paint: { 'line-color': '#0891b2', 'line-width': 2 } })

  // 线：虚线路径
  const route = clusterPoints(18, [116.4074, 39.9042], 0.09, 12)
  map.addSource('demo-route', { type: 'geojson', data: lineFC(route, { name: '巡检路线' }) })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'demo-route',
    paint: { 'line-color': '#f97316', 'line-width': 3, 'line-dasharray': [2, 1.5] },
  })

  // 点：POI 圆点
  const pois = clusterPoints(40, [116.4074, 39.9042], 0.1, 21)
  map.addSource('demo-poi', {
    type: 'geojson',
    data: pointsFC(pois, (i) => ({ name: `POI-${String(i + 1).padStart(2, '0')}` })),
  })
  map.addLayer({
    id: 'poi-circle',
    type: 'circle',
    source: 'demo-poi',
    paint: {
      'circle-radius': 6,
      'circle-color': '#2563eb',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
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
      GeoJSON 图层：source 负责数据、layer 负责绘制，同一份数据可以叠加 fill / line / circle 多个图层
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-checkbox v-model="visible.polygon" @change="apply('area-fill', visible.polygon)">行政区面</el-checkbox>
      <el-checkbox v-model="visible.line" @change="apply('route-line', visible.line)">巡检路线</el-checkbox>
      <el-checkbox v-model="visible.points" @change="apply('poi-circle', visible.points)">POI 点位</el-checkbox>
      <span>点击蓝色点位查看属性弹窗</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
