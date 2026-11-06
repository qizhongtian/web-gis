<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'

const selected = ref('')
let select: any = null
let ol: any = null

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const { Map, View, TileLayer, VectorLayer, VectorSource, OSM, GeoJSON, Select, Style, Stroke, Fill, CircleStyle, fromLonLat } = lib

  const geojson = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: '北京', code: '110000' }, geometry: { type: 'Point', coordinates: [116.407, 39.904] } },
      { type: 'Feature', properties: { name: '上海', code: '310000' }, geometry: { type: 'Point', coordinates: [121.473, 31.23] } },
      { type: 'Feature', properties: { name: '广州', code: '440100' }, geometry: { type: 'Point', coordinates: [113.264, 23.129] } },
    ],
  }

  const layer = new VectorLayer({
    source: new VectorSource({
      features: new GeoJSON().readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }),
    }),
    style: new Style({
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#22d3ee' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
    }),
  })

  const map = new Map({
    target: el,
    layers: [new TileLayer({ source: new OSM() }), layer],
    view: new View({ center: fromLonLat([117, 33]), zoom: 5 }),
  })

  select = new Select({
    style: new Style({
      image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#f97316' }), stroke: new Stroke({ color: '#fff', width: 3 }) }),
    }),
  })
  select.on('select', (e: any) => {
    const f = e.selected[0]
    selected.value = f ? JSON.stringify(f.getProperties()) : ''
  })
  map.addInteraction(select)

  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">要素交互：Select 交互选择要素并读取属性</p>
    <el-tag v-if="selected" class="w-fit" effect="dark" type="warning">{{ selected }}</el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
