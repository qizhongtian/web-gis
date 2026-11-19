<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { addLegend, createCanvasLayer, createDemoMap, heatColor, seeded } from '@/utils/gis/leafletDemo'

const cell = ref(12)
const power = ref(2)
const layerCount = ref(5)

let map: any = null
let L: any = null
let layer: any = null
let layerGroup: any = null
let stations: { ll: [number, number]; value: number }[] = []
let legend: any = null

function buildStations() {
  const rnd = seeded(77)
  const list: { ll: [number, number]; value: number }[] = []
  for (let i = 0; i < 9; i++) {
    list.push({
      ll: [39.78 + rnd() * 0.24, 116.22 + rnd() * 0.36],
      value: Math.round(20 + rnd() * 80),
    })
  }
  return list
}

/** IDW（反距离权重）插值：格网中心取值 */
function idw(x: number, y: number) {
  let num = 0
  let den = 0
  for (const s of stations) {
    const dx = x - s.ll[1]
    const dy = y - s.ll[0]
    const d2 = dx * dx + dy * dy
    if (d2 < 1e-10) return s.value
    const w = 1 / Math.pow(d2, power.value / 2)
    num += w * s.value
    den += w
  }
  return num / den
}

function rebuild() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  const size = cell.value
  const levels = layerCount.value

  layer = createCanvasLayer(L, (c) => {
    const { ctx, size: sz } = c
    for (let py = 0; py < sz.y; py += size) {
      for (let px = 0; px < sz.x; px += size) {
        const ll = map.containerPointToLatLng([px + size / 2, py + size / 2])
        const v = idw(ll.lng, ll.lat) / 100
        const bucket = Math.floor(Math.min(0.999, Math.max(0, v)) * levels) / (levels - 1)
        const [r, g, b] = heatColor(bucket)
        ctx.fillStyle = `rgba(${r},${g},${b},0.62)`
        ctx.fillRect(px, py, size + 0.5, size + 0.5)
      }
    }
  })
  layer.addTo(map)

  // 站点与数值
  layerGroup.clearLayers()
  stations.forEach((s, i) => {
    L.circleMarker(s.ll, { radius: 5, color: '#fff', weight: 2, fillColor: '#0f172a', fillOpacity: 1 })
      .addTo(layerGroup)
      .bindTooltip(`站 ${i + 1}：${s.value}`, { direction: 'top' })
  })

  if (legend) map.removeControl(legend)
  legend = addLegend(L, map, '等值面（IDW）', [
    { color: 'rgb(30,80,220)', label: '低值' },
    { color: 'rgb(0,200,220)', label: '偏低' },
    { color: 'rgb(60,210,120)', label: '中等' },
    { color: 'rgb(245,210,60)', label: '偏高' },
    { color: 'rgb(240,60,60)', label: '高值' },
  ])
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.4], zoom: 10 })
  layerGroup = L.layerGroup().addTo(map)
  stations = buildStations()
  rebuild()
  return () => {
    map?.remove()
    map = null
    layer = null
    layerGroup = null
    legend = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      等值面：站点数据做 IDW 反距离权重插值，按格网取色绘制；格网越小越平滑，代价是重绘更慢
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">格网 {{ cell }}px</span>
      <el-slider class="max-w-28" :model-value="cell" :min="6" :max="30" :step="2" size="small" @input="(v) => { cell = Number(v); rebuild() }" />
      <span class="text-[12px] text-[#64748b]">幂次 {{ power }}</span>
      <el-slider class="max-w-24" :model-value="power" :min="1" :max="4" :step="0.5" size="small" @input="(v) => { power = Number(v); rebuild() }" />
      <span class="text-[12px] text-[#64748b]">分级 {{ layerCount }}</span>
      <el-slider class="max-w-24" :model-value="layerCount" :min="3" :max="9" :step="1" size="small" @input="(v) => { layerCount = Number(v); rebuild() }" />
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
