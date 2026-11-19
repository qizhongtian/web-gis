<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, formatArea } from '@/utils/gis/olDemo'

const total = ref('—')
const polygonCount = ref(0)
const lastArea = ref('—')

let map: any = null
let ol: any = null
let source: any = null
let draw: any = null

function refresh() {
  if (!ol) return
  let sum = 0
  let count = 0
  let last = 0
  source.getFeatures().forEach((f: any) => {
    const geometry = f.getGeometry()
    if (geometry.getType() === 'Polygon') {
      const area = ol.getArea(geometry)
      sum += area
      last = area
      count += 1
    }
  })
  total.value = formatArea(sum)
  polygonCount.value = count
  lastArea.value = count ? formatArea(last) : '—'
}

function startDraw() {
  if (!map) return
  if (draw) map.removeInteraction(draw)
  draw = new ol.Draw({ source, type: 'Polygon' })
  draw.on('drawend', () => {
    map.removeInteraction(draw)
    draw = null
    refresh()
  })
  map.addInteraction(draw)
}

function clearAll() {
  source.clear()
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  source.on('addfeature', refresh)
  source.on('removefeature', refresh)

  const layer = new lib.VectorLayer({
    source,
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.22)' }),
      stroke: new lib.Stroke({ color: '#0891b2', width: 2 }),
      image: new lib.CircleStyle({ radius: 4, fill: new lib.Fill({ color: '#0891b2' }) }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 12, base: 'light', layers: [layer] })
  startDraw()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">面积：ol/sphere.getArea 按椭球面计算面要素面积，多面自动累加</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="startDraw">绘制面</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-tag size="small" type="success" effect="plain">总面积 {{ total }}</el-tag>
      <el-tag size="small" effect="plain">面数 {{ polygonCount }}</el-tag>
      <el-tag size="small" type="info" effect="plain">最近一个 {{ lastArea }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
