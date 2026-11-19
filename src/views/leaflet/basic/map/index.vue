<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'

const cities: { name: string; latlng: [number, number]; zoom: number }[] = [
  { name: '北京', latlng: [39.9042, 116.4074], zoom: 11 },
  { name: '上海', latlng: [31.2304, 121.4737], zoom: 11 },
  { name: '广州', latlng: [23.1291, 113.2644], zoom: 11 },
  { name: '成都', latlng: [30.5728, 104.0668], zoom: 11 },
]

let map: any = null

function goto(city: (typeof cities)[number]) {
  map?.setView(city.latlng, city.zoom, { animate: true })
}

function reset() {
  map?.setView([39.9042, 116.4074], 10)
  map?.closePopup()
}

async function init(L: any, el: HTMLElement) {
  map = createDemoMap(L, el, { center: [39.9042, 116.4074], zoom: 10 })

  // 视图信息随地图变化同步到 tooltip，直观看到 setView 的结果
  const marker = L.marker([39.9042, 116.4074]).addTo(map)
  marker.bindTooltip('默认中心：北京', { permanent: true, direction: 'top', offset: [0, -10] })

  const info = L.control({ position: 'topright' })
  info.onAdd = () => {
    const div = L.DomUtil.create('div', 'leaflet-bar')
    div.style.cssText = 'padding:6px 8px;background:#fff;font-size:12px;color:#334155'
    const render = () => {
      const c = map.getCenter()
      div.innerHTML = `中心 ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}<br/>层级 ${map.getZoom()}`
    }
    map.on('moveend zoomend', render)
    render()
    return div
  }
  info.addTo(map)

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">地图初始化：L.map + setView，配置缩放、比例尺控件，右上角实时显示中心点与层级</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button v-for="c in cities" :key="c.name" size="small" @click="goto(c)">{{ c.name }}</el-button>
      <el-button size="small" type="primary" plain @click="reset">回到默认</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
