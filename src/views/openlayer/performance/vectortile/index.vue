<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const showGrid = ref(true)
const zoom = ref(2)
const tiles = ref(0)

let map: any = null
let gridLayer: any = null

function toggleGrid(value: any) {
  showGrid.value = Boolean(value)
  gridLayer?.setVisible(showGrid.value)
}

async function init(lib: any, el: HTMLElement) {
  const source = new lib.VectorTileSource({
    format: new lib.MVT(),
    url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
    maxZoom: 5,
  })
  source.on('tileloadend', () => (tiles.value += 1))

  const vtLayer = new lib.VectorTileLayer({
    source,
    style: (feature: any) => {
      const type = feature.getType()
      if (type === 'Polygon' || type === 'MultiPolygon') {
        return new lib.Style({
          fill: new lib.Fill({ color: 'rgba(34,211,238,0.2)' }),
          stroke: new lib.Stroke({ color: '#67e8f9', width: 1 }),
        })
      }
      return new lib.Style({ stroke: new lib.Stroke({ color: '#f97316', width: 1 }) })
    },
  })

  gridLayer = new lib.TileLayer({
    zIndex: 99,
    source: new lib.TileDebug({ projection: 'EPSG:3857' }),
  })

  map = createDemoMap(lib, el, {
    center: [10, 30],
    zoom: 2,
    maxZoom: 5,
    base: 'light',
    layers: [vtLayer, gridLayer],
  })
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
    <p class="demo-hint">
      矢量瓦片：切片内保留几何与属性，前端实时着色；叠加 TileDebug 可直观看到瓦片网格与编号
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <el-checkbox :model-value="showGrid" size="small" @change="toggleGrid as any">显示瓦片网格</el-checkbox>
      <el-tag size="small" effect="plain">已加载 {{ tiles }} 块</el-tag>
      <el-tag size="small" type="info" effect="plain">层级 {{ zoom }}</el-tag>
      <el-tag size="small" type="success" effect="plain">VectorTileLayer + MVT</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
