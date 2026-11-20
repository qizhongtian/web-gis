<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { clusterPoints, createMap, pointsFC, waitReady } from '@/utils/gis/glDemo'

const radius = ref(50)
const total = ref(8000)
let map: any = null

function applyRadius(v: number) {
  radius.value = v
  // clusterRadius 属于 source 参数，需重建 source 才能生效
  map?.removeLayer('clusters')
  map?.removeLayer('unclustered')
  map?.removeSource('pts')
  addClusterSource(v)
}

function addClusterSource(r: number) {
  map.addSource('pts', {
    type: 'geojson',
    data: pointsFC(clusterPoints(total.value, [116.4074, 39.9042], 0.2, 4)),
    cluster: true,
    clusterRadius: r,
    clusterMaxZoom: 14,
  })
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pts',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#22d3ee', 20, '#38bdf8', 100, '#6366f1', 500, '#f472b6'],
      'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24, 500, 30],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'unclustered',
    type: 'circle',
    source: 'pts',
    filter: ['!', ['has', 'point_count']],
    paint: { 'circle-radius': 3.5, 'circle-color': '#0ea5e9', 'circle-opacity': 0.9 },
  })
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [116.4074, 39.9042], zoom: 9.6 })
  await waitReady(map)
  addClusterSource(radius.value)

  map.on('click', 'clusters', (e: any) => {
    const f = e.features?.[0]
    if (!f) return
    const count = f.properties.point_count
    new lib.Popup({ offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(`<b>${count} 个点位</b><br/><span style="color:#64748b">点击聚合点自动放大</span>`)
      .addTo(map)
    map
      .getSource('pts')
      .getClusterExpansionZoom(f.properties.cluster_id)
      .then((zoom: number) => map.easeTo({ center: e.lngLat, zoom, duration: 500 }))
  })
  map.on('click', 'unclustered', (e: any) => {
    new lib.Popup({ offset: 8 }).setLngLat(e.lngLat).setHTML('独立点位').addTo(map)
  })
  map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''))

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      点聚合：source 配 cluster 参数即可在渲染层聚合，clusterRadius 控制合并范围，点击聚合点用 getClusterExpansionZoom 逐级展开
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">{{ total }} 个点位</el-tag>
      <span class="flex items-center gap-2">聚合半径 {{ radius }}px
        <el-slider class="!w-36" :model-value="radius" :min="20" :max="100" :step="5" size="small" @input="applyRadius as any" />
      </span>
      <span>点击聚合圆查看数量并放大</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
