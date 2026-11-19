<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const wmsVisible = ref(true)
const wfsVisible = ref(true)
const status = ref('WFS 请求中…')
const count = ref(0)

const WFS_URL =
  'https://ahocevar.com/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature' +
  '&typename=osm:water_areas&outputFormat=application/json&srsname=EPSG:3857&count=200'

let map: any = null
let ol: any = null
let wmsLayer: any = null
let wfsLayer: any = null

function toggleWms(value: any) {
  wmsVisible.value = Boolean(value)
  wmsLayer?.setVisible(wmsVisible.value)
}

function toggleWfs(value: any) {
  wfsVisible.value = Boolean(value)
  wfsLayer?.setVisible(wfsVisible.value)
}

async function loadWfs() {
  try {
    const res = await fetch(WFS_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const features = new ol.GeoJSON().readFeatures(json, {
      dataProjection: 'EPSG:3857',
      featureProjection: 'EPSG:3857',
    })
    wfsLayer.getSource().addFeatures(features)
    count.value = features.length
    status.value = `WFS 就绪 · ${features.length} 个要素`
  } catch (e: any) {
    status.value = `WFS 不可用：${e?.message || e}`
  }
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  wmsLayer = new lib.TileLayer({
    opacity: 0.9,
    source: new lib.TileWMS({
      url: 'https://ahocevar.com/geoserver/wms',
      params: { LAYERS: 'ne:ne', TILED: true },
      serverType: 'geoserver',
      crossOrigin: 'anonymous',
    }),
  })

  wfsLayer = new lib.VectorLayer({
    source: new lib.VectorSource(),
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.3)' }),
      stroke: new lib.Stroke({ color: '#0891b2', width: 1.5 }),
    }),
  })

  map = createDemoMap(lib, el, { center: [10, 30], zoom: 3, base: 'light', layers: [wmsLayer, wfsLayer] })
  await loadWfs()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">GeoServer：同一台服务同时发布 WMS（栅格出图）与 WFS（矢量数据），按需开关图层做叠加</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-checkbox :model-value="wmsVisible" size="small" @change="toggleWms as any">WMS · ne:ne</el-checkbox>
      <el-checkbox :model-value="wfsVisible" size="small" @change="toggleWfs as any">WFS · osm:water_areas</el-checkbox>
      <el-tag size="small" type="success" effect="plain">{{ status }}</el-tag>
      <el-tag size="small" effect="plain">要素数 {{ count }}</el-tag>
    </div>
    <div class="flex flex-wrap gap-1">
      <el-tag size="small" type="info" effect="plain">/geoserver/wms?service=WMS&request=GetMap</el-tag>
      <el-tag size="small" type="info" effect="plain">/geoserver/wfs?service=WFS&request=GetFeature</el-tag>
      <el-tag size="small" type="info" effect="plain">/geoserver/gwc/service/wmts</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
