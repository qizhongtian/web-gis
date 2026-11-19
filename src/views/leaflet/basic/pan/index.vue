<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const centerText = ref('39.9042, 116.4074')
const dragging = ref(true)
const autoBack = ref(false)

let map: any = null
let timer: number | null = null

function panToCity(name: string, latlng: [number, number]) {
  map?.panTo(latlng, { animate: true, duration: 0.8 })
  centerText.value = `${name} ${latlng[0]}, ${latlng[1]}`
}

function fly() {
  map?.flyTo([22.3193, 114.1694], 11, { duration: 1.8 })
}

function panBy() {
  map?.panBy([160, 120], { animate: true })
}

function reset() {
  map?.setView([39.9042, 116.4074], 9, { animate: true })
}

function toggleDragging(value: any) {
  dragging.value = Boolean(value)
  if (!map) return
  dragging.value ? map.dragging.enable() : map.dragging.disable()
}

function toggleAuto(value: any) {
  autoBack.value = Boolean(value)
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
  if (autoBack.value) {
    // 定时把视图拉回中心，模拟车载终端的「锁车」效果
    timer = window.setInterval(() => {
      map?.panTo([39.9042, 116.4074], { animate: true, duration: 0.6 })
    }, 4000)
  }
}

async function init(L: any, el: HTMLElement) {
  map = createDemoMap(L, el, { center: [39.9042, 116.4074], zoom: 9 })
  L.marker([39.9042, 116.4074]).addTo(map).bindPopup('默认中心')
  L.marker([22.3193, 114.1694]).addTo(map).bindPopup('香港')

  const info = L.control({ position: 'bottomleft' })
  info.onAdd = () => {
    const div = L.DomUtil.create('div')
    div.style.cssText =
      'padding:6px 8px;background:rgba(255,255,255,.92);font-size:12px;color:#334155;border-radius:4px'
    const render = () => {
      const c = map.getCenter()
      centerText.value = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`
      div.innerHTML = `当前中心 ${centerText.value}`
    }
    map.on('move', render)
    render()
    return div
  }
  info.addTo(map)

  return () => {
    if (timer) window.clearInterval(timer)
    timer = null
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">平移定位：panTo / panBy / flyTo / setView 的区别，以及拖动与「自动回中心」开关</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" @click="panToCity('北京', [39.9042, 116.4074])">panTo 北京</el-button>
      <el-button size="small" @click="panToCity('上海', [31.2304, 121.4737])">panTo 上海</el-button>
      <el-button size="small" type="primary" plain @click="fly">flyTo 香港</el-button>
      <el-button size="small" @click="panBy">panBy 位移</el-button>
      <el-button size="small" @click="reset">重置视图</el-button>
    </div>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox :model-value="dragging" size="small" @change="toggleDragging as any">允许拖动</el-checkbox>
      <el-checkbox :model-value="autoBack" size="small" @change="toggleAuto as any">每 4s 自动回中心</el-checkbox>
      <el-tag size="small" effect="plain" type="info">中心 {{ centerText }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
