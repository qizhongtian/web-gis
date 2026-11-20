<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { createMap, rasterStyle, waitReady } from '@/utils/gis/glDemo'

const exag = ref(1.5)
const shade = ref(0.35)
let map: any = null

function applyExag(v: number) {
  exag.value = v
  map?.setTerrain({ source: 'dem', exaggeration: v })
}

function applyShade(v: number) {
  shade.value = v
  map?.setPaintProperty('hills', 'hillshade-exaggeration', v)
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, {
    style: rasterStyle('topo'),
    center: [103.35, 30.95],
    zoom: 8.6,
    pitch: 62,
    bearing: -18,
  })
  await waitReady(map)

  // Terrarium 编码的公开 DEM 瓦片，MapLibre / Mapbox 都支持
  // 注意：瓦片模板要写在 tiles 里（url 是留给 TileJSON 的）
  const demTiles = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: demTiles,
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 13,
  })
  // 地形与 hillshade 各自一个数据源，避免同源导致的渲染质量告警
  map.addSource('dem-shade', {
    type: 'raster-dem',
    tiles: demTiles,
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 13,
  })
  map.addLayer({
    id: 'hills',
    type: 'hillshade',
    source: 'dem-shade',
    paint: { 'hillshade-exaggeration': shade.value, 'hillshade-shadow-color': '#475569' },
  })
  map.setTerrain({ source: 'dem', exaggeration: exag.value })

  return () => {
    map?.remove()
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      地形起伏：raster-dem 高程瓦片 + setTerrain 生成真实地形，hillshade 图层负责山体明暗，夸张系数决定立体感强弱
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <span class="flex items-center gap-2">地形夸张 {{ exag.toFixed(1) }}
        <el-slider class="!w-36" :model-value="exag" :min="0" :max="3" :step="0.1" size="small" @input="applyExag as any" />
      </span>
      <span class="flex items-center gap-2">山体阴影
        <el-slider class="!w-36" :model-value="shade" :min="0" :max="1" :step="0.05" size="small" @input="applyShade as any" />
      </span>
      <el-tag size="small">Terrarium DEM · 川西山地</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
