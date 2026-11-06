<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'

const length = ref(0)
let map: any = null
let draw: any = null
let source: any = null

async function init(ol: any, el: HTMLElement) {
  const { Map, View, TileLayer, VectorLayer, VectorSource, OSM, Draw, Style, Stroke, getLength, fromLonLat } = ol

  source = new VectorSource()
  draw = new Draw({
    source,
    type: 'LineString',
    style: new Style({ stroke: new Stroke({ color: '#22d3ee', width: 3, lineDash: [8, 6] }) }),
  })
  draw.on('drawend', (e: any) => {
    // 球面长度（米）
    length.value = Math.round(getLength(e.feature.getGeometry()))
  })

  map = new Map({
    target: el,
    layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source })],
    view: new View({ center: fromLonLat([116.407, 39.904]), zoom: 10 }),
  })
  map.addInteraction(draw)

  return () => {
    map.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">距离量算：绘制折线，使用 ol/sphere getLength 计算球面长度</p>
    <el-tag type="success" effect="dark" class="w-fit">总长度：{{ (length / 1000).toFixed(2) }} km</el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
