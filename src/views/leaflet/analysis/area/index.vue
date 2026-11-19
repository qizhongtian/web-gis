<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, sphericalArea } from '@/utils/gis/leafletDemo'
import { formatArea } from '@/utils/gis/coord'

const sphere = ref('')
const planar = ref('')
const circleArea = ref('')
const radius = ref(900)

const RING: [number, number][] = [
  [39.95, 116.32],
  [39.96, 116.48],
  [39.88, 116.52],
  [39.84, 116.4],
  [39.88, 116.3],
]

let map: any = null
let L: any = null
let polygon: any = null
let circle: any = null
let ring: [number, number][] = []

/** 平面近似：先把经纬度投到米制再做鞋带公式，和球面公式对比可看出误差量级 */
function planarArea(pts: [number, number][]) {
  const origin = pts[0]
  const ky = 111320
  const kx = 111320 * Math.cos((origin[0] * Math.PI) / 180)
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    sum += (p1[1] - origin[1]) * kx * ((p2[0] - origin[0]) * ky) - (p2[1] - origin[1]) * kx * ((p1[0] - origin[0]) * ky)
  }
  return Math.abs(sum / 2)
}

function refresh() {
  const s = sphericalArea(ring)
  sphere.value = formatArea(s)
  planar.value = formatArea(planarArea(ring))
  circleArea.value = formatArea(Math.PI * radius.value * radius.value)
  circle?.setRadius(radius.value)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.41], zoom: 11 })
  ring = RING.map((p) => [...p] as [number, number])

  polygon = L.polygon(ring, {
    color: '#22d3ee',
    weight: 2,
    fillColor: '#22d3ee',
    fillOpacity: 0.18,
  }).addTo(map)

  // 顶点可拖：面积随几何实时变化
  ring.forEach((p, i) => {
    const marker = L.marker(p, {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #22d3ee"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(map)
    marker.on('drag', (e: any) => {
      const ll = e.target.getLatLng()
      ring[i] = [ll.lat, ll.lng]
      polygon.setLatLngs(ring)
      refresh()
    })
  })

  circle = L.circle([39.9, 116.41], {
    radius: radius.value,
    color: '#f97316',
    weight: 2,
    dashArray: '6 6',
    fillColor: '#f97316',
    fillOpacity: 0.08,
  })
    .addTo(map)
    .bindTooltip('等半径圆形对照（虚线）', { sticky: true })

  refresh()
  map.fitBounds(polygon.getBounds(), { padding: [40, 40] })

  return () => {
    map?.remove()
    map = null
    polygon = null
    circle = null
  }
}

function setRadius(value: any) {
  radius.value = Number(value)
  refresh()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">面积：球面公式与平面近似对比，拖动青色顶点可实时看到差异随纬度/尺度变化</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="plain" type="success">球面 {{ sphere }}</el-tag>
      <el-tag size="small" effect="plain" type="info">平面近似 {{ planar }}</el-tag>
      <span class="text-[12px] text-[#64748b]">圆半径 {{ radius }}m</span>
      <el-slider class="max-w-32" :model-value="radius" :min="200" :max="2500" :step="100" size="small" @input="setRadius" />
      <el-tag size="small" effect="plain" type="warning">圆面积 {{ circleArea }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
