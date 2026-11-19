<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const props = ref<Record<string, any> | null>(null)
const selectedId = ref<number | null>(null)
const newName = ref('')
let source: any = null
let map: any = null

function applyName() {
  const feature = selectedId.value === null ? null : source.getFeatureById(selectedId.value)
  if (!feature || !newName.value) return
  feature.set('name', newName.value)
  props.value = { ...feature.getProperties(), geometry: feature.getGeometry()?.getType() }
}

function cloneFeature() {
  const feature = selectedId.value === null ? null : source.getFeatureById(selectedId.value)
  if (!feature) return
  const copy = feature.clone()
  copy.setId(`${feature.getId()}-copy-${Date.now()}`)
  source.addFeature(copy)
}

function removeFeature() {
  const feature = selectedId.value === null ? null : source.getFeatureById(selectedId.value)
  if (!feature) return
  source.removeFeature(feature)
  props.value = null
  selectedId.value = null
}

async function init(lib: any, el: HTMLElement) {
  const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, GeoJSON } = lib

  const geojson = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: '北京', code: '110000', level: '直辖市' }, geometry: { type: 'Point', coordinates: [116.407, 39.904] } },
      { type: 'Feature', properties: { name: '上海', code: '310000', level: '直辖市' }, geometry: { type: 'Point', coordinates: [121.473, 31.23] } },
      { type: 'Feature', properties: { name: '广州', code: '440100', level: '省会' }, geometry: { type: 'Point', coordinates: [113.264, 23.129] } },
    ],
  }

  source = new VectorSource()
  new GeoJSON().readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }).forEach((f: any, i: number) => {
    f.setId(i + 1)
    source.addFeature(f)
  })

  const layer = new VectorLayer({
    source,
    style: new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#22d3ee' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, { center: [117, 33], zoom: 5, layers: [layer] })

  map.on('singleclick', (e: any) => {
    source.forEachFeatureAtCoordinate(e.coordinate, (f: any) => {
      selectedId.value = Number(f.getId())
      newName.value = f.get('name')
      props.value = { ...f.getProperties(), geometry: f.getGeometry()?.getType() }
    })
    if (!map.hasFeatureAtPixel(e.pixel)) {
      selectedId.value = null
      props.value = null
    }
  })

  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">Feature：业务数据的载体，getProperties 读属性、set 改属性、clone 复制、setId 便于按 id 检索</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" effect="plain">选中 id：{{ selectedId ?? '—' }}</el-tag>
      <el-input v-model="newName" size="small" class="max-w-40" placeholder="新名称" :disabled="selectedId === null" />
      <el-button size="small" type="primary" :disabled="selectedId === null" @click="applyName">更新属性</el-button>
      <el-button size="small" :disabled="selectedId === null" @click="cloneFeature">克隆</el-button>
      <el-button size="small" type="danger" :disabled="selectedId === null" @click="removeFeature">删除</el-button>
    </div>
    <pre
      v-if="props"
      class="max-h-28 overflow-auto rounded-lg border border-[#e6e8eb] bg-[#f8fafc] p-2 text-[11px] text-[#475569]"
    >{{ JSON.stringify(props, null, 2) }}</pre>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
