<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { buildingsFC, createMap, waitReady } from '@/utils/gis/glDemo'

const mult = ref(1)
const opacity = ref(0.9)
let map: any = null

function applyHeight(v: number) {
  mult.value = v
  map?.setPaintProperty('buildings', 'fill-extrusion-height', ['*', ['get', 'height'], v])
}

function applyOpacity(v: number) {
  opacity.value = v
  map?.setPaintProperty('buildings', 'fill-extrusion-opacity', v)
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'light', center: [116.4074, 39.9042], zoom: 12.8, pitch: 55, bearing: -22 })
  await waitReady(map)

  map.addSource('buildings', { type: 'geojson', data: buildingsFC({ cols: 12, rows: 9 }) })
  map.addLayer({
    id: 'buildings',
    type: 'fill-extrusion',
    source: 'buildings',
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['get', 'height'],
        10,
        '#38bdf8',
        60,
        '#818cf8',
        120,
        '#f472b6',
      ],
      'fill-extrusion-height': ['*', ['get', 'height'], mult.value],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': opacity.value,
    },
  })

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      3D 建筑：fill-extrusion 用属性里的 height 拉伸成体块，颜色按高度插值；真实项目里换成矢量瓦片 building 图层即可
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <span class="flex items-center gap-2">高度倍数 {{ mult.toFixed(1) }}×
        <el-slider class="!w-36" :model-value="mult" :min="0.2" :max="3" :step="0.1" size="small" @input="applyHeight as any" />
      </span>
      <span class="flex items-center gap-2">不透明度
        <el-slider class="!w-36" :model-value="opacity" :min="0.2" :max="1" :step="0.05" size="small" @input="applyOpacity as any" />
      </span>
      <span>鼠标右键拖动可旋转视角</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
