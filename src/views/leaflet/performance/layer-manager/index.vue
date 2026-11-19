<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createBaseLayer, createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

interface Row {
  id: string
  name: string
  kind: string
  count: number
  visible: boolean
  opacity: number
}

const rows = ref<Row[]>([])
const allVisible = ref(true)

let map: any = null
let L: any = null
let registry: Record<string, any> = {}
let defs: { id: string; name: string; kind: string; count: number }[] = []

function makeLayer(id: string) {
  if (id === 'devices') {
    return L.layerGroup(
      randomPoints(160, [116.15, 39.72, 116.66, 40.08], 61).map((p: [number, number]) =>
        L.circleMarker(p, { radius: 4, color: '#fff', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.9 }),
      ),
    )
  }
  if (id === 'roads') {
    return L.layerGroup(
      randomPoints(40, [116.15, 39.72, 116.66, 40.08], 62).map((p: [number, number], i: number) =>
        L.polyline(
          [p, [p[0] + 0.05, p[1] + 0.04], [p[0] + 0.09, p[1] + 0.01]],
          { color: i % 2 ? '#f97316' : '#8b5cf6', weight: 2 },
        ),
      ),
    )
  }
  if (id === 'areas') {
    return L.layerGroup([
      L.polygon(
        [
          [39.95, 116.3],
          [39.96, 116.52],
          [39.86, 116.56],
          [39.83, 116.36],
        ],
        { color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.14 },
      ),
    ])
  }
  return L.layerGroup(
    randomPoints(80, [116.2, 39.78, 116.6, 40.05], 63).map((p: [number, number]) =>
      L.circle(p, { radius: 900, stroke: false, fillColor: '#ef4444', fillOpacity: 0.16 }),
    ),
  )
}

function sync() {
  rows.value = defs.map((d) => ({
    ...d,
    visible: map?.hasLayer(registry[d.id]) ?? false,
    opacity: registry[d.id]?.options?.opacity ?? 1,
  }))
}

function toggle(id: string, value: any) {
  const target = registry[id]
  if (!target || !map) return
  value ? target.addTo(map) : map.removeLayer(target)
  sync()
}

function setOpacity(id: string, value: any) {
  const target = registry[id]
  const v = Number(value)
  if (!target) return
  // 组内每个要素都要单独设，LayerGroup 本身没有 opacity
  target.eachLayer?.((l: any) => l.setStyle?.({ opacity: v, fillOpacity: v * 0.6 }))
  sync()
}

function bringFront(id: string) {
  const target = registry[id]
  target?.eachLayer?.((l: any) => l.bringToFront?.())
}

function toggleAll(value: any) {
  allVisible.value = Boolean(value)
  defs.forEach((d) => toggle(d.id, allVisible.value))
}

function removeLayer(id: string) {
  const target = registry[id]
  if (target && map) map.removeLayer(target)
  defs = defs.filter((d) => d.id !== id)
  delete registry[id]
  sync()
}

function reset() {
  defs.forEach((d) => {
    if (!map.hasLayer(registry[d.id])) registry[d.id].addTo(map)
  })
  sync()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10 })
  createBaseLayer(L, 'light').addTo(map)

  defs = [
    { id: 'devices', name: '设备点', kind: 'circleMarker', count: 160 },
    { id: 'roads', name: '路网', kind: 'polyline', count: 40 },
    { id: 'areas', name: '管理区', kind: 'polygon', count: 1 },
    { id: 'heat', name: '覆盖圈', kind: 'circle', count: 80 },
  ]
  registry = {}
  defs.forEach((d) => {
    registry[d.id] = makeLayer(d.id)
    registry[d.id].addTo(map)
  })
  sync()

  return () => {
    map?.remove()
    map = null
    registry = {}
    defs = []
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      图层管理：把图层登记进注册表，统一控制显隐 / 透明度 / 顺序与销毁，避免散落在业务代码里找不到引用
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-checkbox :model-value="allVisible" size="small" @change="toggleAll as any">全选</el-checkbox>
      <el-button size="small" @click="reset">恢复全部</el-button>
      <el-tag size="small" effect="plain" type="info">图层 {{ rows.length }}</el-tag>
    </div>
    <div class="rounded border border-[#e6e8eb] overflow-hidden">
      <div class="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1.6fr] bg-[#f6f8fa] px-2 py-1 text-[12px] text-[#64748b]">
        <span>名称</span><span>类型</span><span>要素</span><span>可见</span><span>操作</span>
      </div>
      <div
        v-for="r in rows"
        :key="r.id"
        class="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1.6fr] items-center px-2 py-1 text-[12px] text-[#334155] border-t border-[#f1f3f5]"
      >
        <span>{{ r.name }}</span>
        <span class="text-[#94a3b8]">{{ r.kind }}</span>
        <span>{{ r.count }}</span>
        <el-switch :model-value="r.visible" size="small" @change="toggle(r.id, $event)" />
        <div class="flex items-center gap-1">
          <el-slider
            class="max-w-16"
            :model-value="r.opacity"
            :min="0.1"
            :max="1"
            :step="0.1"
            size="small"
            @input="setOpacity(r.id, $event)"
          />
          <el-button size="small" link @click="bringFront(r.id)">置顶</el-button>
          <el-button size="small" link type="danger" @click="removeLayer(r.id)">移除</el-button>
        </div>
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
