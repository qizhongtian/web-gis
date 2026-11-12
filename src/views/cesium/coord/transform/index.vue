<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

const lon = ref(116.391)
const lat = ref(39.907)
const height = ref(100)

let C: any = null

/** WGS84 经纬度（度） -> ECEF 笛卡尔坐标 */
const cartesian = computed(() => {
  if (!C) return { x: 0, y: 0, z: 0 }
  const c = C.Cartesian3.fromDegrees(lon.value, lat.value, height.value)
  return { x: c.x, y: c.y, z: c.z }
})

/** 笛卡尔 -> 经纬度（度） */
const back = computed(() => {
  if (!C || !cartesian.value.x) return { lon: 0, lat: 0, h: 0 }
  const c = C.Cartographic.fromCartesian(
    new C.Cartesian3(cartesian.value.x, cartesian.value.y, cartesian.value.z),
  )
  return {
    lon: C.Math.toDegrees(c.longitude),
    lat: C.Math.toDegrees(c.latitude),
    h: c.height,
  }
})

async function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  const viewer = createViewer(Cesium, el)
  // 标记当前输入坐标位置
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon.value, lat.value, height.value),
    point: { pixelSize: 12, color: Cesium.Color.RED },
  })
  return () => viewer.destroy()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">坐标转换：WGS84 经纬度 ↔ 笛卡尔（ECEF）双向转换</p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[#7c8db0]">
      <div class="tech-panel p-3 flex items-center gap-2">
        经度 <el-input-number v-model="lon" :precision="6" size="small" /> 纬度
        <el-input-number v-model="lat" :precision="6" size="small" />
      </div>
      <div class="tech-panel p-3">
        笛卡尔: X={{ cartesian.x.toFixed(2) }}, Y={{ cartesian.y.toFixed(2) }}, Z={{ cartesian.z.toFixed(2) }}
      </div>
      <div class="tech-panel p-3">
        反算: {{ back.lon.toFixed(6) }}°, {{ back.lat.toFixed(6) }}°, {{ back.h.toFixed(2) }}m
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" status />
  </div>
</template>
