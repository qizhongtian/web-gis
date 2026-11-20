<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, seeded, waitReady } from '@/utils/gis/glDemo'

const count = ref(0)
const hint = ref('点击地图任意位置添加标注')
let map: any = null
let glib: any = null
let markers: any[] = []
const rnd = seeded(11)

function addMarker(lngLat: [number, number], color = '#22d3ee', text = '监控点') {
  const marker = new glib.Marker({ color, scale: 1.1, draggable: true })
    .setLngLat(lngLat)
    .setPopup(
      new glib.Popup({ offset: 20 }).setHTML(
        `<b>${text}</b><br/>${lngLat[0].toFixed(4)}, ${lngLat[1].toFixed(4)}<br/><span style="color:#64748b">可拖拽移动</span>`,
      ),
    )
    .addTo(map)
  markers.push(marker)
  count.value = markers.length
}

function addRandom() {
  if (!map) return
  const c = map.getCenter()
  addMarker([c.lng + (rnd() - 0.5) * 0.12, c.lat + (rnd() - 0.5) * 0.08], '#f97316', '临时布控')
}

function clearAll() {
  markers.forEach((m) => m.remove())
  markers = []
  count.value = 0
}

async function init(lib: any, el: HTMLElement) {
  glib = lib
  map = createMap(lib, el, { base: 'light', center: [121.4737, 31.2304], zoom: 10 })
  await waitReady(map)

  addMarker([121.4737, 31.2304], '#22d3ee', '中心监控点')
  addMarker([121.43, 31.26], '#a855f7', '北部分站')

  map.on('click', (e: any) => {
    addMarker([e.lngLat.lng, e.lngLat.lat], '#f43f5e', '新增点位')
    hint.value = `已添加 ${count.value} 个标注`
  })

  return () => {
    clearAll()
    map?.remove()
    map = null
    glib = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      标记与弹窗：Marker 支持自定义 DOM 元素、拖拽与旋转对齐，Popup 可绑定到 Marker 或独立打开
    </p>
    <div class="flex items-center gap-2 flex-wrap text-[12px] text-[#64748b]">
      <el-tag size="small" type="info">标注 {{ count }} 个</el-tag>
      <el-button size="small" @click="addRandom">随机添加</el-button>
      <el-button size="small" @click="clearAll">清空标注</el-button>
      <span>{{ hint }}</span>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
