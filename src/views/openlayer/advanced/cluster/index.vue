<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const distance = ref(40)
const raw = ref(0)

let map: any = null
let ol: any = null
let clusterSource: any = null

function onDistance(value: any) {
  distance.value = value
  clusterSource?.setDistance(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const source = new lib.VectorSource({
    features: randomPoints(lib, 800, [116.1, 39.7, 116.75, 40.15], (i) => ({ name: `点位-${i + 1}` })),
  })
  raw.value = source.getFeatures().length
  clusterSource = new lib.Cluster({ distance: distance.value, source })

  const layer = new lib.VectorLayer({
    source: clusterSource,
    style: (feature: any) => {
      const size = feature.get('features').length
      const radius = Math.min(12 + Math.sqrt(size) * 2.4, 30)
      return new lib.Style({
        image: new lib.CircleStyle({
          radius,
          fill: new lib.Fill({ color: size > 20 ? '#ef4444' : size > 8 ? '#f97316' : '#22d3ee' }),
          stroke: new lib.Stroke({ color: 'rgba(255,255,255,0.9)', width: 2 }),
        }),
        text: new lib.Text({
          text: String(size),
          font: 'bold 12px sans-serif',
          fill: new lib.Fill({ color: '#fff' }),
        }),
      })
    },
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 10, base: 'light', layers: [layer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">聚合：ol/source/Cluster 按屏幕像素距离合并相邻点，缩放时自动拆分 / 合并</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-tag size="small" effect="plain">原始点 {{ raw }}</el-tag>
      <span class="text-[12px] text-[#64748b]">聚合距离</span>
      <el-slider class="max-w-48" :model-value="distance" :min="10" :max="120" :step="5" size="small" @input="onDistance" />
      <el-tag size="small" type="info" effect="plain">{{ distance }} px</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
