<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { bufferPolygon, createDemoMap, formatArea } from '@/utils/gis/olDemo'

const radius = ref(3000)
const areaText = ref('')

let map: any = null
let ol: any = null
let source: any = null
let bufferSource: any = null
let polygonFeature: any = null

/** 简化版缓冲：顶点外法线偏移；生产建议用 turf.buffer / JSTS */
function redraw() {
  if (!ol || !polygonFeature) return
  bufferSource.clear()
  const geometry = polygonFeature.getGeometry()
  if (geometry.getType() !== 'Polygon') return
  const buffered = bufferPolygon(ol, geometry, radius.value)
  bufferSource.addFeature(new ol.Feature(buffered))
  areaText.value = `缓冲半径 ${radius.value} m · 缓冲面积 ${formatArea(ol.getArea(buffered))}`
}

function onRadius(value: any) {
  radius.value = value
  redraw()
}

function startDraw() {
  if (!map) return
  const draw = new ol.Draw({ source, type: 'Polygon' })
  draw.on('drawend', (e: any) => {
    polygonFeature = e.feature
    source.clear()
    source.addFeature(polygonFeature)
    map.removeInteraction(draw)
    redraw()
  })
  map.addInteraction(draw)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  bufferSource = new lib.VectorSource()

  polygonFeature = new lib.Feature(
    lib.polygonFromExtent(lib.transformExtent([116.28, 39.86, 116.5, 40.0], 'EPSG:4326', 'EPSG:3857')),
  )
  source.addFeature(polygonFeature)
  redraw()

  const bufferLayer = new lib.VectorLayer({
    source: bufferSource,
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(249,115,22,0.16)' }),
      stroke: new lib.Stroke({ color: '#f97316', width: 2, lineDash: [6, 6] }),
    }),
  })
  const sourceLayer = new lib.VectorLayer({
    source,
    zIndex: 10,
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(59,130,246,0.2)' }),
      stroke: new lib.Stroke({ color: '#3b82f6', width: 2 }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.39, 39.93], zoom: 11, base: 'light', layers: [bufferLayer, sourceLayer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">缓冲区：以面要素外扩指定距离生成缓冲面，可用于服务半径、影响范围分析（示例为简化算法）</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-button size="small" type="primary" @click="startDraw">重新绘制面</el-button>
      <span class="text-[12px] text-[#64748b]">缓冲距离</span>
      <el-slider class="max-w-40" :model-value="radius" :min="500" :max="10000" :step="500" size="small" @input="onRadius" />
      <el-tag size="small" type="success" effect="plain">{{ areaText }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
