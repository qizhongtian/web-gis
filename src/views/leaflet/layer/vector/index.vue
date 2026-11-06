<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'

async function init(L: any, el: HTMLElement) {
  const map = L.map(el).setView([34.5, 112.5], 5)

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  })
  const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; CARTO',
  })
  osm.addTo(map)

  const cities = [
    { name: '北京', latlng: [39.9042, 116.4074] },
    { name: '上海', latlng: [31.2304, 121.4737] },
    { name: '广州', latlng: [23.1291, 113.2644] },
    { name: '成都', latlng: [30.5728, 104.0668] },
  ]

  const markers = L.layerGroup(
    cities.map((c) =>
      L.marker(c.latlng).bindPopup(`<b>${c.name}</b><br/>${c.latlng[0].toFixed(4)}, ${c.latlng[1].toFixed(4)}`),
    ),
  ).addTo(map)

  const route = L.polyline(
    cities.map((c) => c.latlng),
    { color: '#22d3ee', weight: 3, dashArray: '8 6' },
  )
    .bindPopup('示例航线')
    .addTo(map)

  const region = L.polygon(
    [
      [40, 112],
      [40, 120],
      [32, 120],
      [32, 112],
    ],
    { color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.15 },
  )
    .bindPopup('示例区域')
    .addTo(map)

  const circle = L.circle([34.5, 112.5], {
    radius: 180000,
    color: '#8b5cf6',
    weight: 2,
    fillColor: '#8b5cf6',
    fillOpacity: 0.08,
  }).addTo(map)

  L.control
    .layers(
      { OSM: osm, 'CARTO 浅色': carto },
      { 城市标注: markers, 航线: route, 区域: region, 圆: circle },
    )
    .addTo(map)

  L.control.scale({ imperial: false }).addTo(map)
  map.fitBounds(region.getBounds(), { padding: [24, 24] })

  return () => map.remove()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">矢量图层：Marker / Polyline / Polygon / Circle，配合图层控制器与比例尺</p>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
