<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, waitReady } from '@/utils/gis/glDemo'

const state = reactive({ zoom: 0, pitch: 0, bearing: 0 })
const pitch = ref(40)
const bearing = ref(0)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [121.4737, 31.2304], zoom: 10 })
  await waitReady(map)

  const sync = () => {
    state.zoom = map.getZoom()
    state.pitch = map.getPitch()
    state.bearing = map.getBearing()
    pitch.value = Math.round(state.pitch)
    bearing.value = Math.round(state.bearing)
  }
  map.on('move', sync)
  sync()

  return () => {
    map?.remove()
    map = null
  }
}

const flyShanghai = () => map?.flyTo({ center: [121.4737, 31.2304], zoom: 11, pitch: 55, bearing: -30, duration: 2000 })
const easeBeijing = () => map?.easeTo({ center: [116.4074, 39.9042], zoom: 9.5, duration: 1500 })
const fitDelta = () => map?.fitBounds([[120.9, 30.8], [122.1, 31.7]], { padding: 40, duration: 1200 })
const rotate = () => map?.rotateTo((map.getBearing() + 45) % 360, { duration: 800 })

function applyPitch(v: number) {
  pitch.value = v
  map?.easeTo({ pitch: v, duration: 150 })
}
function applyBearing(v: number) {
  bearing.value = v
  map?.easeTo({ bearing: v, duration: 150 })
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      相机动画：flyTo 支持曲线飞行与自动缩放，easeTo / jumpTo 分别对应平滑过渡与瞬时跳转，pitch、bearing、zoom 可组合出 3D 视角
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="flyShanghai">飞到上海</el-button>
      <el-button size="small" @click="easeBeijing">平滑到北京</el-button>
      <el-button size="small" @click="fitDelta">适配长三角</el-button>
      <el-button size="small" @click="rotate">旋转 +45°</el-button>
      <el-tag size="small" type="info">zoom {{ state.zoom.toFixed(1) }}</el-tag>
      <el-tag size="small" type="info">pitch {{ state.pitch.toFixed(0) }}°</el-tag>
      <el-tag size="small" type="info">bearing {{ state.bearing.toFixed(0) }}°</el-tag>
    </div>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <span class="flex items-center gap-2">俯仰
        <el-slider class="!w-36" :model-value="pitch" :min="0" :max="70" size="small" @input="applyPitch as any" />
      </span>
      <span class="flex items-center gap-2">方位
        <el-slider class="!w-36" :model-value="bearing" :min="-180" :max="180" size="small" @input="applyBearing as any" />
      </span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
