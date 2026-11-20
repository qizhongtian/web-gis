<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { createMap, waitReady } from '@/utils/gis/glDemo'

const state = reactive({ zoom: 0, pitch: 0, bearing: 0 })
const pitch = ref(45)
const bearing = ref(-20)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [116.4074, 39.9042], zoom: 9.6 })
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

const flyBeijing = () => map?.flyTo({ center: [116.4074, 39.9042], zoom: 10.5, pitch: 50, bearing: -25, duration: 2000 })
const easeShanghai = () => map?.easeTo({ center: [121.4737, 31.2304], zoom: 9.5, duration: 1500 })
const jumpShenzhen = () => map?.jumpTo({ center: [114.0579, 22.5431], zoom: 10 })
const fitChina = () => map?.fitBounds([[73, 18], [135, 54]], { padding: 40, duration: 1600 })
const rotate = () => map?.rotateTo((map.getBearing() + 45) % 360, { duration: 800 })

function applyPitch(v: number) {
  pitch.value = v
  map?.easeTo({ pitch: v, duration: 200 })
}
function applyBearing(v: number) {
  bearing.value = v
  map?.easeTo({ bearing: v, duration: 200 })
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      相机控制：jumpTo 立即跳转、easeTo 平滑过渡、flyTo 带抛物线飞行、fitBounds 自动适配范围，pitch / bearing 决定 3D 视角
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="flyBeijing">飞到北京</el-button>
      <el-button size="small" @click="easeShanghai">平滑到上海</el-button>
      <el-button size="small" @click="jumpShenzhen">跳转深圳</el-button>
      <el-button size="small" @click="fitChina">适配全国范围</el-button>
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
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
