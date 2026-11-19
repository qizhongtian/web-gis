<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const zoom = ref(10)
const wheel = ref(true)
const dblClick = ref(true)
const duration = ref(0.6)

let map: any = null

function zoomIn() {
  map?.zoomIn(1, { animate: true })
}
function zoomOut() {
  map?.zoomOut(1, { animate: true })
}
function apply(value: any) {
  zoom.value = Number(value)
  map?.setZoom(zoom.value, { animate: true, duration: duration.value })
}
function fly() {
  map?.flyTo([39.9042, 116.4074], Math.min(16, zoom.value + 2), { duration: duration.value * 2 })
}
function toggleWheel(value: any) {
  wheel.value = Boolean(value)
  if (!map) return
  wheel.value ? map.scrollWheelZoom.enable() : map.scrollWheelZoom.disable()
}
function toggleDbl(value: any) {
  dblClick.value = Boolean(value)
  if (!map) return
  dblClick.value ? map.doubleClickZoom.enable() : map.doubleClickZoom.disable()
}
function setDuration(value: any) {
  duration.value = Number(value)
}

async function init(L: any, el: HTMLElement) {
  map = createDemoMap(L, el, { center: [39.9042, 116.4074], zoom: zoom.value, minZoom: 3, maxZoom: 18 })

  const badge = L.control({ position: 'topright' })
  badge.onAdd = () => {
    const div = L.DomUtil.create('div', 'leaflet-bar')
    div.style.cssText = 'padding:6px 8px;background:#fff;font-size:12px;color:#334155'
    const render = () => {
      zoom.value = map.getZoom()
      div.innerHTML = `zoom ${map.getZoom()} / ${map.getMinZoom()}~${map.getMaxZoom()}`
    }
    map.on('zoomend', render)
    render()
    return div
  }
  badge.addTo(map)

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">缩放控制：zoomIn / zoomOut / setZoom / flyTo，以及滚轮、双击缩放开关与动画时长</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" @click="zoomOut">－ 缩小</el-button>
      <el-button size="small" @click="zoomIn">＋ 放大</el-button>
      <el-button size="small" type="primary" plain @click="fly">flyTo 放大两级</el-button>
      <span class="text-[12px] text-[#64748b]">层级</span>
      <el-slider class="max-w-40" :model-value="zoom" :min="3" :max="18" :step="1" size="small" @input="apply" />
      <span class="text-[12px] text-[#64748b]">时长 {{ duration }}s</span>
      <el-slider class="max-w-32" :model-value="duration" :min="0" :max="2" :step="0.2" size="small" @input="setDuration" />
    </div>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="wheel" size="small" @change="toggleWheel as any">滚轮缩放</el-checkbox>
      <el-checkbox :model-value="dblClick" size="small" @change="toggleDbl as any">双击缩放</el-checkbox>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
