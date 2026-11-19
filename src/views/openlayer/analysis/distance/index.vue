<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, formatLength } from '@/utils/gis/olDemo'

const total = ref('—')
const segments = ref(0)
const lastSegment = ref('—')

let map: any = null
let ol: any = null
let source: any = null
let draw: any = null

function refresh() {
  if (!ol) return
  let length = 0
  let segCount = 0
  let last = 0
  source.getFeatures().forEach((f: any) => {
    const geometry = f.getGeometry()
    if (geometry.getType() === 'LineString') {
      length += ol.getLength(geometry)
      const coords = geometry.getCoordinates()
      segCount += coords.length - 1
      last = ol.getDistance(coords[coords.length - 2], coords[coords.length - 1])
    }
  })
  segments.value = segCount
  total.value = formatLength(length)
  lastSegment.value = segCount ? formatLength(last) : '—'
}

function startDraw() {
  if (!map) return
  if (draw) map.removeInteraction(draw)
  draw = new ol.Draw({ source, type: 'LineString' })
  draw.on('drawend', () => {
    map.removeInteraction(draw)
    draw = null
    refresh()
  })
  map.addInteraction(draw)
}

function undo() {
  const features = source.getFeatures()
  if (features.length) source.removeFeature(features[features.length - 1])
  refresh()
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
      stroke: new lib.Stroke({ color: '#f97316', width: 3 }),
      image: new lib.CircleStyle({
        radius: 4,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 1.5 }),
      }),
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
    <p class="demo-hint">距离：ol/sphere.getLength 按椭球面计算线长度，ol/sphere.getDistance 计算两点间距离</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="startDraw">绘制线</el-button>
      <el-button size="small" @click="undo">撤销</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-tag size="small" type="success" effect="plain">总长 {{ total }}</el-tag>
      <el-tag size="small" effect="plain">段数 {{ segments }}</el-tag>
      <el-tag size="small" type="info" effect="plain">末段 {{ lastSegment }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
