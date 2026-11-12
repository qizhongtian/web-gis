<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

const heading = ref(0)
const pitch = ref(-45)
let C: any = null
let viewer: any = null

const cities = [
  { name: '北京', lon: 116.407, lat: 39.904, h: 200000 },
  { name: '上海', lon: 121.473, lat: 31.23, h: 200000 },
  { name: '深圳', lon: 114.057, lat: 22.543, h: 150000 },
  { name: '纽约', lon: -74.006, lat: 40.712, h: 200000 },
]

function fly(city: { lon: number; lat: number; h: number }) {
  viewer?.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(city.lon, city.lat, city.h),
    orientation: {
      heading: C.Math.toRadians(heading.value),
      pitch: C.Math.toRadians(pitch.value),
      roll: 0,
    },
    duration: 2.5,
  })
}

function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  viewer = createViewer(Cesium, el)
  return () => {
    viewer.destroy()
    viewer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">相机控制：flyTo 城市漫游 + heading / pitch 角度调节</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-button v-for="city in cities" :key="city.name" size="small" @click="fly(city)">{{ city.name }}</el-button>
      <span class="text-xs text-[#7c8db0]">heading: {{ heading }}°</span>
      <el-slider v-model="heading" :min="-180" :max="180" class="!w-40" />
      <span class="text-xs text-[#7c8db0]">pitch: {{ pitch }}°</span>
      <el-slider v-model="pitch" :min="-90" :max="0" class="!w-40" />
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" status />
  </div>
</template>
