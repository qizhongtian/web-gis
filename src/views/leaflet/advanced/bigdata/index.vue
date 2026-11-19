<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createCanvasLayer, createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const total = ref(120000)
const cost = ref(0)
const zoom = ref(10)

let map: any = null
let L: any = null
let layer: any = null
let points: [number, number][] = []

function rebuild() {
  if (!map) return
  if (layer) map.removeLayer(layer)

  layer = createCanvasLayer(L, (c) => {
    const { ctx, map: m, size } = c
    const t0 = performance.now()
    const img = ctx.createImageData(size.x, size.y)
    const buf = img.data

    for (const ll of points) {
      const p = m.latLngToContainerPoint(ll)
      const x = p.x | 0
      const y = p.y | 0
      if (x < 0 || y < 0 || x >= size.x || y >= size.y) continue
      // 直接写像素：亮度随叠加次数提升，形成类似密度的观感
      const i = (y * size.x + x) * 4
      buf[i] = 34
      buf[i + 1] = Math.min(255, 211 + buf[i + 1])
      buf[i + 2] = 238
      buf[i + 3] = Math.min(255, buf[i + 3] + 42)
    }
    ctx.putImageData(img, 0, 0)
    cost.value = Number((performance.now() - t0).toFixed(1))
    zoom.value = m.getZoom()
  })
  layer.addTo(map)
}

function regen() {
  points = randomPoints(total.value, [116.05, 39.6, 116.8, 40.2], 120120)
  rebuild()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10, base: 'dark' })
  points = randomPoints(total.value, [116.05, 39.6, 116.8, 40.2], 120120)
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
      大数据渲染：十几万点不建要素，直接往 ImageData 里写像素再 putImageData，按需对视口裁剪
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">点数 {{ total }}</span>
      <el-slider class="max-w-40" :model-value="total" :min="20000" :max="300000" :step="20000" size="small" @input="(v) => { total = Number(v); regen() }" />
      <el-button size="small" type="primary" plain @click="regen">重新生成</el-button>
      <el-tag size="small" effect="plain" type="info">zoom {{ zoom }}</el-tag>
      <el-tag size="small" effect="plain" type="success">绘制 {{ cost }}ms</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
