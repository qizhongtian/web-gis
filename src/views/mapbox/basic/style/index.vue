<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, rasterStyle, waitReady, type GlBase } from '@/utils/gis/glDemo'

const options: { value: GlBase; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'imagery', label: 'Esri 影像' },
  { value: 'topo', label: 'Esri 地形' },
  { value: 'osm', label: 'OSM 街道' },
]

const kind = ref<GlBase>('light')
const label = computed(() => options.find((o) => o.value === kind.value)?.label ?? '')
let map: any = null

function swap(next: GlBase) {
  kind.value = next
  map?.setStyle(rasterStyle(next))
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { style: rasterStyle(kind.value), center: [116.4074, 39.9042], zoom: 9 })
  await waitReady(map)

  new lib.Marker({ color: '#f97316' })
    .setLngLat([116.4074, 39.9042])
    .setPopup(new lib.Popup({ offset: 18 }).setHTML('setStyle 后覆盖物仍然保留'))
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
      样式切换：Mapbox 的样式同样是 style.json，setStyle 会重建图层树；如需保留业务图层，可监听 styledata 事件重新挂载
    </p>
    <div class="flex items-center gap-2 flex-wrap text-[12px] text-[#64748b]">
      <el-radio-group v-model="kind" size="small" @change="swap as any">
        <el-radio-button v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</el-radio-button>
      </el-radio-group>
      <el-tag size="small">当前：{{ label }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
