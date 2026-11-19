<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const tiles = ref(0)
const zoom = ref(2)
let map: any = null

async function init(lib: any, el: HTMLElement) {
  const source = new lib.VectorTileSource({
    format: new lib.MVT(),
    url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
    maxZoom: 5,
  })
  source.on('tileloadend', () => (tiles.value += 1))

  const layer = new lib.VectorTileLayer({
    source,
    style: (feature: any) => {
      const type = feature.getType()
      if (type === 'Polygon' || type === 'MultiPolygon') {
        return new lib.Style({
          fill: new lib.Fill({ color: 'rgba(59,130,246,0.22)' }),
          stroke: new lib.Stroke({ color: '#60a5fa', width: 1 }),
        })
      }
      return new lib.Style({ stroke: new lib.Stroke({ color: '#f97316', width: 1 }) })
    },
  })

  map = createDemoMap(lib, el, { center: [10, 30], zoom: 2, maxZoom: 5, base: 'light', layers: [layer] })
  const sync = () => (zoom.value = Number(map.getView().getZoom()?.toFixed(2)))
  map.getView().on('change:resolution', sync)
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">MVT：Mapbox Vector Tile，一个瓦片承载多个图层与属性，前端按需着色，体积小、样式灵活</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-tag size="small" effect="plain">已解码瓦片 {{ tiles }}</el-tag>
      <el-tag size="small" type="info" effect="plain">当前层级 {{ zoom }}（示例服务最高 5 级）</el-tag>
      <el-tag size="small" type="success" effect="plain">ol/format/MVT</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
