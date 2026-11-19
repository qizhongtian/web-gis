<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const fillColor = ref('#3b82f6')
const fillOpacity = ref(0.25)
const strokeColor = ref('#1d4ed8')
const strokeWidth = ref(2)
const radius = ref(7)
const showLabel = ref(true)

let map: any = null
let layer: any = null
let ol: any = null

function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 函数样式：每次重绘按要素名称生成标注 */
function apply() {
  if (!layer || !ol) return
  layer.setStyle(
    (feature: any) =>
      new ol.Style({
        fill: new ol.Fill({ color: hexToRgba(fillColor.value, fillOpacity.value) }),
        stroke: new ol.Stroke({ color: strokeColor.value, width: strokeWidth.value }),
        image: new ol.CircleStyle({
          radius: radius.value,
          fill: new ol.Fill({ color: strokeColor.value }),
          stroke: new ol.Stroke({ color: '#fff', width: 2 }),
        }),
        text: showLabel.value
          ? new ol.Text({
              text: String(feature.get('name') ?? ''),
              font: 'bold 12px sans-serif',
              fill: new ol.Fill({ color: '#0f172a' }),
              offsetY: -20,
              backgroundFill: new ol.Fill({ color: 'rgba(255,255,255,0.85)' }),
              padding: [2, 5, 2, 5],
            })
          : undefined,
      }),
  )
}

function onFillOpacity(value: any) {
  fillOpacity.value = value
  apply()
}

function onStrokeWidth(value: any) {
  strokeWidth.value = value
  apply()
}

function onRadius(value: any) {
  radius.value = value
  apply()
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const { VectorSource, VectorLayer, GeoJSON } = lib

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '核心区' },
        geometry: { type: 'Polygon', coordinates: [[[116.2, 39.8], [116.6, 39.8], [116.6, 40.05], [116.2, 40.05], [116.2, 39.8]]] },
      },
      { type: 'Feature', properties: { name: '北京' }, geometry: { type: 'Point', coordinates: [116.407, 39.904] } },
      {
        type: 'Feature',
        properties: { name: '联络线' },
        geometry: { type: 'LineString', coordinates: [[116.3, 39.86], [116.45, 39.92], [116.58, 39.99]] },
      },
    ],
  }

  layer = new VectorLayer({
    source: new VectorSource({
      features: new GeoJSON().readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }),
    }),
  })
  map = createDemoMap(lib, el, { center: [116.4, 39.94], zoom: 11, base: 'light', layers: [layer] })
  apply()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Style：Fill / Stroke / CircleStyle / Text 组合样式，函数样式可按要素属性动态渲染标注</p>
    <div class="flex flex-wrap items-center gap-3 text-[12px] text-[#64748b]">
      <span>填充</span>
      <el-color-picker v-model="fillColor" size="small" @change="apply" />
      <el-slider class="max-w-28" :model-value="fillOpacity" :min="0" :max="1" :step="0.05" size="small" @input="onFillOpacity" />
      <span>描边</span>
      <el-color-picker v-model="strokeColor" size="small" @change="apply" />
      <span>线宽</span>
      <el-slider class="max-w-28" :model-value="strokeWidth" :min="1" :max="10" size="small" @input="onStrokeWidth" />
      <span>点半径</span>
      <el-slider class="max-w-28" :model-value="radius" :min="3" :max="16" size="small" @input="onRadius" />
      <el-checkbox v-model="showLabel" size="small" @change="apply">显示标注</el-checkbox>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
