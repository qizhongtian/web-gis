<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { createMap, rasterStyle, waitReady } from '@/utils/gis/glDemo'

const opacity = ref(0.85)
const show = ref(true)
let map: any = null

function setOpacity(v: number) {
  opacity.value = v
  map?.setPaintProperty('base', 'raster-opacity', v)
}

function toggle(v: boolean) {
  show.value = v
  map?.setLayoutProperty('base', 'visibility', v ? 'visible' : 'none')
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, {
    style: rasterStyle('imagery'),
    center: [116.4074, 39.9042],
    zoom: 10.4,
  })
  await waitReady(map)
  map.setPaintProperty('base', 'raster-opacity', opacity.value)

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      栅格图层：raster source 只需瓦片地址模板，maxzoom / tileSize / attribution 由 source 声明，透明度是 paint 属性
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-checkbox v-model="show" @change="toggle(show)">显示底图</el-checkbox>
      <span class="flex items-center gap-2">透明度
        <el-slider class="!w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="setOpacity as any" />
      </span>
      <el-tag size="small">World_Imagery · maxzoom 19</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
