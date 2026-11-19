<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createCanvasLayer, createDemoMap, drawHeatmap, randomPoints } from '@/utils/gis/leafletDemo'

const radius = ref(26)
const intensity = ref(1.2)
const pointCount = ref(3000)

let map: any = null
let L: any = null
let layer: any = null
let points: [number, number][] = []

function rebuild() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  const r = radius.value
  const k = intensity.value
  layer = createCanvasLayer(L, (c) => drawHeatmap(c, points, { radius: r, intensity: k }))
  layer.addTo(map)
}

function regen() {
  points = randomPoints(pointCount.value, [116.12, 39.68, 116.72, 40.12], 20261119)
  rebuild()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10 })
  points = randomPoints(pointCount.value, [116.12, 39.68, 116.72, 40.12], 20261119)
  rebuild()
  return () => {
    map?.remove()
    map = null
    layer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      热力图：Canvas 叠加层做灰度累积，再按色带逐像素着色；比 circleMarker 快一个量级，适合万级点位
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">半径 {{ radius }}</span>
      <el-slider class="max-w-28" :model-value="radius" :min="10" :max="60" :step="2" size="small" @input="(v) => { radius = Number(v); rebuild() }" />
      <span class="text-[12px] text-[#64748b]">强度 {{ intensity }}</span>
      <el-slider class="max-w-28" :model-value="intensity" :min="0.4" :max="2.5" :step="0.1" size="small" @input="(v) => { intensity = Number(v); rebuild() }" />
      <el-button size="small" type="primary" plain @click="regen">重新生成 {{ pointCount }} 点</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
