<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const hits = ref<string[]>([])
const total = ref(0)

let map: any = null
let ol: any = null
let source: any = null
let boxSource: any = null
let draw: any = null

const categories = ['餐饮', '学校', '医院', '商场', '公园']

function reset() {
  hits.value = []
  boxSource.clear()
  source.getFeatures().forEach((f: any) => f.set('hit', false))
  source.changed()
  startDraw()
}

function startDraw() {
  if (!map || !ol) return
  if (draw) map.removeInteraction(draw)
  draw = new ol.Draw({
    source: boxSource,
    type: 'Circle',
    geometryFunction: ol.createBox(),
  })
  draw.on('drawend', (e: any) => {
    map.removeInteraction(draw)
    draw = null
    const extent = e.feature.getGeometry().getExtent()
    const hitNames: string[] = []
    source.getFeatures().forEach((f: any) => f.set('hit', false))
    source.forEachFeatureIntersectingExtent(extent, (f: any) => {
      f.set('hit', true)
      hitNames.push(String(f.get('name')))
    })
    source.changed()
    hits.value = hitNames
    total.value = hitNames.length
  })
  map.addInteraction(draw)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  boxSource = new lib.VectorSource()

  source.addFeatures(
    randomPoints(lib, 200, [116.15, 39.72, 116.7, 40.12], (i) => ({
      name: `POI-${i + 1}`,
      type: categories[i % categories.length],
      hit: false,
    })),
  )

  const poiLayer = new lib.VectorLayer({
    source,
    style: (feature: any) =>
      new lib.Style({
        image: new lib.CircleStyle({
          radius: feature.get('hit') ? 7 : 4,
          fill: new lib.Fill({ color: feature.get('hit') ? '#f97316' : '#22d3ee' }),
          stroke: new lib.Stroke({ color: '#fff', width: feature.get('hit') ? 2 : 1 }),
        }),
      }),
  })

  const boxLayer = new lib.VectorLayer({
    source: boxSource,
    zIndex: 20,
    style: new lib.Style({
      fill: new lib.Fill({ color: 'rgba(249,115,22,0.1)' }),
      stroke: new lib.Stroke({ color: '#f97316', width: 2, lineDash: [6, 6] }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 11, base: 'light', layers: [poiLayer, boxLayer] })
  startDraw()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">空间查询：框选范围后 source.forEachFeatureIntersectingExtent 做空间过滤，命中要素高亮</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="startDraw">重新框选</el-button>
      <el-button size="small" @click="reset">重置</el-button>
      <el-tag size="small" type="success" effect="plain">命中 {{ total }} 个</el-tag>
      <el-tag v-for="name in hits.slice(0, 8)" :key="name" size="small" type="info" effect="plain">{{ name }}</el-tag>
      <el-tag v-if="hits.length > 8" size="small" effect="plain">…</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
