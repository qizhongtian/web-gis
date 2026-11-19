<script setup lang="ts">
import { shallowRef } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createBaseLayer, createDemoMap } from '@/utils/gis/olDemo'

interface Row {
  id: string
  label: string
  layer: any
  visible: boolean
  opacity: number
  zIndex: number
}

const rows = shallowRef<Row[]>([])
let map: any = null

function refresh() {
  rows.value = rows.value.map((r) => ({
    ...r,
    visible: r.layer.getVisible(),
    opacity: r.layer.getOpacity(),
    zIndex: r.layer.getZIndex() ?? 0,
  }))
}

function toggle(row: Row) {
  row.layer.setVisible(!row.layer.getVisible())
  refresh()
}

function setOpacity(row: Row, value: number) {
  row.layer.setOpacity(value)
  refresh()
}

function raise(row: Row, step: number) {
  const z = row.layer.getZIndex() ?? 0
  row.layer.setZIndex(Math.max(0, z + step))
  refresh()
}

function toTop(row: Row) {
  const max = Math.max(...rows.value.map((r) => r.layer.getZIndex() ?? 0))
  row.layer.setZIndex(max + 10)
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  const { Feature, Point, VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle } = lib
  const base = createBaseLayer(lib, 'light')
  base.setZIndex(0)

  const area = new VectorLayer({
    zIndex: 10,
    source: new VectorSource({
      features: [
        new Feature({
          geometry: lib.polygonFromExtent(lib.transformExtent([116.1, 39.75, 116.7, 40.1], 'EPSG:4326', 'EPSG:3857')),
        }),
      ],
    }),
    style: new Style({
      fill: new Fill({ color: 'rgba(59,130,246,0.28)' }),
      stroke: new Stroke({ color: '#3b82f6', width: 2 }),
    }),
  })

  const route = new VectorLayer({
    zIndex: 20,
    source: new VectorSource({
      features: [
        new Feature({
          geometry: new lib.LineString([
            lib.fromLonLat([116.15, 39.8]),
            lib.fromLonLat([116.407, 39.904]),
            lib.fromLonLat([116.62, 40.02]),
          ]),
        }),
      ],
    }),
    style: new Style({ stroke: new Stroke({ color: '#22d3ee', width: 4 }) }),
  })

  const cities = new VectorLayer({
    zIndex: 30,
    source: new VectorSource({
      features: ['天安门', '首都机场', '颐和园'].map(
        (name, i) =>
          new Feature({
            geometry: new Point(lib.fromLonLat([[116.397, 39.909], [116.603, 40.079], [116.275, 39.999]][i])),
            name,
          }),
      ),
    }),
    style: new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#f97316' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 10, base: 'none', layers: [base, area, route, cities] })

  rows.value = [
    { id: 'cities', label: '城市点位', layer: cities, visible: true, opacity: 1, zIndex: 30 },
    { id: 'route', label: '路线', layer: route, visible: true, opacity: 1, zIndex: 20 },
    { id: 'area', label: '范围面', layer: area, visible: true, opacity: 1, zIndex: 10 },
    { id: 'base', label: '底图', layer: base, visible: true, opacity: 1, zIndex: 0 },
  ]

  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">显隐与排序：setVisible / setOpacity / setZIndex 控制图层叠放；zIndex 越大越靠上</p>
    <div class="rounded-lg border border-[#e6e8eb] bg-white p-2 space-y-1">
      <div v-for="row in rows" :key="row.id" class="flex flex-wrap items-center gap-2 px-1 py-1 text-[12px]">
        <el-checkbox :model-value="row.visible" size="small" @change="toggle(row)" />
        <span class="w-20 text-[#334155]">{{ row.label }}</span>
        <el-tag size="small" effect="plain">z={{ row.zIndex }}</el-tag>
        <el-slider
          class="max-w-32"
          :model-value="row.opacity"
          :min="0"
          :max="1"
          :step="0.05"
          size="small"
          @input="setOpacity(row, $event as number)"
        />
        <el-button size="small" text @click="raise(row, 10)">上移</el-button>
        <el-button size="small" text @click="raise(row, -10)">下移</el-button>
        <el-button size="small" text type="primary" @click="toTop(row)">置顶</el-button>
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
