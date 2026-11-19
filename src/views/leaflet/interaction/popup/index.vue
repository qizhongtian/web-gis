<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const selected = ref('未选中要素')
const autoPan = ref(true)
const closeOnClick = ref(true)

let map: any = null
let L: any = null
let popup: any = null

function html(c: { name: string; code: string; desc: string; value: number }) {
  return `<div style="min-width:150px">
    <div style="font-weight:600;font-size:13px;margin-bottom:4px">${c.name}</div>
    <div style="font-size:12px;color:#64748b;line-height:1.7">
      编码：${c.code}<br/>等级：${c.value}<br/>${c.desc}
    </div>
  </div>`
}

function toggleOptions() {
  popup?.options && (popup.options.autoPan = autoPan.value)
  popup?.options && (popup.options.closeOnClick = closeOnClick.value)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.91, 116.41], zoom: 11 })

  const items = [
    { name: '东城站', code: 'A-101', desc: '客流平稳', value: 3, latlng: [39.94, 116.42] as [number, number] },
    { name: '西城站', code: 'A-102', desc: '客流偏高', value: 5, latlng: [39.91, 116.36] as [number, number] },
    { name: '南苑站', code: 'B-201', desc: '设备检修中', value: 1, latlng: [39.86, 116.4] as [number, number] },
  ]

  items.forEach((c) => {
    const marker = L.marker(c.latlng).addTo(map)
    marker.bindTooltip(c.name, { direction: 'top', offset: [0, -12] })
    marker.bindPopup(html(c), { maxWidth: 240, autoPan: autoPan.value, closeOnClick: closeOnClick.value })
    marker.on('click', () => {
      selected.value = `${c.name} · ${c.code} · 等级 ${c.value}`
    })
  })

  // 独立 popup：不挂在标记上，可用于「点击地图任意位置弹信息」
  popup = L.popup({ autoPan: autoPan.value, closeOnClick: closeOnClick.value })
  map.on('click', (e: any) => {
    popup
      .setLatLng(e.latlng)
      .setContent(
        `<div style="font-size:12px;line-height:1.7">地图点击位置<br/>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</div>`,
      )
      .openOn(map)
    selected.value = `地图点击 ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
  })

  map.on('popupclose', () => {
    selected.value = '未选中要素'
  })

  return () => {
    map?.remove()
    map = null
    popup = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">弹窗：bindPopup 绑定要素、独立 L.popup 跟随点击，配合 tooltip 做悬停提示</p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox v-model="autoPan" size="small" @change="toggleOptions">自动平移避免遮挡</el-checkbox>
      <el-checkbox v-model="closeOnClick" size="small" @change="toggleOptions">点击地图关闭</el-checkbox>
      <el-tag size="small" effect="plain" type="info">{{ selected }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
