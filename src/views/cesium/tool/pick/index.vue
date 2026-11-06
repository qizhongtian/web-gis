<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer, pickSurface, toLonLatHeight } from '@/utils/gis/cesiumInit'

const result = ref('')
let C: any = null
let viewer: any = null
let handler: any = null

function onClick(movement: any) {
  const cartesian = pickSurface(C, viewer, movement.position)
  if (!cartesian) return
  const [lon, lat, h] = toLonLatHeight(C, cartesian)
  result.value = `经度: ${lon.toFixed(6)}°  纬度: ${lat.toFixed(6)}°  高程: ${h.toFixed(1)}m`
  viewer.entities.add({
    position: cartesian,
    point: { pixelSize: 10, color: C.Color.LIME, outlineColor: C.Color.BLACK, outlineWidth: 1 },
  })
}

function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  viewer = createViewer(Cesium, el)
  handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK)
  return () => {
    handler?.destroy()
    viewer.destroy()
    viewer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">坐标拾取：点击地球表面，拾取经纬度与高程</p>
    <el-tag v-if="result" type="success" effect="dark" class="w-fit">{{ result }}</el-tag>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" />
  </div>
</template>
