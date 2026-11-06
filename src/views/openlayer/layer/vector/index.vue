<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'

async function init(ol: any, el: HTMLElement) {
  const { Map, View, TileLayer, VectorLayer, VectorSource, OSM, GeoJSON, Style, Stroke, Fill, CircleStyle, fromLonLat } = ol

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '北京' },
        geometry: { type: 'Point', coordinates: [116.407, 39.904] },
      },
      {
        type: 'Feature',
        properties: { name: '上海' },
        geometry: { type: 'Point', coordinates: [121.473, 31.23] },
      },
      {
        type: 'Feature',
        properties: { name: '区域' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[114, 34], [120, 34], [120, 30], [114, 30], [114, 34]]],
        },
      },
    ],
  }

  const vectorLayer = new VectorLayer({
    source: new VectorSource({ features: new GeoJSON().readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }) }),
    style: new Style({
      stroke: new Stroke({ color: '#22d3ee', width: 2 }),
      fill: new Fill({ color: 'rgba(34,211,238,0.2)' }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#f97316' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  const map = new Map({
    target: el,
    layers: [new TileLayer({ source: new OSM() }), vectorLayer],
    view: new View({ center: fromLonLat([116.5, 32]), zoom: 5 }),
  })
  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">矢量图层：VectorLayer + GeoJSON 要素 + Style 样式（点 / 面）</p>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
