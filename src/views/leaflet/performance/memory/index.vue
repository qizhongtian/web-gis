<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const layerCount = ref(0)
const listenerCount = ref(0)
const heap = ref('-')
const note = ref('尚未创建图层')

let map: any = null
let L: any = null
let group: any = null
let offs: (() => void)[] = []
let timer = 0

function readHeap() {
  const mem = (performance as any).memory
  heap.value = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB` : '当前浏览器不暴露内存值'
}

function addBatch(n = 2000) {
  if (!map || !group) return
  const t0 = performance.now()
  randomPoints(n, [116.15, 39.72, 116.62, 40.06], Date.now() % 1000).forEach((p) => {
    group.addLayer(
      L.circleMarker(p, { radius: 3, stroke: false, fillColor: '#22d3ee', fillOpacity: 0.8 }),
    )
  })
  // 演示监听器也要登记，否则销毁后仍被引用
  const m = L.marker(randomPoints(1, [116.15, 39.72, 116.62, 40.06], 5)[0]).addTo(group)
  const handler = () => {}
  m.on('click', handler)
  offs.push(() => m.off('click', handler))

  layerCount.value = group.getLayers().length
  listenerCount.value = offs.length
  note.value = `新增 ${n} 个要素，耗时 ${Math.round(performance.now() - t0)}ms`
  readHeap()
}

function destroyAll() {
  if (!map) return
  if (group) {
    group.clearLayers()
    map.removeLayer(group)
    group = null
  }
  offs.forEach((off) => off())
  offs = []
  layerCount.value = 0
  listenerCount.value = 0
  note.value = '已移除图层并解绑监听器，内存需等 GC 回收'
  readHeap()
}

function recreate() {
  if (!map || group) return
  group = L.layerGroup().addTo(map)
  note.value = '图层组已重建'
  addBatch(500)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.89, 116.4], zoom: 11 })
  group = L.layerGroup().addTo(map)
  readHeap()
  timer = window.setInterval(readHeap, 1500)
  return () => {
    window.clearInterval(timer)
    offs.forEach((off) => off())
    offs = []
    map?.remove()
    map = null
    group = null
  }
}

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      内存管理：图层移除后还要解绑事件、置空引用，否则闭包一直持有 DOM 与数据；内存值需 Chrome 才可读
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="addBatch(2000)">+2000 要素</el-button>
      <el-button size="small" type="danger" plain @click="destroyAll">移除并解绑</el-button>
      <el-button size="small" @click="recreate">重建图层组</el-button>
      <el-tag size="small" effect="plain" type="info">要素 {{ layerCount }}</el-tag>
      <el-tag size="small" effect="plain" type="warning">监听器 {{ listenerCount }}</el-tag>
      <el-tag size="small" effect="plain" type="success">堆 {{ heap }}</el-tag>
    </div>
    <p class="text-[12px] text-[#6b7280]">{{ note }}</p>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
