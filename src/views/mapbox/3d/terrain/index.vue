<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapbox } from '@/utils/gis/mapboxLoader'
import { createMap, rasterStyle, waitReady } from '@/utils/gis/glDemo'

const exag = ref(1.4)
const shade = ref(0.3)
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
    center: [110.35, 29.35],
    zoom: 9.4,
    pitch: 62,
    bearing: 25,
  })
  await waitReady(map)

  // 瓦片模板写在 tiles 里（url 是留给 TileJSON 的）；地形与 hillshade 用两个数据源避免告警
  const demTiles = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: demTiles,
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 13,
  })
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
      地形起伏：raster-dem 支持 mapbox / terrarium 两种编码，setTerrain 开启地形后相机会自动贴合高程，hillshade 增强山体立体感
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <span class="flex items-center gap-2">地形夸张 {{ exag.toFixed(1) }}
        <el-slider class="!w-36" :model-value="exag" :min="0" :max="3" :step="0.1" size="small" @input="applyExag as any" />
      </span>
      <span class="flex items-center gap-2">山体阴影
        <el-slider class="!w-36" :model-value="shade" :min="0" :max="1" :step="0.05" size="small" @input="applyShade as any" />
      </span>
      <el-tag size="small">Terrarium DEM · 张家界</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapbox" :init="init" />
  </div>
</template>
