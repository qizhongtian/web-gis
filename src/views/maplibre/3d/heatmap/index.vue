<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { clusterPoints, createMap, pointsFC, waitReady } from '@/utils/gis/glDemo'

const radius = ref(26)
const intensity = ref(1.2)
const mode = ref<'heat' | 'point'>('heat')
let map: any = null

function applyRadius(v: number) {
  radius.value = v
  map?.setPaintProperty('heat', 'heatmap-radius', v)
}

function applyIntensity(v: number) {
  intensity.value = v
  map?.setPaintProperty('heat', 'heatmap-intensity', v)
}

function switchMode(next: 'heat' | 'point') {
  mode.value = next
  map?.setLayoutProperty('heat', 'visibility', next === 'heat' ? 'visible' : 'none')
  map?.setLayoutProperty('pts', 'visibility', next === 'point' ? 'visible' : 'none')
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'dark', center: [116.4074, 39.9042], zoom: 10 })
  await waitReady(map)
  const data = pointsFC(clusterPoints(6000, [116.4074, 39.9042], 0.16, 17))

  map.addSource('events', { type: 'geojson', data })
  map.addLayer({
    id: 'heat',
    type: 'heatmap',
    source: 'events',
    paint: {
      'heatmap-radius': radius.value,
      'heatmap-intensity': intensity.value,
      'heatmap-opacity': 0.9,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(15, 23, 42, 0)',
        0.2,
        '#1d4ed8',
        0.4,
        '#22d3ee',
        0.6,
        '#facc15',
        0.8,
        '#f97316',
        1,
        '#ef4444',
      ],
    },
  })
  map.addLayer({
    id: 'pts',
    type: 'circle',
    source: 'events',
    layout: { visibility: 'none' },
    paint: { 'circle-radius': 2.4, 'circle-color': '#67e8f9', 'circle-opacity': 0.8 },
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
      热力图：heatmap 图层由渲染管线直接对点做核密度估计，6000 个点也能流畅交互，radius / intensity 控制扩散与亮度
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-radio-group v-model="mode" size="small" @change="switchMode as any">
        <el-radio-button value="heat">热力</el-radio-button>
        <el-radio-button value="point">散点</el-radio-button>
      </el-radio-group>
      <span class="flex items-center gap-2">半径 {{ radius }}
        <el-slider class="!w-32" :model-value="radius" :min="4" :max="60" size="small" @input="applyRadius as any" />
      </span>
      <span class="flex items-center gap-2">强度 {{ intensity.toFixed(1) }}
        <el-slider class="!w-32" :model-value="intensity" :min="0.2" :max="3" :step="0.1" size="small" @input="applyIntensity as any" />
      </span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
