<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const layerName = ref('OSM-WMS')
const opacity = ref(0.85)
const visible = ref(true)
let wmsLayer: any = null

function applyLayers(value: any) {
  layerName.value = value
  wmsLayer?.getSource().updateParams({ LAYERS: value })
}

function applyOpacity(value: any) {
  opacity.value = value
  wmsLayer?.setOpacity(value)
}

function toggle(value: any) {
  visible.value = Boolean(value)
  wmsLayer?.setVisible(visible.value)
}

async function init(lib: any, el: HTMLElement) {
  const source = new lib.TileWMS({
    url: 'https://ows.terrestris.de/osm/service?',
    params: { LAYERS: layerName.value, TILED: true },
    serverType: 'geoserver',
    crossOrigin: 'anonymous',
  })
  wmsLayer = new lib.TileLayer({ source, opacity: opacity.value })
  const map = createDemoMap(lib, el, { center: [8, 48], zoom: 5, base: 'none', layers: [wmsLayer] })
  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">WMS：TileWMS 按 GetMap 请求出图，updateParams 可切换 LAYERS，适合对接 GeoServer / MapServer</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-select v-model="layerName" size="small" class="w-40" @change="applyLayers as any">
        <el-option label="OSM-WMS（底图）" value="OSM-WMS" />
        <el-option label="OSM-Overlay-WMS（叠加）" value="OSM-Overlay-WMS" />
      </el-select>
      <el-checkbox :model-value="visible" size="small" @change="toggle as any">显示</el-checkbox>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="applyOpacity" />
    </div>
    <el-tag class="w-fit max-w-full" size="small" type="info" effect="plain">
      GET /osm/service?SERVICE=WMS&amp;REQUEST=GetMap&amp;LAYERS={{ layerName }}
    </el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
