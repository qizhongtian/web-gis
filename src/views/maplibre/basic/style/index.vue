<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { createMap, demoStyle, rasterStyle, waitReady, type GlBase } from '@/utils/gis/glDemo'

type Kind = 'vector' | GlBase

const options: { value: Kind; label: string }[] = [
  { value: 'vector', label: '矢量示例样式' },
  { value: 'light', label: '浅色栅格' },
  { value: 'dark', label: '深色栅格' },
  { value: 'imagery', label: 'Esri 影像' },
  { value: 'topo', label: 'Esri 地形' },
  { value: 'osm', label: 'OSM 街道' },
]

const kind = ref<Kind>('vector')
const label = computed(() => options.find((o) => o.value === kind.value)?.label ?? '')
let map: any = null

function styleOf(next: Kind) {
  return next === 'vector' ? demoStyle('maplibre') : rasterStyle(next)
}

function swap(next: Kind) {
  kind.value = next
  // setStyle 会整体替换图层；Marker / Popup 是 DOM 覆盖物，不受影响
  map?.setStyle(styleOf(next))
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { style: styleOf(kind.value), center: [116.4074, 39.9042], zoom: 9 })
  await waitReady(map)

  new lib.Marker({ color: '#f97316' })
    .setLngLat([116.4074, 39.9042])
    .setPopup(new lib.Popup({ offset: 18 }).setHTML('切换样式后，覆盖物仍然保留'))
    .addTo(map)

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      样式与底图：矢量样式由瓦片里的图层数据决定；栅格样式只需一条 raster source，两者可通过 setStyle 随时互换
    </p>
    <div class="flex items-center gap-2 flex-wrap text-[12px] text-[#64748b]">
      <el-radio-group v-model="kind" size="small" @change="swap as any">
        <el-radio-button v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</el-radio-button>
      </el-radio-group>
      <el-tag size="small">当前：{{ label }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
