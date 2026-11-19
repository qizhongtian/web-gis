<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const presets: Record<string, { url: string; attribution: string }> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri World Imagery',
  },
  light: { url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '&copy; CARTO' },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri Topo',
  },
}

const preset = ref<keyof typeof presets>('osm')
const opacity = ref(1)
let map: any = null
let ol: any = null
let layer: any = null

function build(kind: keyof typeof presets) {
  const item = presets[kind]
  return new ol.TileLayer({
    opacity: opacity.value,
    source: new ol.XYZ({
      url: item.url,
      attributions: item.attribution,
      crossOrigin: 'anonymous',
      maxZoom: 19,
    }),
  })
}

function change(kind: any) {
  preset.value = kind
  if (!map) return
  layer = build(kind)
  map.getLayers().setAt(0, layer)
}

function applyOpacity(value: any) {
  opacity.value = value
  layer?.setOpacity(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  layer = build(preset.value)
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10, base: 'none', layers: [layer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">XYZ：最通用的切片协议 {z}/{x}/{y}，可接天地图、ArcGIS、CARTO 等任意切片服务</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-radio-group v-model="preset" size="small" @change="change as any">
        <el-radio-button value="osm">OSM</el-radio-button>
        <el-radio-button value="light">CARTO</el-radio-button>
        <el-radio-button value="imagery">影像</el-radio-button>
        <el-radio-button value="topo">地形</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="applyOpacity" />
    </div>
    <el-tag class="w-fit max-w-full" size="small" type="info" effect="plain">{{ presets[preset].url }}</el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
