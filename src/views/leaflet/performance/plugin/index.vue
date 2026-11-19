<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const glow = ref(true)
const showLegend = ref(true)

let map: any = null
let L: any = null
let glowLine: any = null
let legend: any = null

const CODE = `// 1. 继承 L.Control 写一个图例控件
const Legend = L.Control.extend({
  options: { position: 'bottomright' },
  initialize(title, items) { this._title = title; this._items = items },
  onAdd() { const div = L.DomUtil.create('div', 'my-legend'); ...; return div },
})
L.Control.Legend = Legend
L.control.legend = (title, items) => new Legend(title, items)

// 2. 继承 L.Layer 组合多个基础图层
const GlowLine = L.Layer.extend({
  initialize(latlngs, options) { this._latlngs = latlngs; L.setOptions(this, options) },
  onAdd(map) { this._glow = L.polyline(...).addTo(map); this._line = ... },
  onRemove() { this._glow.remove(); this._line.remove() },
})
L.glowLine = (latlngs, options) => new GlowLine(latlngs, options)`

/** 插件 1：图例控件 */
function defineControl(lib: any) {
  const Legend = lib.Control.extend({
    options: { position: 'bottomright' },
    initialize(this: any, title: string, items: { color: string; label: string }[]) {
      this._title = title
      this._items = items
    },
    onAdd(this: any) {
      const div = lib.DomUtil.create('div', 'my-legend')
      div.style.cssText =
        'background:rgba(255,255,255,.94);padding:8px 10px;border-radius:6px;font-size:12px;color:#334155;box-shadow:0 1px 6px rgba(0,0,0,.2)'
      div.innerHTML =
        `<div style="font-weight:600;margin-bottom:4px">${this._title}</div>` +
        this._items
          .map(
            (it: { color: string; label: string }) =>
              `<div style="display:flex;align-items:center;gap:6px">
                 <i style="width:14px;height:4px;border-radius:2px;background:${it.color}"></i>${it.label}
               </div>`,
          )
          .join('')
      return div
    },
  })
  lib.Control.Legend = Legend
  lib.control.legend = (title: string, items: any[]) => new Legend(title, items)
}

/** 插件 2：发光折线图层（组合两条 polyline 实现光晕） */
function defineLayer(lib: any) {
  const GlowLine = lib.Layer.extend({
    initialize(this: any, latlngs: any, options: any) {
      this._latlngs = latlngs
      lib.setOptions(this, { color: '#22d3ee', weight: 3, ...options })
    },
    onAdd(this: any, m: any) {
      this._map = m
      this._glow = lib.polyline(this._latlngs, {
        color: this.options.color,
        weight: this.options.weight * 4,
        opacity: 0.16,
        lineCap: 'round',
      })
      this._line = lib.polyline(this._latlngs, {
        color: this.options.color,
        weight: this.options.weight,
        opacity: 1,
      })
      this._glow.addTo(m)
      this._line.addTo(m)
    },
    onRemove(this: any) {
      this._glow?.remove()
      this._line?.remove()
    },
    setColor(this: any, color: string) {
      this.options.color = color
      this._glow?.setStyle({ color })
      this._line?.setStyle({ color })
    },
  })
  lib.Layer.GlowLine = GlowLine
  lib.glowLine = (latlngs: any, options: any) => new GlowLine(latlngs, options)
}

const PATH: [number, number][] = [
  [39.86, 116.3],
  [39.9, 116.38],
  [39.94, 116.46],
  [39.89, 116.54],
]

function toggleGlow(value: any) {
  glow.value = Boolean(value)
  if (!map) return
  if (glow.value) {
    glowLine = glowLine || L.glowLine(PATH, { color: '#22d3ee', weight: 3 })
    glowLine.addTo(map)
  } else {
    glowLine?.remove()
  }
}

function toggleLegend(value: any) {
  showLegend.value = Boolean(value)
  if (!map) return
  if (showLegend.value) {
    legend = legend || L.control.legend('插件图例', [
      { color: '#22d3ee', label: '主干线路' },
      { color: '#f97316', label: '备用线路' },
    ])
    legend.addTo(map)
  } else {
    legend?.remove()
  }
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  defineControl(lib)
  defineLayer(lib)

  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })

  glowLine = lib.glowLine(PATH, { color: '#22d3ee', weight: 3 })
  glowLine.addTo(map)
  lib.glowLine(
    [
      [39.84, 116.4],
      [39.9, 116.34],
      [39.95, 116.42],
    ],
    { color: '#f97316', weight: 2 },
  ).addTo(map)

  legend = lib.control.legend('插件图例', [
    { color: '#22d3ee', label: '主干线路' },
    { color: '#f97316', label: '备用线路' },
  ])
  legend.addTo(map)

  return () => {
    map?.remove()
    map = null
    glowLine = null
    legend = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      插件开发：L.Control.extend 写控件、L.Layer.extend 写图层，再挂到 L 命名空间，业务里就能像内置 API 一样用
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-checkbox :model-value="glow" size="small" @change="toggleGlow as any">发光折线插件</el-checkbox>
      <el-checkbox :model-value="showLegend" size="small" @change="toggleLegend as any">图例控件插件</el-checkbox>
    </div>
    <pre class="max-h-40 overflow-auto rounded bg-[#0f172a] p-2 text-[11px] leading-4 text-[#a5f3fc] font-mono">{{ CODE }}</pre>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
