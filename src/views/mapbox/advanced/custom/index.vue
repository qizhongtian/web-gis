<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { clusterPoints, createGlowLayer, createMap, waitReady } from '@/utils/gis/glDemo'

const total = ref(30000)
const layerId = 'glow-points'
let map: any = null
let glib: any = null

function build() {
  if (!map) return
  map.removeLayer(layerId)
  const coords = clusterPoints(total.value, [121.4737, 31.2304], 0.22, 33 + (total.value % 7))
  map.addLayer(createGlowLayer(glib, coords, layerId))
}

async function init(lib: any, el: HTMLElement) {
  glib = lib
  map = createMap(lib, el, { base: 'dark', center: [121.4737, 31.2304], zoom: 9.8, pitch: 32, bearing: -12 })
  await waitReady(map)
  map.addLayer(createGlowLayer(lib, clusterPoints(total.value, [121.4737, 31.2304], 0.22, 33), layerId))

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
      自定义图层：CustomLayerInterface 暴露 WebGL 上下文与投影矩阵，可自行编译着色器绘制点云、飞线、粒子等内置图层做不到的效果
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">{{ total.toLocaleString() }} 点 · gl.POINTS</el-tag>
      <el-button size="small" @click="build">重新生成点云</el-button>
      <span>与 MapLibre 共用同一份着色器实现（glDemo.ts）</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
