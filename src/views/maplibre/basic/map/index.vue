<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { createMap, waitReady } from '@/utils/gis/glDemo'

const state = reactive({ lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0, version: '' })
const loaded = ref(false)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  state.version = lib.getVersion ? lib.getVersion() : lib.version
  map = createMap(lib, el, {
    // MapLibre 官方免 Key 矢量示例样式（含国界与地名）
    style: 'https://demotiles.maplibre.org/style.json',
    center: [104.2, 35.6],
    zoom: 2.6,
  })
  await waitReady(map)
  loaded.value = true

  new lib.Marker({ color: '#22d3ee' })
    .setLngLat([116.4074, 39.9042])
    .setPopup(new lib.Popup({ offset: 18 }).setHTML('<b>北京</b><br/>116.4074, 39.9042'))
    .addTo(map)

  const sync = () => {
    const c = map.getCenter()
    state.lng = c.lng
    state.lat = c.lat
    state.zoom = map.getZoom()
    state.pitch = map.getPitch()
    state.bearing = map.getBearing()
  }
  map.on('move', sync)
  sync()
  map.flyTo({ center: [116.4074, 39.9042], zoom: 8.6, duration: 2200 })

  return () => {
    map?.remove()
    map = null
    loaded.value = false
  }
}

function reset() {
  map?.flyTo({ center: [104.2, 35.6], zoom: 2.6, pitch: 0, bearing: 0, duration: 1200 })
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      MapLibre GL JS 基于 WebGL 的矢量瓦片渲染，「样式即地图」：换一个 style.json 就换掉整套配色、图层与交互
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="success">v{{ state.version }}</el-tag>
      <span>中心 {{ state.lng.toFixed(3) }}, {{ state.lat.toFixed(3) }}</span>
      <span>层级 {{ state.zoom.toFixed(2) }}</span>
      <span>俯仰 {{ state.pitch.toFixed(0) }}°</span>
      <span>方位 {{ state.bearing.toFixed(0) }}°</span>
      <el-tag v-if="!loaded" size="small" type="warning">样式加载中</el-tag>
      <el-button size="small" @click="reset">复位视角</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
