<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

interface LogItem {
  time: string
  name: string
  detail: string
}

const logs = ref<LogItem[]>([])
const trackMove = ref(false)

let map: any = null
let L: any = null
let lastMove = 0

function push(name: string, detail: string) {
  const d = new Date()
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds(),
  ).padStart(2, '0')}`
  logs.value = [{ time, name, detail }, ...logs.value].slice(0, 12)
}

function clear() {
  logs.value = []
}

function toggleMove(value: any) {
  trackMove.value = Boolean(value)
  if (!trackMove.value) push('mousemove', '已停止记录')
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.92, 116.42], zoom: 11 })

  // 地图事件
  map.on('click', (e: any) => push('click', `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`))
  map.on('dblclick', (e: any) => push('dblclick', `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`))
  map.on('contextmenu', (e: any) => push('contextmenu', `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`))
  map.on('zoomend', () => push('zoomend', `zoom = ${map.getZoom()}`))
  map.on('moveend', () => {
    const c = map.getCenter()
    push('moveend', `中心 ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`)
  })
  map.on('mousemove', (e: any) => {
    if (!trackMove.value) return
    // mousemove 频率极高，节流后再写日志
    const now = performance.now()
    if (now - lastMove < 300) return
    lastMove = now
    push('mousemove', `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`)
  })

  // 图层事件：marker 自带 click / mouseover / dragend
  const marker = L.marker([39.93, 116.4], { draggable: true }).addTo(map)
  marker.on('click', () => push('marker:click', '点击标记'))
  marker.on('mouseover', () => push('marker:mouseover', '悬停标记'))
  marker.on('dragend', (e: any) => {
    const ll = e.target.getLatLng()
    push('marker:dragend', `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`)
  })

  push('ready', '地图初始化完成')

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">事件监听：map.on 绑定地图事件，图层自身也能绑定 click / dragend；高频 mousemove 需节流</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="trackMove" size="small" @change="toggleMove as any">记录 mousemove（300ms 节流）</el-checkbox>
      <el-button size="small" @click="clear">清空日志</el-button>
      <el-tag size="small" effect="plain" type="info">{{ logs.length }} 条</el-tag>
    </div>
    <div class="max-h-24 overflow-auto rounded border border-[#e6e8eb] bg-[#fafbfc] px-2 py-1">
      <div v-if="!logs.length" class="text-[12px] text-[#9ca3af] py-1">点击 / 拖动 / 缩放地图试试</div>
      <div v-for="(l, i) in logs" :key="i" class="text-[12px] font-mono text-[#475569] leading-5">
        <span class="text-[#94a3b8]">{{ l.time }}</span>
        <span class="mx-1 text-[#0ea5e9]">{{ l.name }}</span>
        <span>{{ l.detail }}</span>
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
