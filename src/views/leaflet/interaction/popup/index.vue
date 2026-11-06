<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'

const selected = ref('')

async function init(L: any, el: HTMLElement) {
  const map = L.map(el).setView([34.5, 112.5], 5)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  const cities = [
    { name: '北京', code: '110000', latlng: [39.9042, 116.4074], desc: '政治文化中心' },
    { name: '上海', code: '310000', latlng: [31.2304, 121.4737], desc: '国际经济金融中心' },
    { name: '广州', code: '440100', latlng: [23.1291, 113.2644], desc: '粤港澳大湾区核心城市' },
    { name: '成都', code: '510100', latlng: [30.5728, 104.0668], desc: '天府之国 · 西部枢纽' },
  ]

  cities.forEach((c) => {
    const marker = L.marker(c.latlng).addTo(map)
    marker.bindTooltip(c.name, { direction: 'top', offset: [0, -10] })
    marker.bindPopup(`<b>${c.name}</b><br/>行政区划代码：${c.code}<br/>${c.desc}`)
    marker.on('click', () => {
      selected.value = JSON.stringify({ name: c.name, code: c.code, desc: c.desc })
    })
  })

  map.on('popupclose', () => {
    selected.value = ''
  })

  return () => map.remove()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">要素交互：点击 Marker 弹出 Popup / Tooltip，并读取要素属性</p>
    <el-tag v-if="selected" class="w-fit max-w-full" effect="dark" type="warning">{{ selected }}</el-tag>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
