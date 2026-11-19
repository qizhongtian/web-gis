<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

const color = ref('#22d3ee')
const weight = ref(4)
const dashed = ref(true)
const arrow = ref(true)

let map: any = null
let L: any = null
let line: any = null
let arrows: any = null
let path: [number, number][] = []

function bearing(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad)
  const x =
    Math.cos(a[0] * rad) * Math.sin(b[0] * rad) -
    Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad)
  return (Math.atan2(y, x) * 180) / Math.PI
}

/** 沿线等距放箭头（Leaflet 没有内置装饰器，用旋转的 divIcon 模拟） */
function drawArrows() {
  arrows.clearLayers()
  if (!arrow.value) return
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    for (let k = 1; k <= 3; k++) {
      const t = k / 4
      const ll: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      const angle = bearing(a, b)
      const icon = L.divIcon({
        className: '',
        html: `<div style="transform:rotate(${angle - 90}deg);color:${color.value};font-size:14px;line-height:14px">➤</div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      L.marker(ll, { icon, interactive: false }).addTo(arrows)
    }
  }
}

function restyle() {
  if (!line) return
  line.setStyle({
    color: color.value,
    weight: weight.value,
    dashArray: dashed.value ? '10 8' : undefined,
  })
  drawArrows()
}

function toggleArrow(value: any) {
  arrow.value = Boolean(value)
  drawArrows()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })

  path = [
    [39.86, 116.3],
    [39.885, 116.4],
    [39.925, 116.46],
    [39.95, 116.38],
  ]

  let total = 0
  for (let i = 1; i < path.length; i++) total += L.latLng(path[i - 1]).distanceTo(L.latLng(path[i]))

  line = L.polyline(path, {
    color: color.value,
    weight: weight.value,
    dashArray: dashed.value ? '10 8' : undefined,
  })
    .addTo(map)
    .bindTooltip(`总长 ${formatDistance(total)}`, { sticky: true })

  arrows = L.layerGroup().addTo(map)
  drawArrows()

  // 顶点标记，便于看出折线节点
  path.forEach((p, i) => {
    L.circleMarker(p, { radius: 5, color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip(`节点 ${i + 1}`)
  })

  map.fitBounds(line.getBounds(), { padding: [40, 40] })
  return () => {
    map?.remove()
    map = null
    line = null
    arrows = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Polyline：虚线样式与沿线箭头装饰，箭头用旋转 divIcon 沿线段等距放置</p>
    <div class="flex items-center gap-3 flex-wrap">
      <span class="text-[12px] text-[#64748b]">颜色</span>
      <el-color-picker v-model="color" size="small" @change="restyle" />
      <span class="text-[12px] text-[#64748b]">线宽 {{ weight }}</span>
      <el-slider class="max-w-32" :model-value="weight" :min="1" :max="12" :step="1" size="small" @input="(v) => { weight = Number(v); restyle() }" />
      <el-checkbox :model-value="dashed" size="small" @change="(v) => { dashed = Boolean(v); restyle() }">虚线</el-checkbox>
      <el-checkbox :model-value="arrow" size="small" @change="toggleArrow as any">箭头装饰</el-checkbox>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
