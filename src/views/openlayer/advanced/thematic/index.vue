<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, fitSource } from '@/utils/gis/olDemo'
import { assetUrl } from '@/utils/publicUrl'

const legend = [
  { label: '0 – 50', color: '#dbeafe' },
  { label: '50 – 100', color: '#93c5fd' },
  { label: '100 – 200', color: '#60a5fa' },
  { label: '200 – 400', color: '#2563eb' },
  { label: '400 +', color: '#1e3a8a' },
]

const status = ref('加载中…')

let map: any = null
let ol: any = null
let source: any = null

function colorOf(value: number) {
  if (value < 50) return '#dbeafe'
  if (value < 100) return '#93c5fd'
  if (value < 200) return '#60a5fa'
  if (value < 400) return '#2563eb'
  return '#1e3a8a'
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()

  const layer = new lib.VectorLayer({
    source,
    style: (feature: any) =>
      new lib.Style({
        fill: new lib.Fill({ color: colorOf(Number(feature.get('density') ?? 0)) }),
        stroke: new lib.Stroke({ color: 'rgba(255,255,255,0.85)', width: 0.8 }),
      }),
  })

  map = createDemoMap(lib, el, { center: [-98, 39], zoom: 4, base: 'light', layers: [layer] })

  try {
    const res = await fetch(assetUrl('data/geojson/us-states.json'))
    const json = await res.json()
    const features = new lib.GeoJSON().readFeatures(json, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    })
    source.addFeatures(features)
    fitSource(map, source, 20)
    status.value = `分级设色 · ${features.length} 个区域 · 指标 density`
  } catch (e: any) {
    status.value = `数据加载失败：${e?.message || e}`
  }

  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">专题图：按属性值分级设色（Choropleth），样式函数中根据 density 返回不同填充色</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" type="success" effect="plain">{{ status }}</el-tag>
      <el-tag v-for="item in legend" :key="item.label" size="small" effect="plain">
        <span class="inline-block h-2 w-2 rounded-sm align-middle" :style="{ background: item.color }" />
        <span class="ml-1 align-middle">{{ item.label }}</span>
      </el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
