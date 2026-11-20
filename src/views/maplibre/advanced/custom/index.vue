<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { clusterPoints, createGlowLayer, createMap, waitReady } from '@/utils/gis/glDemo'

const total = ref(30000)
const layerId = 'glow-points'
let map: any = null
let glib: any = null

function build() {
  if (!map) return
  map.removeLayer(layerId)
  const coords = clusterPoints(total.value, [116.4074, 39.9042], 0.22, 33 + (total.value % 7))
  map.addLayer(createGlowLayer(glib, coords, layerId))
}

async function init(lib: any, el: HTMLElement) {
  glib = lib
  map = createMap(lib, el, { base: 'dark', center: [116.4074, 39.9042], zoom: 9.8, pitch: 32, bearing: 12 })
  await waitReady(map)
  map.addLayer(createGlowLayer(lib, clusterPoints(total.value, [116.4074, 39.9042], 0.22, 33), layerId))

  return () => {
    map?.remove()
    map = null
    glib = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      自定义图层：CustomLayerInterface 直接拿到 WebGL 上下文与投影矩阵，自己编译着色器、画缓冲区，适合点云 / 轨迹 / 特效等场景
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">{{ total.toLocaleString() }} 点 · gl.POINTS</el-tag>
      <el-button size="small" @click="build">重新生成点云</el-button>
      <span>着色器代码见 src/utils/gis/glDemo.ts → createGlowLayer</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
