<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const layers = shallowRef<any[]>([])
const checked = ref(['Point', 'LineString', 'Polygon'])
const info = ref('点击地图上的图形查看几何信息')
let map: any = null

function toggle() {
  layers.value.forEach((item: any) => item.layer.setVisible(checked.value.includes(item.type)))
}

function labelStyle(lib: any, color: string) {
  return new lib.Style({
    stroke: new lib.Stroke({ color, width: 3 }),
    fill: new lib.Fill({ color: `${color}33` }),
    image: new lib.CircleStyle({
      radius: 7,
      fill: new lib.Fill({ color }),
      stroke: new lib.Stroke({ color: '#fff', width: 2 }),
    }),
    text: new lib.Text({
      text: '',
      font: '12px sans-serif',
      fill: new lib.Fill({ color: '#0f172a' }),
      offsetY: -18,
      backgroundFill: new lib.Fill({ color: 'rgba(255,255,255,0.8)' }),
      padding: [2, 4, 2, 4],
    }),
  })
}

async function init(lib: any, el: HTMLElement) {
  const { Feature, Point, LineString, Polygon, VectorSource, VectorLayer, Fill, Text } = lib

  const make = (type: string, feature: any, color: string) => {
    const style = labelStyle(lib, color)
    style.setText(
      new Text({
        text: feature.get('name'),
        font: '12px sans-serif',
        fill: new Fill({ color: '#0f172a' }),
        offsetY: -18,
        backgroundFill: new Fill({ color: 'rgba(255,255,255,0.85)' }),
        padding: [2, 5, 2, 5],
      }),
    )
    const layer = new VectorLayer({ source: new VectorSource({ features: [feature] }), style })
    layers.value = [...layers.value, { type, layer }]
    return layer
  }

  const point = new Feature({
    name: '点 Point',
    geometry: new Point(lib.fromLonLat([116.33, 39.95])),
  })
  const line = new Feature({
    name: '线 LineString',
    geometry: new LineString([lib.fromLonLat([116.3, 39.85]), lib.fromLonLat([116.45, 39.9]), lib.fromLonLat([116.6, 39.86])]),
  })
  const polygon = new Feature({
    name: '面 Polygon',
    geometry: new Polygon([
      [
        lib.fromLonLat([116.35, 40.0]),
        lib.fromLonLat([116.55, 40.0]),
        lib.fromLonLat([116.55, 40.1]),
        lib.fromLonLat([116.35, 40.1]),
        lib.fromLonLat([116.35, 40.0]),
      ],
    ]),
  })

  const pointLayer = make('Point', point, '#f97316')
  const lineLayer = make('LineString', line, '#22d3ee')
  const polygonLayer = make('Polygon', polygon, '#3b82f6')

  map = createDemoMap(lib, el, {
    center: [116.45, 39.98],
    zoom: 11,
    base: 'light',
    layers: [polygonLayer, lineLayer, pointLayer],
  })

  map.on('singleclick', (e: any) => {
    map.forEachFeatureAtPixel(e.pixel, (f: any) => {
      const g = f.getGeometry()
      info.value = `${g.getType()} · ${f.get('name')} · 顶点数 ${
        g.getType() === 'Point' ? 1 : (g.getCoordinates()[0]?.length ?? g.getCoordinates().length)
      }`
    })
  })

  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">点线面：Feature + Point / LineString / Polygon 三种几何，Text 样式渲染标注</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-checkbox-group v-model="checked" size="small" @change="toggle">
        <el-checkbox v-for="item in layers" :key="item.type" :value="item.type">{{ item.type }}</el-checkbox>
      </el-checkbox-group>
      <el-tag size="small" effect="plain">{{ info }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
