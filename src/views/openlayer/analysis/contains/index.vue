<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const inside = ref(0)
const outside = ref(0)
const clickInfo = ref('点击地图任意位置，判断是否落在面内')

let map: any = null
let ol: any = null
let source: any = null
let polygonFeature: any = null

function updateStats() {
  let inCount = 0
  const polygon = polygonFeature.getGeometry()
  source.getFeatures().forEach((f: any) => {
    const hit = polygon.containsXY(f.getGeometry().getCoordinates())
    f.set('hit', hit)
    if (hit) inCount += 1
  })
  inside.value = inCount
  outside.value = source.getFeatures().length - inCount
  source.changed()
}

function regenerate() {
  source.clear()
  source.addFeatures(
    randomPoints(ol, 400, [116.1, 39.72, 116.7, 40.1], (i) => ({ name: `POI-${i + 1}` })),
  )
  updateStats()
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  polygonFeature = new lib.Feature(
    lib.polygonFromExtent(lib.transformExtent([116.28, 39.82, 116.56, 40.02], 'EPSG:4326', 'EPSG:3857')),
  )
  source.addFeature(polygonFeature)
  source.addFeatures(randomPoints(lib, 400, [116.1, 39.72, 116.7, 40.1], (i) => ({ name: `POI-${i + 1}` })))

  const layer = new lib.VectorLayer({
    source,
    style: (feature: any) => {
      if (feature.getGeometry().getType() === 'Polygon') {
        return new lib.Style({
          fill: new lib.Fill({ color: 'rgba(59,130,246,0.18)' }),
          stroke: new lib.Stroke({ color: '#3b82f6', width: 2, lineDash: [8, 6] }),
        })
      }
      return new lib.Style({
        image: new lib.CircleStyle({
          radius: 4,
          fill: new lib.Fill({ color: feature.get('hit') ? '#22c55e' : '#94a3b8' }),
          stroke: new lib.Stroke({ color: '#fff', width: 1 }),
        }),
      })
    },
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 11, base: 'light', layers: [layer] })

  map.on('singleclick', (e: any) => {
    const hit = polygonFeature.getGeometry().containsXY(e.coordinate)
    clickInfo.value = hit ? '该点位于面要素内部 ✔' : '该点位于面要素外部 ✘'
  })

  updateStats()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">包含：Polygon.containsXY 逐点判断，绿色为面内点、灰色为面外点，是点面叠加统计的基础</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="regenerate">重新生成点位</el-button>
      <el-tag size="small" type="success" effect="plain">面内 {{ inside }}</el-tag>
      <el-tag size="small" type="info" effect="plain">面外 {{ outside }}</el-tag>
      <el-tag size="small" effect="plain">{{ clickInfo }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
