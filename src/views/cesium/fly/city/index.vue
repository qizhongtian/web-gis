<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

let C: any = null
let viewer: any = null

const routes = [
  { name: '起点 · 北京', lon: 116.407, lat: 39.904, h: 300000 },
  { name: '途经 · 武汉', lon: 114.305, lat: 30.593, h: 200000 },
  { name: '途经 · 长沙', lon: 112.938, lat: 28.228, h: 150000 },
  { name: '终点 · 广州', lon: 113.264, lat: 23.129, h: 100000 },
]

function flyTo(route: (typeof routes)[number], index: number) {
  viewer?.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(route.lon, route.lat, route.h),
    orientation: { heading: C.Math.toRadians(0), pitch: C.Math.toRadians(-45), roll: 0 },
    duration: 3 + index * 0.5,
    complete() {
      /* 可在此触发下一站 */
    },
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
    <p class="demo-hint">飞入：camera.flyTo 带缓动的相机漫游（可配 heading/pitch/duration）</p>
    <div class="flex gap-2 flex-wrap">
      <el-button v-for="(r, i) in routes" :key="r.name" size="small" type="primary" plain @click="flyTo(r, i)">
        {{ r.name }}
      </el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" />
  </div>
</template>
