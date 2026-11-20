<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, rasterStyle, waitReady } from '@/utils/gis/glDemo'

const opacity = ref(0.9)
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
  map = createMap(lib, el, { style: rasterStyle('imagery'), center: [121.4737, 31.2304], zoom: 10.6 })
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
      栅格图层：用非 mapbox:// 的瓦片地址即可免 token 使用，raster-opacity / raster-fade-duration 等都是 paint 属性
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-checkbox v-model="show" @change="toggle(show)">显示底图</el-checkbox>
      <span class="flex items-center gap-2">透明度
        <el-slider class="!w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="setOpacity as any" />
      </span>
      <el-tag size="small">Esri World Imagery</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
