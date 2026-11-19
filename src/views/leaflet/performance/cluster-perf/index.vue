<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createCanvasLayer, createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const total = ref(50000)
const mode = ref<'cluster' | 'raw'>('cluster')
const clusterTime = ref(0)
const clusterCount = ref(0)
const renderTime = ref(0)

let map: any = null
let L: any = null
let layer: any = null
let points: [number, number][] = []

const CELL = 64

/** 网格聚合：只保留「聚合中心 + 数量」，渲染量从 5 万降到几百 */
function clusterize() {
  const t0 = performance.now()
  const cells = new Map<string, { lat: number; lng: number; n: number }>()
  for (const ll of points) {
    const p = map.latLngToContainerPoint(ll)
    const key = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`
    const c = cells.get(key)
    if (c) {
      c.lat += ll[0]
      c.lng += ll[1]
      c.n += 1
    } else {
      cells.set(key, { lat: ll[0], lng: ll[1], n: 1 })
    }
  }
  clusterTime.value = Number((performance.now() - t0).toFixed(1))
  clusterCount.value = cells.size
  return [...cells.values()].map((c) => ({
    lat: c.lat / c.n,
    lng: c.lng / c.n,
    n: c.n,
  }))
}

function draw() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  const t0 = performance.now()

  if (mode.value === 'raw') {
    // 原始渲染：不建 DOM，退化为 canvas 像素点，代表「不做任何聚合」的下限成本
    layer = createCanvasLayer(L, (c) => {
      const { ctx, map: m, size } = c
      const img = ctx.createImageData(size.x, size.y)
      for (const ll of points) {
        const p = m.latLngToContainerPoint(ll)
        const x = p.x | 0
        const y = p.y | 0
        if (x < 0 || y < 0 || x >= size.x || y >= size.y) continue
        const i = (y * size.x + x) * 4
        img.data[i] = 34
        img.data[i + 1] = 211
        img.data[i + 2] = 238
        img.data[i + 3] = Math.min(255, img.data[i + 3] + 60)
      }
      ctx.putImageData(img, 0, 0)
    })
    clusterCount.value = 0
    clusterTime.value = 0
  } else {
    const cells = clusterize()
    layer = L.layerGroup(
      cells.map((c) => {
        const size = Math.min(48, 18 + Math.log2(c.n) * 5)
        return L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(34,211,238,.85);
              color:#083344;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;
              border:2px solid rgba(255,255,255,.7)">${c.n}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          interactive: false,
        })
      }),
    )
  }

  layer.addTo(map)
  renderTime.value = Number((performance.now() - t0).toFixed(1))
}

function regen() {
  points = randomPoints(total.value, [116.05, 39.6, 116.8, 40.2], 505050)
  draw()
}

function setMode(value: any) {
  mode.value = value
  draw()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10, base: 'dark' })
  points = randomPoints(total.value, [116.05, 39.6, 116.8, 40.2], 505050)
  draw()
  return () => {
    map?.remove()
    map = null
    layer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      聚合性能：同量数据下对比「聚合后少量 Marker」与「不聚合的像素绘制」，看耗时与渲染对象的差异
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-radio-group v-model="mode" size="small" @change="setMode as any">
        <el-radio-button value="cluster">聚合</el-radio-button>
        <el-radio-button value="raw">不聚合</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">点数 {{ total }}</span>
      <el-slider class="max-w-40" :model-value="total" :min="10000" :max="120000" :step="10000" size="small" @input="(v) => { total = Number(v); regen() }" />
      <el-tag size="small" effect="plain" type="info">聚合后 {{ clusterCount }}</el-tag>
      <el-tag size="small" effect="plain" type="warning">聚合 {{ clusterTime }}ms</el-tag>
      <el-tag size="small" effect="plain" type="success">总耗时 {{ renderTime }}ms</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
