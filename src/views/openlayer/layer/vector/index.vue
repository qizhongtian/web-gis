<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const count = ref(0)
let map: any = null
let source: any = null

async function init(lib: any, el: HTMLElement) {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '北京' },
        geometry: { type: 'Point', coordinates: [116.407, 39.904] },
      },
      {
        type: 'Feature',
        properties: { name: '上海' },
        geometry: { type: 'Point', coordinates: [121.473, 31.23] },
      },
      {
        type: 'Feature',
        properties: { name: '区域' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [114, 34],
              [120, 34],
              [120, 30],
              [114, 30],
              [114, 34],
            ],
          ],
        },
      },
    ],
  }

  source = new lib.VectorSource({
    features: new lib.GeoJSON().readFeatures(geojson, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }),
  })

  const vectorLayer = new lib.VectorLayer({
    source,
    style: new lib.Style({
      stroke: new lib.Stroke({ color: '#22d3ee', width: 2 }),
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.2)' }),
      image: new lib.CircleStyle({
        radius: 6,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.5, 32], zoom: 5, layers: [vectorLayer] })
  count.value = source.getFeatures().length
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">VectorLayer：VectorSource 管理要素集合，统一 Style 渲染点 / 线 / 面，支持增删要素后自动重绘</p>
    <el-tag class="w-fit" size="small" effect="plain">要素数：{{ count }}</el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
