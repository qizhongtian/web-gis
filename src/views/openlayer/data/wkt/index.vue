<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, fitSource } from '@/utils/gis/olDemo'

const samples = [
  { label: 'POINT', value: 'POINT (116.407 39.904)' },
  { label: 'LINESTRING', value: 'LINESTRING (116.28 39.86, 116.407 39.904, 116.55 39.95)' },
  {
    label: 'POLYGON',
    value: 'POLYGON ((116.2 39.8, 116.62 39.8, 116.62 40.05, 116.2 40.05, 116.2 39.8))',
  },
  {
    label: 'MULTIPOLYGON',
    value: 'MULTIPOLYGON (((116.05 39.8, 116.2 39.8, 116.2 39.95, 116.05 39.95, 116.05 39.8)))',
  },
]

const wkt = ref(samples[2].value)
const sample = ref(2)
const message = ref('选择示例或直接编辑 WKT，然后点击解析')

let map: any = null
let ol: any = null
let source: any = null

function pick(index: number) {
  sample.value = index
  wkt.value = samples[index].value
  parse()
}

function parse() {
  if (!ol || !map) return
  try {
    const feature = new ol.WKT().readFeature(wkt.value, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    })
    source.clear()
    source.addFeature(feature)
    fitSource(map, source, 80)
    message.value = `解析成功：${feature.getGeometry().getType()}`
  } catch (e: any) {
    message.value = `解析失败：${e?.message || e}`
  }
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  const layer = new lib.VectorLayer({
    source,
    style: new lib.Style({
      stroke: new lib.Stroke({ color: '#22d3ee', width: 3 }),
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.22)' }),
      image: new lib.CircleStyle({
        radius: 7,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })
  map = createDemoMap(lib, el, { center: [116.4, 39.9], zoom: 11, base: 'light', layers: [layer] })
  parse()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">WKT：ol/format/WKT 解析文本几何，可直接对接数据库 geometry 字段（PostGIS 等）</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-radio-group v-model="sample" size="small" @change="pick as any">
        <el-radio-button v-for="(s, i) in samples" :key="s.label" :value="i">{{ s.label }}</el-radio-button>
      </el-radio-group>
      <el-tag size="small" effect="plain">{{ message }}</el-tag>
    </div>
    <el-input v-model="wkt" type="textarea" :rows="3" resize="none" class="font-mono" />
    <el-button size="small" type="primary" class="w-fit" @click="parse">解析 WKT</el-button>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
