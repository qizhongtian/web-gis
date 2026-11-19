<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const SERVICE = 'https://ows.terrestris.de/osm/service?'

const layers = [
  { value: 'OSM-WMS', label: 'OSM-WMS（可作为底图）' },
  { value: 'OSM-Overlay-WMS', label: 'OSM-Overlay-WMS（叠加）' },
]

const layerName = ref('OSM-Overlay-WMS')
const opacity = ref(0.9)
const visible = ref(true)

let map: any = null
let L: any = null
let wms: any = null

function rebuild() {
  if (!map) return
  if (wms) map.removeLayer(wms)
  wms = createWms(layerName.value)
  if (visible.value) wms.addTo(map)
}

function createWms(name: string) {
  return L.tileLayer.wms(SERVICE, {
    layers: name,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    opacity: opacity.value,
    attribution: 'terrestris OSM-WMS',
  })
}

function setOpacity(value: any) {
  opacity.value = Number(value)
  wms?.setOpacity(opacity.value)
}

function toggle(value: any) {
  visible.value = Boolean(value)
  if (!map) return
  visible.value ? wms.addTo(map) : map.removeLayer(wms)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(L, el, { center: [48, 8], zoom: 5, base: 'imagery' })
  wms = createWms(layerName.value)
  wms.addTo(map)
  return () => {
    map?.remove()
    map = null
    wms = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">WMS：L.tileLayer.wms 按 GetMap 请求出图，切 LAYERS 参数即可换图层，适合对接 GeoServer / MapServer</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-select v-model="layerName" size="small" class="w-56" @change="rebuild">
        <el-option v-for="l in layers" :key="l.value" :label="l.label" :value="l.value" />
      </el-select>
      <el-checkbox :model-value="visible" size="small" @change="toggle as any">显示</el-checkbox>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-36" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="setOpacity" />
    </div>
    <el-tag class="w-fit max-w-full" size="small" type="info" effect="plain">
      GetMap?SERVICE=WMS&amp;VERSION=1.1.1&amp;LAYERS={{ layerName }}&amp;FORMAT=image/png&amp;TRANSPARENT=true
    </el-tag>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
