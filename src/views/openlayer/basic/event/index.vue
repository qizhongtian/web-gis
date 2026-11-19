<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const hover = ref('移动鼠标查看坐标')
const logs = ref<string[]>([])
let map: any = null
let ol: any = null
let keys: any[] = []

function push(text: string) {
  logs.value = [`${new Date().toLocaleTimeString()} ${text}`, ...logs.value].slice(0, 8)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10 })

  const popupEl = document.createElement('div')
  popupEl.style.cssText =
    'padding:6px 10px;border-radius:8px;background:#fff;color:#0f172a;font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.18);white-space:nowrap;'
  const overlay = new lib.Overlay({ element: popupEl, autoPan: true, offset: [0, -12] })
  map.addOverlay(overlay)

  keys.push(
    map.on('singleclick', (e: any) => {
      const c = lib.toLonLat(e.coordinate)
      const text = `${c[0].toFixed(4)}, ${c[1].toFixed(4)}`
      popupEl.textContent = text
      overlay.setPosition(e.coordinate)
      push(`singleclick ${text}`)
    }),
  )
  keys.push(
    map.on('dblclick', () => {
      overlay.setPosition(undefined)
      push('dblclick 关闭弹窗')
    }),
  )
  keys.push(
    map.on('pointermove', (e: any) => {
      const c = lib.toLonLat(e.coordinate)
      hover.value = `指针坐标 ${c[0].toFixed(4)}, ${c[1].toFixed(4)}`
    }),
  )
  keys.push(
    map.on('movestart', () => push('movestart 开始拖动')),
  )
  keys.push(
    map.on('moveend', () => {
      push(`moveend 层级 ${map.getView().getZoom()?.toFixed(2)}`)
    }),
  )

  return () => {
    keys.forEach((k) => lib.unByKey(k))
    keys = []
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">地图事件：map.on 监听单击、双击、鼠标移动与视图变化，Overlay 承载点击弹窗</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" effect="plain">{{ hover }}</el-tag>
      <el-tag v-for="(log, i) in logs.slice(0, 3)" :key="i" size="small" type="info" effect="plain">{{ log }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
