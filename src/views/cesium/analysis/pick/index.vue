<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer, pickSurface, toLonLatHeight } from '@/utils/gis/cesiumInit'

const info = ref('')
let C: any = null
let viewer: any = null
let handler: any = null
let pointA: any = null

function onClick(movement: any) {
  const cartesian = pickSurface(C, viewer, movement.position)
  if (!cartesian) return
  const [lon, lat, h] = toLonLatHeight(C, cartesian)

  viewer.entities.add({
    position: cartesian,
    point: { pixelSize: 10, color: C.Color.ORANGE },
  })

  if (!pointA) {
    pointA = cartesian
    info.value = `A 点: ${lon.toFixed(4)}°, ${lat.toFixed(4)}°, ${h.toFixed(0)}m（请再点选 B 点）`
  } else {
    const dist = C.Cartesian3.distance(pointA, cartesian)
    viewer.entities.add({
      polyline: {
        positions: [pointA, cartesian],
        width: 3,
        material: new C.PolylineDashMaterialProperty({ color: C.Color.LIME }),
      },
    })
    info.value = `A→B 通视连线距离: ${(dist / 1000).toFixed(2)} km（再点重置 A 点）`
    pointA = null
  }
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
    <p class="demo-hint">空间分析(简化)：两点通视连线与直线距离（生产中可扩展地形遮挡分析）</p>
    <el-tag v-if="info" type="warning" effect="dark" class="w-fit">{{ info }}</el-tag>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" status />
  </div>
</template>
