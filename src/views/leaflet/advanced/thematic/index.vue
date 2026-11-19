<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { addLegend, createDemoMap, seeded } from '@/utils/gis/leafletDemo'

const scheme = ref<'warm' | 'cool'>('warm')
const steps = ref(5)
const picked = ref('点击网格查看数值')

let map: any = null
let L: any = null
let layer: any = null
let legend: any = null
let cells: { ring: [number, number][]; value: number }[] = []

const PALETTES: Record<string, string[]> = {
  warm: ['#fef3c7', '#fed7aa', '#fdba74', '#fb923c', '#ea580c', '#c2410c', '#9a3412'],
  cool: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#075985'],
}

function buildCells() {
  const rnd = seeded(2026)
  const lng0 = 116.2
  const lat0 = 39.78
  const dx = 0.09
  const dy = 0.045
  const out: { ring: [number, number][]; value: number }[] = []
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 6; c++) {
      // 用两个正弦叠加造出「中间高、四周低」的分布，比纯随机更像真实专题数据
      const cx = c - 2.5
      const cy = r - 3
      const base = 100 - Math.sqrt(cx * cx + cy * cy) * 14 + rnd() * 18
      out.push({
        ring: [
          [lat0 + r * dy, lng0 + c * dx],
          [lat0 + r * dy, lng0 + (c + 1) * dx],
          [lat0 + (r + 1) * dy, lng0 + (c + 1) * dx],
          [lat0 + (r + 1) * dy, lng0 + c * dx],
        ],
        value: Math.max(8, Math.round(base)),
      })
    }
  }
  return out
}

function colorOf(value: number) {
  const values = cells.map((c) => c.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const n = steps.value
  const idx = Math.min(n - 1, Math.floor(((value - min) / (max - min || 1)) * n))
  return PALETTES[scheme.value][Math.round((idx / Math.max(1, n - 1)) * 6)]
}

function rebuild() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  layer = L.layerGroup().addTo(map)

  cells.forEach((c) => {
    L.polygon(c.ring, {
      color: 'rgba(255,255,255,.7)',
      weight: 1,
      fillColor: colorOf(c.value),
      fillOpacity: 0.82,
    })
      .addTo(layer)
      .on('click', () => {
        picked.value = `网格值 ${c.value}`
      })
      .bindTooltip(`值 ${c.value}`, { sticky: true })
  })

  if (legend) map.removeControl(legend)
  const values = cells.map((c) => c.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const items = Array.from({ length: steps.value }, (_, i) => {
    const lo = min + ((max - min) / steps.value) * i
    const hi = min + ((max - min) / steps.value) * (i + 1)
    return {
      color: PALETTES[scheme.value][Math.round((i / Math.max(1, steps.value - 1)) * 6)],
      label: `${Math.round(lo)} ~ ${Math.round(hi)}`,
    }
  })
  legend = addLegend(L, map, '专题分级', items)
}

function setScheme(value: any) {
  scheme.value = value
  rebuild()
}

function setSteps(value: any) {
  steps.value = Number(value)
  rebuild()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.94, 116.47], zoom: 11 })
  cells = buildCells()
  rebuild()
  return () => {
    map?.remove()
    map = null
    layer = null
    legend = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">专题图：数值按分级色带填充多边形，配图例；分级数与配色方案可实时切换</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-select v-model="scheme" size="small" class="w-32" @change="setScheme">
        <el-option label="暖色分级" value="warm" />
        <el-option label="冷色分级" value="cool" />
      </el-select>
      <span class="text-[12px] text-[#64748b]">分级 {{ steps }}</span>
      <el-slider class="max-w-32" :model-value="steps" :min="3" :max="7" :step="1" size="small" @input="setSteps" />
      <el-tag size="small" effect="plain" type="info">{{ picked }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
