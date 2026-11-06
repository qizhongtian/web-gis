<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer, pickSurface, toLonLatHeight } from '@/utils/gis/cesiumInit'

/**
 * 综合应用：底图 + GeoJSON + 动态实体 + 点击拾取 + 自动漫游
 */
const pickInfo = ref('点击地图任意位置试试')
let C: any = null
let viewer: any = null
let handler: any = null

const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '作业区' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[116.3, 39.95], [116.5, 39.95], [116.5, 39.83], [116.3, 39.83], [116.3, 39.95]]],
      },
    },
  ],
}

async function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  viewer = createViewer(Cesium, el)

  const ds = await C.GeoJsonDataSource.load(geojson, {
    stroke: C.Color.CYAN,
    fill: C.Color.fromCssColorString('#22d3ee33'),
    clampToGround: true,
  })
  viewer.dataSources.add(ds)

  // 随机设备点位
  for (let i = 0; i < 30; i++) {
    const lon = 116.3 + Math.random() * 0.2
    const lat = 39.83 + Math.random() * 0.12
    viewer.entities.add({
      position: C.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 8, color: C.Color.LIME },
      label: {
        text: `DEV-${String(i).padStart(2, '0')}`,
        font: '12px sans-serif',
        pixelOffset: { x: 0, y: -16 },
        fillColor: C.Color.WHITE,
      },
    })
  }

  handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: any) => {
    const cartesian = pickSurface(C, viewer, movement.position)
    if (!cartesian) return
    const [lon, lat, h] = toLonLatHeight(C, cartesian)
    pickInfo.value = `${lon.toFixed(5)}°, ${lat.toFixed(5)}°, ${h.toFixed(0)}m`
  }, C.ScreenSpaceEventType.LEFT_CLICK)

  await viewer.zoomTo(ds)
  return () => {
    handler?.destroy()
    viewer.destroy()
    viewer = null
  }
}

onBeforeUnmount(() => {
  handler?.destroy()
})
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">综合应用：GeoJSON + 实体标注 + 坐标拾取 + 相机定位的组合示例</p>
    <el-tag effect="dark" class="w-fit" type="info">{{ pickInfo }}</el-tag>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" />
  </div>
</template>
