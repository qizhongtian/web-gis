<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const renderer = ref<'canvas' | 'svg'>('canvas')
const pointCount = ref(4000)
const cost = ref(0)

let map: any = null
let L: any = null
let layer: any = null
let points: [number, number][] = []

function draw() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  points = randomPoints(pointCount.value, [116.1, 39.66, 116.74, 40.14], 4004)

  const t0 = performance.now()
  const target = renderer.value === 'canvas' ? L.canvas({ padding: 0.5 }) : L.svg({ padding: 0.5 })
  layer = L.layerGroup(
    points.map((p) =>
      L.circleMarker(p, {
        renderer: target,
        radius: 3,
        stroke: false,
        fillColor: '#22d3ee',
        fillOpacity: 0.7,
      }),
    ),
  ).addTo(map)
  cost.value = Number((performance.now() - t0).toFixed(1))
}

function setRenderer(value: any) {
  renderer.value = value
  draw()
}

function setCount(value: any) {
  pointCount.value = Number(value)
  draw()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10, base: 'dark' })
  draw()
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
      Canvas 渲染器：矢量要素默认走 SVG（每个要素一个 DOM 节点），改用 L.canvas 后合并绘制，数量一多差距明显
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-radio-group v-model="renderer" size="small" @change="setRenderer as any">
        <el-radio-button value="canvas">Canvas</el-radio-button>
        <el-radio-button value="svg">SVG</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">要素 {{ pointCount }}</span>
      <el-slider class="max-w-40" :model-value="pointCount" :min="500" :max="10000" :step="500" size="small" @input="setCount" />
      <el-tag size="small" effect="plain" type="success">创建耗时 {{ cost }}ms</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
