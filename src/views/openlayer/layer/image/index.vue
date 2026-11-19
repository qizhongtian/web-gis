<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createCanvasImage, createDemoMap } from '@/utils/gis/olDemo'

const opacity = ref(0.85)
const extentText = ref('')
let map: any = null
let imageLayer: any = null

function changeOpacity(value: number) {
  opacity.value = value
  imageLayer?.setOpacity(value)
}

async function init(lib: any, el: HTMLElement) {
  const extent = lib.transformExtent([116.15, 39.72, 116.66, 40.12], 'EPSG:4326', 'EPSG:3857')
  extentText.value = '116.15 ~ 116.66E · 39.72 ~ 40.12N'
  imageLayer = new lib.ImageLayer({
    opacity: opacity.value,
    source: new lib.ImageStatic({
      url: createCanvasImage(),
      imageExtent: extent,
      projection: 'EPSG:3857',
    }),
  })
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10, base: 'light', layers: [imageLayer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">ImageLayer：ImageStatic 把一张图片按 imageExtent 拉伸到地图坐标范围，适合单张影像 / 平面图</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-tag size="small" effect="plain">图片范围：{{ extentText }}</el-tag>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="changeOpacity as any" />
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
