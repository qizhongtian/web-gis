<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, sphericalArea } from '@/utils/gis/leafletDemo'
import { formatArea } from '@/utils/gis/coord'

const fill = ref('#f97316')
const withHole = ref(true)
const areaText = ref('')

let map: any = null
let L: any = null
let outer: any = null
let hole: any = null
let poly: any = null

const RING: [number, number][] = [
  [39.96, 116.28],
  [39.98, 116.5],
  [39.9, 116.62],
  [39.8, 116.52],
  [39.79, 116.32],
  [39.87, 116.24],
]

const HOLE: [number, number][] = [
  [39.9, 116.38],
  [39.91, 116.46],
  [39.86, 116.47],
  [39.85, 116.38],
]

function refresh() {
  if (!poly) return
  poly.setStyle({ fillColor: fill.value, color: fill.value })
  if (withHole.value) {
    hole.addTo(map)
  } else {
    map.removeLayer(hole)
  }
  const net = sphericalArea(RING) - (withHole.value ? sphericalArea(HOLE) : 0)
  areaText.value = formatArea(net)
}

function toggleHole(value: any) {
  withHole.value = Boolean(value)
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.89, 116.43], zoom: 11 })

  // Leaflet 的「洞」：同一个 polygon 传多个环，第二个环即内环
  poly = L.polygon([RING], {
    color: fill.value,
    weight: 2,
    fillColor: fill.value,
    fillOpacity: 0.18,
  })
    .addTo(map)
    .bindPopup('多边形：点击可查看，双击缩放')

  hole = L.polygon([HOLE], {
    color: '#22d3ee',
    weight: 2,
    dashArray: '6 4',
    fillColor: '#0a1a28',
    fillOpacity: 0.55,
  }).bindTooltip('内环（洞）')

  // 顶点：拖一点就能看出几何是由点串起来的
  RING.forEach((p, i) =>
    L.circleMarker(p, { radius: 4, color: '#fff', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip(`P${i + 1}`),
  )

  poly.on('click', () => {
    poly.setStyle({ fillOpacity: 0.4 })
    window.setTimeout(() => poly.setStyle({ fillOpacity: 0.18 }), 220)
  })

  map.fitBounds(poly.getBounds(), { padding: [40, 40] })
  refresh()

  return () => {
    map?.remove()
    map = null
    poly = hole = outer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Polygon：多环几何（外环 + 内环挖洞）、样式实时切换、点击高亮与球面面积</p>
    <div class="flex items-center gap-3 flex-wrap">
      <span class="text-[12px] text-[#64748b]">填充色</span>
      <el-color-picker v-model="fill" size="small" @change="refresh" />
      <el-checkbox :model-value="withHole" size="small" @change="toggleHole as any">内环挖洞</el-checkbox>
      <el-tag v-if="areaText" size="small" effect="plain" type="warning">净面积 {{ areaText }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
