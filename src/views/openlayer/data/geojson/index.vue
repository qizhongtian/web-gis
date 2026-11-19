<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, fitSource } from '@/utils/gis/olDemo'
import { assetUrl } from '@/utils/publicUrl'

const status = ref('待加载')
const count = ref(0)
const fields = ref<string[]>([])
let map: any = null
let ol: any = null
let source: any = null

function loadGeojson(json: any) {
  const features = new ol.GeoJSON().readFeatures(json, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })
  source.clear()
  source.addFeatures(features)
  count.value = features.length
  fields.value = Object.keys(features[0]?.getProperties() ?? {})
    .filter((k) => k !== 'geometry')
    .slice(0, 6)
  fitSource(map, source)
  status.value = `已加载 ${features.length} 个要素`
}

async function loadRemote() {
  try {
    const res = await fetch(assetUrl('data/geojson/polygon.json'))
    loadGeojson(await res.json())
  } catch {
    status.value = '本地示例加载失败'
  }
}

async function onFile(file: any) {
  try {
    loadGeojson(JSON.parse(await file.raw.text()))
  } catch (e: any) {
    status.value = `解析失败：${e?.message || e}`
  }
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  const layer = new lib.VectorLayer({
    source,
    style: new lib.Style({
      stroke: new lib.Stroke({ color: '#22d3ee', width: 2 }),
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.2)' }),
      image: new lib.CircleStyle({
        radius: 5,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })
  map = createDemoMap(lib, el, { center: [114.12, 22.52], zoom: 13, base: 'light', layers: [layer] })
  await loadRemote()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">GeoJSON：ol/format/GeoJSON 解析 FeatureCollection，dataProjection 4326 → featureProjection 3857</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" type="success" effect="plain">{{ status }}</el-tag>
      <el-tag size="small" effect="plain">要素数 {{ count }}</el-tag>
      <el-tag v-for="f in fields" :key="f" size="small" type="info" effect="plain">{{ f }}</el-tag>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".json,.geojson" :on-change="onFile">
        <el-button size="small" type="primary">上传 GeoJSON</el-button>
      </el-upload>
      <el-button size="small" @click="loadRemote">重新加载示例</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
