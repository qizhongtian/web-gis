<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, fitSource } from '@/utils/gis/olDemo'
import { assetUrl } from '@/utils/publicUrl'

const status = ref('待请求')
const loading = ref(false)
const count = ref(0)

const WFS_URL =
  'https://ahocevar.com/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature' +
  '&typename=osm:water_areas&outputFormat=application/json&srsname=EPSG:3857&count=200'

let map: any = null
let ol: any = null
let source: any = null

function show(features: any[], from: string) {
  source.clear()
  source.addFeatures(features)
  count.value = features.length
  status.value = `${from} · ${features.length} 个要素`
  fitSource(map, source)
}

async function load() {
  if (!ol) return
  loading.value = true
  status.value = '请求中…'
  try {
    const res = await fetch(WFS_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const features = new ol.GeoJSON().readFeatures(json, {
      dataProjection: 'EPSG:3857',
      featureProjection: 'EPSG:3857',
    })
    show(features, '远程 WFS')
  } catch (e: any) {
    const json = await (await fetch(assetUrl('data/geojson/polygon.json'))).json()
    const features = new ol.GeoJSON().readFeatures(json, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    })
    show(features, `远程不可用（${e?.message || e}），回退本地`)
  } finally {
    loading.value = false
  }
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  const layer = new lib.VectorLayer({
    source,
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(59,130,246,0.25)' }),
      stroke: new lib.Stroke({ color: '#2563eb', width: 2 }),
      image: new lib.CircleStyle({ radius: 5, fill: new lib.Fill({ color: '#2563eb' }) }),
    }),
  })
  map = createDemoMap(lib, el, { center: [114.12, 22.52], zoom: 13, base: 'light', layers: [layer] })
  await load()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">WFS：GetFeature 取回 GeoJSON 后交给 VectorSource 渲染，可查询、可编辑</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" :loading="loading" @click="load">请求 WFS</el-button>
      <el-tag size="small" type="success" effect="plain">{{ status }}</el-tag>
      <el-tag size="small" effect="plain">要素数 {{ count }}</el-tag>
    </div>
    <el-tag class="w-fit max-w-full" size="small" type="info" effect="plain">typename=osm:water_areas · srsname=EPSG:3857</el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
