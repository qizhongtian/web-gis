<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { circleRing, clusterPoints, createMap, lineFC, pointsFC, polygonFC, waitReady } from '@/utils/gis/glDemo'

const hover = ref('')
const hits = ref(0)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [121.4737, 31.2304], zoom: 10 })
  await waitReady(map)

  map.addSource('zone', { type: 'geojson', data: polygonFC(circleRing([121.4737, 31.2304], 5), { name: '重点区域' }) })
  map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.12 } })

  map.addSource('road', { type: 'geojson', data: lineFC(clusterPoints(16, [121.4737, 31.2304], 0.07, 5), { name: '主干道' }) })
  map.addLayer({ id: 'road-line', type: 'line', source: 'road', paint: { 'line-color': '#f97316', 'line-width': 3 } })

  map.addSource('poi', {
    type: 'geojson',
    data: pointsFC(clusterPoints(30, [121.4737, 31.2304], 0.09, 21), (i) => ({ name: `POI-${i + 1}` })),
  })
  map.addLayer({
    id: 'poi',
    type: 'circle',
    source: 'poi',
    paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  })


  // queryRenderedFeatures：按像素坐标查询当前视口内命中的要素
  map.on('mousemove', (e: any) => {
    const feats = map.queryRenderedFeatures(e.point, { layers: ['poi', 'road-line', 'zone-fill'] })
    if (feats.length) {
      map.getCanvas().style.cursor = 'pointer'
      hover.value = `${feats[0].layer.id} · ${feats[0].properties?.name ?? '未命名'}`
    } else {
      map.getCanvas().style.cursor = ''
      hover.value = ''
    }
  })

  map.on('click', (e: any) => {
    const feats = map.queryRenderedFeatures(e.point, { layers: ['poi', 'road-line', 'zone-fill'] })
    hits.value = feats.length
    if (!feats.length) return
    const rows = feats
      .slice(0, 4)
      .map((f: any) => `<li>${f.layer.id} · ${f.properties?.name ?? '未命名'}</li>`)
      .join('')
    new lib.Popup({ offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(`<b>命中 ${feats.length} 个要素</b><ul style="margin:6px 0 0;padding-left:16px">${rows}</ul>`)
      .addTo(map)
  })

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      要素查询：queryRenderedFeatures 以屏幕像素为输入，返回当前渲染命中的要素，适合做悬浮提示、点击拾取与框选查询
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">悬浮：{{ hover || '无' }}</el-tag>
      <el-tag size="small">最近一次点击命中 {{ hits }} 个</el-tag>
      <span>在面 / 线 / 点上点击试试</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
