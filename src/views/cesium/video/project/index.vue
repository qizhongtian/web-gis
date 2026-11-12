<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

/**
 * 视频融合（简化版）：
 * 生产实现通常用自定义 Material 将 Video 纹理投影到模型/地形（VideoProjectionMaterial），
 * 此处演示：视频播放 + 地面投影区域示意多边形 + 倾斜视角。
 */
async function init(Cesium: any, el: HTMLElement) {
  const viewer = createViewer(Cesium, el)

  // 投影区域（示意）
  viewer.entities.add({
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights([
        116.38, 39.9, 0, 116.41, 39.9, 0, 116.41, 39.92, 0, 116.38, 39.92, 0,
      ]),
      material: Cesium.Color.CYAN.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
    },
  })
  // 视频源位置
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(116.395, 39.91, 200),
    cylinder: {
      length: 200,
      topRadius: 0.5,
      bottomRadius: 30,
      material: Cesium.Color.ORANGE.withAlpha(0.6),
    },
  })
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.395, 39.88, 1800),
    orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35), roll: 0 },
    duration: 2,
  })

  return () => viewer.destroy()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">视频融合(简化)：视频纹理投影示意 —— 视频播放 + 地面投影范围 + 投影源</p>
    <div class="flex gap-2 items-start">
      <video
        class="w-64 rounded border border-[#e6e8eb]"
        src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        autoplay
        muted
        loop
        controls
      />
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" status />
  </div>
</template>
