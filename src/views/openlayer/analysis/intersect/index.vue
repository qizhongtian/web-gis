<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const count = ref(0)
const message = ref('在地图上绘制一条线，计算它与蓝色面要素的交点')

let map: any = null
let ol: any = null
let hitSource: any = null
let source: any = null

type Coord = [number, number]

/** 线段相交：返回交点坐标，不相交返回 null */
function segmentIntersect(a: Coord, b: Coord, c: Coord, d: Coord): Coord | null {
  const r = [b[0] - a[0], b[1] - a[1]]
  const s = [d[0] - c[0], d[1] - c[1]]
  const denom = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(denom) < 1e-9) return null
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return [a[0] + t * r[0], a[1] + t * r[1]]
}

function computeIntersections(line: any) {
  const polygon = source.getFeatures()[0].getGeometry()
  const rings = polygon.getCoordinates()
  const points: Coord[] = []
  const lineCoords = line.getCoordinates() as Coord[]
  for (let i = 0; i < lineCoords.length - 1; i++) {
    for (const ring of rings) {
      for (let j = 0; j < ring.length - 1; j++) {
        const p = segmentIntersect(lineCoords[i], lineCoords[i + 1], ring[j] as Coord, ring[j + 1] as Coord)
        if (p) points.push(p)
      }
    }
  }
  hitSource.clear()
  points.forEach((p) => hitSource.addFeature(new ol.Feature(new ol.Point(p))))
  count.value = points.length
  message.value = points.length ? `相交：${points.length} 个交点，已用红色标记` : '未相交（线未穿过面）'
}

function clearLines() {
  source.getFeatures().slice(1).forEach((f: any) => source.removeFeature(f))
  hitSource.clear()
  count.value = 0
  message.value = '已清空绘制的线'
}

let draw: any = null

function startDraw() {
  if (!map) return
  if (draw) map.removeInteraction(draw)
  draw = new ol.Draw({ source, type: 'LineString' })
  draw.on('drawend', (e: any) => {
    map.removeInteraction(draw)
    draw = null
    computeIntersections(e.feature.getGeometry())
  })
  map.addInteraction(draw)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  hitSource = new lib.VectorSource()

  source.addFeature(
    new lib.Feature(lib.polygonFromExtent(lib.transformExtent([116.25, 39.84, 116.58, 40.02], 'EPSG:4326', 'EPSG:3857'))),
  )

  const hitLayer = new lib.VectorLayer({
    source: hitSource,
    zIndex: 20,
    style: new lib.Style({
      image: new lib.CircleStyle({
        radius: 6,
        fill: new lib.Fill({ color: '#ef4444' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  // 线用单独图层，避免被面的样式覆盖
  const lineLayer = new lib.VectorLayer({
    source,
    zIndex: 15,
    style: (feature: any) => {
      if (feature.getGeometry().getType() === 'LineString') {
        return new lib.Style({ stroke: new lib.Stroke({ color: '#f97316', width: 3 }) })
      }
      return new lib.Style({
        fill: new lib.Fill({ color: 'rgba(59,130,246,0.18)' }),
        stroke: new lib.Stroke({ color: '#3b82f6', width: 2 }),
      })
    },
  })

  map = createDemoMap(lib, el, {
    center: [116.4, 39.93],
    zoom: 11,
    base: 'light',
    layers: [lineLayer, hitLayer],
  })
  startDraw()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">相交：线要素与面要素求交（逐段求交算法），得到交点集合；实际操作可用 turf.lineIntersect / JSTS</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="startDraw">绘制线</el-button>
      <el-button size="small" @click="clearLines">清空</el-button>
      <el-tag size="small" effect="plain">交点数 {{ count }}</el-tag>
      <el-tag size="small" type="info" effect="plain">{{ message }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
