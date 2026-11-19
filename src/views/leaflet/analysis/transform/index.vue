<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

const lon = ref(116.4074)
const lat = ref(39.9042)
const gcj = ref('')
const bd = ref('')
const offset = ref('')

let map: any = null
let L: any = null
let group: any = null

const PI = Math.PI
const A = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(lng: number, la: number) {
  return lng < 72.004 || lng > 137.8347 || la < 0.8293 || la > 55.8271
}

function transformLat(x: number, y: number) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3
  return ret
}

function transformLng(x: number, y: number) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3
  return ret
}

/** WGS84 → GCJ-02（国测局火星坐标） */
function wgs84ToGcj(lng: number, la: number): [number, number] {
  if (outOfChina(lng, la)) return [lng, la]
  let dLat = transformLat(lng - 105, la - 35)
  let dLng = transformLng(lng - 105, la - 35)
  const radLat = (la / 180) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return [lng + dLng, la + dLat]
}

/** GCJ-02 → BD-09（百度坐标） */
function gcjToBd(lng: number, la: number): [number, number] {
  const x = lng
  const y = la
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * PI * 3000)
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * PI * 3000)
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006]
}

function convert() {
  const [gLng, gLat] = wgs84ToGcj(Number(lon.value), Number(lat.value))
  const [bLng, bLat] = gcjToBd(gLng, gLat)
  gcj.value = `${gLng.toFixed(6)}, ${gLat.toFixed(6)}`
  bd.value = `${bLng.toFixed(6)}, ${bLat.toFixed(6)}`

  if (!map) return
  group.clearLayers()
  const wgs: [number, number] = [Number(lat.value), Number(lon.value)]
  const gcjLL: [number, number] = [gLat, gLng]

  L.circleMarker(wgs, { radius: 7, color: '#fff', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 })
    .addTo(group)
    .bindTooltip('WGS84 原始坐标', { direction: 'top', offset: [0, -8] })
  L.circleMarker(gcjLL, { radius: 7, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 })
    .addTo(group)
    .bindTooltip('GCJ-02 加密坐标', { direction: 'top', offset: [0, -8] })
  L.polyline([wgs, gcjLL], { color: '#f97316', weight: 2, dashArray: '4 4' }).addTo(group)

  offset.value = formatDistance(map.distance(wgs, gcjLL))
  map.setView(wgs, Math.max(map.getZoom(), 15))
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [Number(lat.value), Number(lon.value)], zoom: 15 })
  group = L.layerGroup().addTo(map)
  convert()
  return () => {
    map?.remove()
    map = null
    group = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      坐标转换：WGS84 → GCJ-02（火星坐标）→ BD-09，高德/腾讯用 GCJ-02、百度用 BD-09，混用会整体偏移
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">经度</span>
      <el-input-number v-model="lon" size="small" :precision="6" :step="0.001" controls-position="right" class="!w-32" />
      <span class="text-[12px] text-[#64748b]">纬度</span>
      <el-input-number v-model="lat" size="small" :precision="6" :step="0.001" controls-position="right" class="!w-32" />
      <el-button size="small" type="primary" @click="convert">转换</el-button>
      <el-tag v-if="offset" size="small" effect="plain" type="warning">偏移 {{ offset }}</el-tag>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="plain" type="info">GCJ-02 {{ gcj }}</el-tag>
      <el-tag size="small" effect="plain" type="success">BD-09 {{ bd }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
