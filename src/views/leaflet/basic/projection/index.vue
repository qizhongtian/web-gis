<script setup lang="ts">
import { ref } from 'vue'
import proj4 from 'proj4'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

/** CGCS2000 / 3-degree Gauss-Kruger CM 117E（北京一带），Leaflet 只认经纬度，这里做展示换算 */
const GK_DEF = '+proj=tmerc +lat_0=0 +lon_0=117 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'
proj4.defs('EPSG:4547', GK_DEF)

const lon = ref(116.4074)
const lat = ref(39.9042)
const mercator = ref('')
const gauss = ref('')

let map: any = null
let L: any = null
let marker: any = null

function convert() {
  const ll: [number, number] = [Number(lon.value), Number(lat.value)]
  const m = proj4('EPSG:4326', 'EPSG:3857', ll)
  const g = proj4('EPSG:4326', 'EPSG:4547', ll)
  mercator.value = `${m[0].toFixed(2)}, ${m[1].toFixed(2)}`
  gauss.value = `${g[0].toFixed(2)}, ${g[1].toFixed(2)}`
  if (map && marker) {
    marker.setLatLng(ll)
    map.panTo(ll, { animate: true })
  }
}

function onPick(e: any) {
  lon.value = Number(e.latlng.lng.toFixed(6))
  lat.value = Number(e.latlng.lat.toFixed(6))
  convert()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [Number(lat.value), Number(lon.value)], zoom: 11 })

  marker = L.marker([Number(lat.value), Number(lon.value)])
    .addTo(map)
    .bindTooltip('点击地图取点', { direction: 'top', offset: [0, -10] })

  // 临时拾取标记：十字虚线辅助定位
  const cross = L.layerGroup().addTo(map)
  map.on('mousemove', (e: any) => {
    cross.clearLayers()
    L.polyline(
      [
        [e.latlng.lat, e.latlng.lng - 0.05],
        [e.latlng.lat, e.latlng.lng + 0.05],
      ],
      { color: '#22d3ee', weight: 1, dashArray: '4 6', opacity: 0.7 },
    ).addTo(cross)
  })
  map.on('click', onPick)

  convert()

  return () => {
    map?.off('click', onPick)
    map?.remove()
    map = null
    marker = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      坐标系：Leaflet 内部统一用 WGS84 经纬度，投影坐标只是展示；EPSG:3857 与 CGCS2000 高斯投影由 proj4 换算
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">经度</span>
      <el-input-number v-model="lon" size="small" :precision="6" :step="0.001" controls-position="right" class="!w-32" />
      <span class="text-[12px] text-[#64748b]">纬度</span>
      <el-input-number v-model="lat" size="small" :precision="6" :step="0.001" controls-position="right" class="!w-32" />
      <el-button size="small" type="primary" @click="convert">换算</el-button>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="plain" type="info">WGS84 {{ lon }}, {{ lat }}</el-tag>
      <el-tag size="small" effect="plain">3857 {{ mercator }}</el-tag>
      <el-tag size="small" effect="plain" type="warning">4547 {{ gauss }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
