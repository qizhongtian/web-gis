<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const lon = ref(116.407)
const lat = ref(39.904)
const mercator = ref('')
const gauss = ref('')

let map: any = null
let ol: any = null
let marker: any = null

/** EPSG:4547 = CGCS2000 / 3-degree Gauss-Kruger CM 117E，用 proj4 注册后即可与 EPSG:4326 互转 */
const GK_DEF = '+proj=tmerc +lat_0=0 +lon_0=117 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'

function convert() {
  if (!ol) return
  const coord = ol.fromLonLat([Number(lon.value), Number(lat.value)])
  mercator.value = `${coord[0].toFixed(2)}, ${coord[1].toFixed(2)}`
  const gk = ol.transform([Number(lon.value), Number(lat.value)], 'EPSG:4326', 'EPSG:4547')
  gauss.value = `${gk[0].toFixed(2)}, ${gk[1].toFixed(2)}`
  marker?.getGeometry()?.setCoordinates(coord)
  map?.getView().animate({ center: coord, zoom: 12, duration: 500 })
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  lib.proj4.defs('EPSG:4547', GK_DEF)
  lib.registerProj4(lib.proj4)

  marker = new lib.Feature({ geometry: new lib.Point(lib.fromLonLat([Number(lon.value), Number(lat.value)])) })
  const layer = new lib.VectorLayer({
    source: new lib.VectorSource({ features: [marker] }),
    style: new lib.Style({
      image: new lib.CircleStyle({
        radius: 8,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, { center: [Number(lon.value), Number(lat.value)], zoom: 11, layers: [layer] })
  convert()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      坐标系：经纬度 EPSG:4326 与 Web 墨卡托 EPSG:3857 由 ol/proj 转换；CGCS2000 高斯投影 EPSG:4547 通过 proj4 注册
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[12px] text-[#64748b]">经度</span>
      <el-input-number v-model="lon" size="small" :precision="6" :step="0.1" controls-position="right" />
      <span class="text-[12px] text-[#64748b]">纬度</span>
      <el-input-number v-model="lat" size="small" :precision="6" :step="0.1" controls-position="right" />
      <el-button size="small" type="primary" @click="convert">转换并定位</el-button>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" effect="plain">EPSG:3857 · {{ mercator }}</el-tag>
      <el-tag size="small" type="success" effect="plain">EPSG:4547 · {{ gauss }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
