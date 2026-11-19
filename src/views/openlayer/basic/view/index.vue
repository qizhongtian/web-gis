<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const info = ref('层级 10.00 · 中心 116.4070, 39.9040')
const rotation = ref(0)
let map: any = null
let ol: any = null

function flyTo(lon: number, lat: number, zoom: number) {
  if (!map || !ol) return
  map.getView().animate({ center: ol.fromLonLat([lon, lat]), zoom, duration: 700 })
}

function zoomBy(delta: number) {
  if (!map) return
  const view = map.getView()
  view.animate({ zoom: (view.getZoom() || 0) + delta, duration: 300 })
}

function rotate(value: number) {
  rotation.value = value
  map?.getView().setRotation((value * Math.PI) / 180)
}

function reset() {
  rotation.value = 0
  if (!map) return
  map.getView().animate({ center: ol.fromLonLat([116.407, 39.904]), zoom: 10, rotation: 0, duration: 500 })
}

function syncInfo() {
  const view = map.getView()
  const center = ol.toLonLat(view.getCenter())
  info.value = `层级 ${view.getZoom()?.toFixed(2)} · 中心 ${center[0].toFixed(4)}, ${center[1].toFixed(4)}`
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10 })
  map.getView().on('change:resolution', syncInfo)
  map.on('moveend', syncInfo)
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">视图：View 控制 center / zoom / rotation / resolution，animate 提供平滑过渡</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" effect="plain">{{ info }}</el-tag>
      <el-button size="small" @click="zoomBy(1)">放大</el-button>
      <el-button size="small" @click="zoomBy(-1)">缩小</el-button>
      <el-button size="small" type="primary" @click="flyTo(116.407, 39.904, 12)">北京</el-button>
      <el-button size="small" @click="flyTo(121.473, 31.23, 12)">上海</el-button>
      <el-button size="small" @click="flyTo(113.264, 23.129, 12)">广州</el-button>
      <el-button size="small" @click="reset">重置</el-button>
    </div>
    <div class="flex items-center gap-2 text-[12px] text-[#64748b]">
      <span>旋转</span>
      <el-slider class="max-w-64" :model-value="rotation" :min="-180" :max="180" size="small" @input="rotate as any" />
      <span>{{ rotation }}°</span>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
