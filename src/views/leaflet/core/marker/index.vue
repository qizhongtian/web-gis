<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const draggable = ref(true)
const lastPick = ref('点击任意标记查看信息')

let map: any = null
let L: any = null
const markers: any[] = []

function toggleDraggable(value: any) {
  draggable.value = Boolean(value)
  markers.forEach((m) => {
    if (m.dragging) {
      draggable.value ? m.dragging.enable() : m.dragging.disable()
    }
  })
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9042, 116.4074], zoom: 11 })
  markers.length = 0

  // 1. 默认图标 Marker
  const plain = L.marker([39.935, 116.36], { draggable: draggable.value })
    .addTo(map)
    .bindPopup('<b>默认图标</b><br/>L.marker + bindPopup')
    .bindTooltip('默认图标 Marker', { direction: 'top', offset: [0, -30] })
  markers.push(plain)

  // 2. divIcon 自定义 HTML 图标
  const divIcon = L.divIcon({
    className: '',
    html:
      '<div style="width:34px;height:34px;border-radius:50%;background:#22d3ee;color:#083344;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(34,211,238,.6);border:2px solid #fff">POI</div>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
  const custom = L.marker([39.9, 116.46], { icon: divIcon, draggable: draggable.value })
    .addTo(map)
    .bindPopup('divIcon：任意 HTML 都能作为图标')
  markers.push(custom)

  // 3. circleMarker 矢量圆点（大量点位首选，走 Canvas/SVG 渲染）
  const dots = L.layerGroup(
    [
      [39.87, 116.33],
      [39.88, 116.4],
      [39.86, 116.47],
    ].map((p) =>
      L.circleMarker(p, {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: '#f97316',
        fillOpacity: 1,
      }).bindPopup('circleMarker：按像素半径绘制'),
    ),
  ).addTo(map)

  map.on('click', (e: any) => {
    lastPick.value = `地图点击 ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`
  })
  custom.on('dragend', (e: any) => {
    const ll = e.target.getLatLng()
    lastPick.value = `拖动结束 ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`
  })

  return () => {
    map?.remove()
    map = null
    markers.length = 0
    void dots
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Marker：默认图标 / divIcon 自定义 HTML / circleMarker 矢量点，支持拖动与 tooltip</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="draggable" size="small" @change="toggleDraggable as any">标记可拖动</el-checkbox>
      <el-tag size="small" effect="plain" type="info">{{ lastPick }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
