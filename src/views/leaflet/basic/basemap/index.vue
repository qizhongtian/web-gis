<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createBaseLayer } from '@/utils/gis/leafletDemo'

type Kind = 'osm' | 'imagery' | 'light' | 'topo' | 'dark'

const options: { value: Kind; label: string }[] = [
  { value: 'osm', label: 'OSM 街道' },
  { value: 'imagery', label: 'Esri 影像' },
  { value: 'light', label: '浅色底图' },
  { value: 'dark', label: '深色底图' },
  { value: 'topo', label: 'Esri 地形' },
]

const kind = ref<Kind>('osm')
const opacity = ref(1)
let L: any = null
let map: any = null
let base: any = null

function swap(next: Kind) {
  kind.value = next
  if (!map) return
  if (base) map.removeLayer(base)
  base = createBaseLayer(L, next)
  base.setOpacity(opacity.value)
  base.addTo(map)
  // 底图铺到最底层，避免盖住叠加要素
  base.bringToBack()
}

function setOpacity(value: any) {
  opacity.value = Number(value)
  base?.setOpacity(opacity.value)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = L.map(el, { zoomControl: true }).setView([39.9042, 116.4074], 10)
  L.control.scale({ imperial: false }).addTo(map)

  base = createBaseLayer(L, kind.value)
  base.addTo(map)

  L.marker([39.9042, 116.4074]).bindPopup('底图切换不影响叠加要素').addTo(map)
  L.circle([39.9042, 116.4074], {
    radius: 12000,
    color: '#22d3ee',
    weight: 2,
    fillColor: '#22d3ee',
    fillOpacity: 0.12,
  }).addTo(map)

  return () => {
    map?.remove()
    map = null
    base = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">底图切换：L.tileLayer 换 URL 即可，注意 bringToBack 保持底图在叠加层之下</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-radio-group v-model="kind" size="small" @change="swap as any">
        <el-radio-button v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">不透明度</span>
      <el-slider class="max-w-36" :model-value="opacity" :min="0.2" :max="1" :step="0.1" size="small" @input="setOpacity" />
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
