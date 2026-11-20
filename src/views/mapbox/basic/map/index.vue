<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, waitReady } from '@/utils/gis/glDemo'

const state = reactive({ lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0, version: '' })
const loaded = ref(false)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  state.version = lib.version ?? ''
  map = createMap(lib, el, {
    // 官方 mapbox:// 样式需要 accessToken，这里用免 Key 的 Esri 浅色栅格样式
    base: 'light',
    center: [116.4074, 39.9042],
    zoom: 9.4,
    pitch: 30,
  })
  await waitReady(map)
  loaded.value = true

  new lib.Marker({ color: '#2563eb' })
    .setLngLat([116.4074, 39.9042])
    .setPopup(new lib.Popup({ offset: 18 }).setHTML('<b>北京</b><br/>Mapbox GL JS 示例'))
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

  return () => {
    map?.remove()
    map = null
    loaded.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      Mapbox GL JS 与 MapLibre 同源，API 几乎完全一致；差异在于官方样式、瓦片、地理编码等服务需要 accessToken
    </p>
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="success">v{{ state.version }}</el-tag>
      <el-tag size="small" type="warning">免 Key 栅格样式</el-tag>
      <span>中心 {{ state.lng.toFixed(3) }}, {{ state.lat.toFixed(3) }}</span>
      <span>层级 {{ state.zoom.toFixed(2) }}</span>
      <span>俯仰 {{ state.pitch.toFixed(0) }}°</span>
      <span>方位 {{ state.bearing.toFixed(0) }}°</span>
      <el-tag v-if="!loaded" size="small" type="info">样式加载中</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
