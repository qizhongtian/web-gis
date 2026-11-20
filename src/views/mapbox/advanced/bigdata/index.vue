<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, pointsFC, randomPoints, waitReady } from '@/utils/gis/glDemo'

const total = ref(60000)
const size = ref(2.2)
const genMs = ref(0)
const firstMs = ref(0)
let map: any = null

function applySize(v: number) {
  size.value = v
  map?.setPaintProperty('bigdata', 'circle-radius', v)
}

function regenerate() {
  if (!map) return
  total.value = 60000 + Math.floor(Math.random() * 20000)
  const t0 = performance.now()
  const data = pointsFC(randomPoints(total.value, undefined, 40 + Math.floor(Math.random() * 100)))
  genMs.value = performance.now() - t0
  const t1 = performance.now()
  map.getSource('bigdata').setData(data)
  firstMs.value = performance.now() - t1
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'dark', center: [121.4737, 31.2304], zoom: 9 })
  await waitReady(map)
  const t0 = performance.now()
  const data = pointsFC(randomPoints(total.value, undefined, 2026))
  genMs.value = performance.now() - t0

  map.addSource('bigdata', { type: 'geojson', data })
  map.addLayer({
    id: 'bigdata',
    type: 'circle',
    source: 'bigdata',
    paint: { 'circle-radius': size.value, 'circle-color': '#22d3ee', 'circle-opacity': 0.55 },
  })

  const t1 = performance.now()
  firstMs.value = performance.now() - t1

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      大数据渲染：GeoJSON 解析放到 worker，绘制走 GPU 合批，6 万点依然保持流畅；再往上就应改用矢量瓦片或自定义图层
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">{{ total.toLocaleString() }} 点</el-tag>
      <el-tag size="small">生成 {{ genMs.toFixed(1) }} ms</el-tag>
      <el-tag size="small">首帧 {{ firstMs.toFixed(0) }} ms</el-tag>
      <span class="flex items-center gap-2">点径 {{ size.toFixed(1) }}
        <el-slider class="!w-32" :model-value="size" :min="1" :max="6" :step="0.2" size="small" @input="applySize as any" />
      </span>
      <el-button size="small" @click="regenerate">重新生成</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
