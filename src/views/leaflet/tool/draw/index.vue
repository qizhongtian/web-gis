<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { formatArea, formatDistance } from '@/utils/gis/coord'

type DrawMode = 'point' | 'polyline' | 'polygon'

const mode = ref<DrawMode | ''>('')
const distance = ref(0)
const area = ref(0)
const count = ref(0)

const hint = computed(() => {
  if (mode.value === 'point') return '点击地图添加点'
  if (mode.value === 'polyline') return '连续点击添加折线节点，完成后点击「完成」'
  if (mode.value === 'polygon') return '连续点击添加多边形节点，完成后点击「完成」'
  return '选择绘制类型后在地图上点击'
})

let L: any = null
let map: any = null
let group: any = null
let preview: any = null
let draft: any[] = []

const POINT_STYLE = { radius: 6, color: '#fff', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 }
const PREVIEW_POINT_STYLE = { radius: 7, color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 1 }
const PREVIEW_STYLE = { color: '#22d3ee', weight: 2, dashArray: '8 6', fillOpacity: 0.12 }
const LINE_STYLE = { color: '#22d3ee', weight: 3 }
const POLYGON_STYLE = { color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.18 }

function refreshCount() {
  count.value = group ? group.getLayers().length : 0
}

function clearPreview() {
  if (preview) {
    preview.remove()
    preview = null
  }
}

function drawPreview() {
  clearPreview()
  if (!draft.length || !map) return
  if (draft.length === 1) {
    preview = L.circleMarker(draft[0], PREVIEW_POINT_STYLE).addTo(map)
    return
  }
  preview =
    mode.value === 'polygon'
      ? L.polygon(draft, PREVIEW_STYLE).addTo(map)
      : L.polyline(draft, PREVIEW_STYLE).addTo(map)
}

function onModeChange(value: any) {
  draft = []
  clearPreview()
  mode.value = value as DrawMode
}

function onMapClick(e: any) {
  if (!mode.value || !group) return
  if (mode.value === 'point') {
    L.circleMarker(e.latlng, POINT_STYLE).addTo(group)
    refreshCount()
    return
  }
  draft.push(e.latlng)
  drawPreview()
}

/** 球面多边形面积（平方米） */
function sphericalArea(latlngs: any[]) {
  const R = 6371008.8
  const rad = Math.PI / 180
  let sum = 0
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i]
    const p2 = latlngs[(i + 1) % latlngs.length]
    sum += (p2.lng - p1.lng) * rad * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad))
  }
  return Math.abs((sum * R * R) / 2)
}

function lineLength(latlngs: any[]) {
  let total = 0
  for (let i = 1; i < latlngs.length; i++) total += map.distance(latlngs[i - 1], latlngs[i])
  return total
}

function ringLength(latlngs: any[]) {
  let total = 0
  for (let i = 0; i < latlngs.length; i++) {
    total += map.distance(latlngs[i], latlngs[(i + 1) % latlngs.length])
  }
  return total
}

function finish() {
  if (!map || !mode.value) return
  if (mode.value === 'point') {
    mode.value = ''
    return
  }
  if (draft.length < 2) return

  const latlngs = draft.slice()
  const current = mode.value
  draft = []
  clearPreview()

  if (current === 'polygon') {
    L.polygon(latlngs, POLYGON_STYLE).addTo(group)
    area.value = sphericalArea(latlngs)
    distance.value = ringLength(latlngs)
  } else {
    L.polyline(latlngs, LINE_STYLE).addTo(group)
    distance.value = lineLength(latlngs)
    area.value = 0
  }
  mode.value = ''
  refreshCount()
}

function undo() {
  if (draft.length) {
    draft.pop()
    drawPreview()
    return
  }
  if (!group) return
  const layers = group.getLayers()
  if (!layers.length) return
  group.removeLayer(layers[layers.length - 1])
  distance.value = 0
  area.value = 0
  refreshCount()
}

function clearAll() {
  draft = []
  clearPreview()
  mode.value = ''
  if (group) group.clearLayers()
  distance.value = 0
  area.value = 0
  refreshCount()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = L.map(el).setView([39.9042, 116.4074], 9)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  L.control.scale({ imperial: false }).addTo(map)

  group = L.layerGroup().addTo(map)
  map.on('click', onMapClick)
  refreshCount()

  return () => {
    map.off('click', onMapClick)
    map.remove()
    map = null
    group = null
    preview = null
    draft = []
    distance.value = 0
    area.value = 0
    count.value = 0
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">绘制与量算：点击绘制点 / 折线 / 多边形，并计算球面长度与面积</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-radio-group v-model="mode" size="small" @change="onModeChange">
        <el-radio-button value="point">点</el-radio-button>
        <el-radio-button value="polyline">折线</el-radio-button>
        <el-radio-button value="polygon">多边形</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" @click="finish">完成</el-button>
      <el-button size="small" @click="undo">撤销</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="dark" type="info">要素 {{ count }}</el-tag>
      <el-tag v-if="distance" size="small" effect="dark" type="success">长度 {{ formatDistance(distance) }}</el-tag>
      <el-tag v-if="area" size="small" effect="dark" type="warning">面积 {{ formatArea(area) }}</el-tag>
      <span class="text-[12px] text-[#6b7280]">{{ hint }}</span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
