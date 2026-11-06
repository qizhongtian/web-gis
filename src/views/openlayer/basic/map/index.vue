<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'

async function init(ol: any, el: HTMLElement) {
  const { Map, View, TileLayer, OSM, fromLonLat } = ol
  const map = new Map({
    target: el,
    layers: [new TileLayer({ source: new OSM() })],
    view: new View({ center: fromLonLat([116.407, 39.904]), zoom: 10 }),
  })
  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">OpenLayers 基础：初始化地图（OSM 底图 + View 视角）</p>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
