<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'

async function init(L: any, el: HTMLElement) {
  const map = L.map(el, { zoomControl: true }).setView([39.9042, 116.4074], 10)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  return () => map.remove()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Leaflet 基础：初始化地图（OSM 底图 + setView 视角）</p>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
