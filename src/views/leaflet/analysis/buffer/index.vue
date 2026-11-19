<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { bufferLatLngs, createDemoMap, fromMeters, toMeters } from '@/utils/gis/leafletDemo'

type Kind = 'polygon' | 'line' | 'point'

const kind = ref<Kind>('line')
const radius = ref(600)

let map: any = null
let L: any = null
let source: any = null
let bufferLayer: any = null

const RING: [number, number][] = [
  [39.95, 116.32],
  [39.96, 116.46],
  [39.88, 116.5],
  [39.85, 116.38],
]

const LINE: [number, number][] = [
  [39.86, 116.3],
  [39.9, 116.37],
  [39.94, 116.45],
  [39.9, 116.53],
]

const POINT: [number, number] = [39.905, 116.41]

/** 线缓冲：每段按法线偏移左右两条链，首尾用半圆封口 */
function lineBuffer(latlngs: [number, number][], meters: number) {
  const pts = latlngs.map((ll) => toMeters(map, ll))
  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    left.push([a[0] + nx * meters, a[1] + ny * meters], [b[0] + nx * meters, b[1] + ny * meters])
    right.push([a[0] - nx * meters, a[1] - ny * meters], [b[0] - nx * meters, b[1] - ny * meters])
  }

  const ring = [...left, ...right.reverse()]
  return ring.map((p) => {
    const ll = fromMeters(map, p)
    return [ll.lat, ll.lng] as [number, number]
  })
}

function render() {
  if (!map) return
  bufferLayer.clearLayers()
  source?.remove()

  const style = { color: '#22d3ee', weight: 2, fillColor: '#22d3ee', fillOpacity: 0.16 }
  const srcStyle = { color: '#f97316', weight: 3 }

  if (kind.value === 'polygon') {
    source = L.polygon(RING, srcStyle).addTo(map)
    const buf = bufferLatLngs(map, RING, radius.value)
    L.polygon(buf, style).addTo(bufferLayer)
  } else if (kind.value === 'line') {
    source = L.polyline(LINE, srcStyle).addTo(map)
    L.polygon(lineBuffer(LINE, radius.value), style).addTo(bufferLayer)
    // 端点半圆用圆形近似，避免转角锯齿太明显
    ;[LINE[0], LINE[LINE.length - 1]].forEach((p) => L.circle(p, { radius: radius.value, ...style }).addTo(bufferLayer))
  } else {
    source = L.circleMarker(POINT, { radius: 6, color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1 }).addTo(map)
    L.circle(POINT, { radius: radius.value, ...style }).addTo(bufferLayer)
  }

  map.fitBounds(bufferLayer.getBounds(), { padding: [40, 40] })
}

function setKind(value: any) {
  kind.value = value as Kind
  render()
}

function setRadius(value: any) {
  radius.value = Number(value)
  render()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })
  bufferLayer = L.layerGroup().addTo(map)
  render()

  return () => {
    map?.remove()
    map = null
    bufferLayer = null
    source = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      缓冲区：投到 Web 墨卡托米制后按顶点外法线外扩，面缓冲带斜接、线缓冲加半圆封口
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-radio-group v-model="kind" size="small" @change="setKind as any">
        <el-radio-button value="point">点</el-radio-button>
        <el-radio-button value="line">线</el-radio-button>
        <el-radio-button value="polygon">面</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">半径 {{ radius }}m</span>
      <el-slider class="max-w-40" :model-value="radius" :min="100" :max="2500" :step="100" size="small" @input="setRadius" />
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
