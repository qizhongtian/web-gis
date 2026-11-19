<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const opacity = ref(1)
const matrixSet = ref('EPSG:3857')
let wmtsLayer: any = null

function applyOpacity(value: any) {
  opacity.value = value
  wmtsLayer?.setOpacity(value)
}

async function init(lib: any, el: HTMLElement) {
  const projection = lib.get('EPSG:3857')
  const projectionExtent = projection.getExtent()
  const size = lib.getWidth(projectionExtent) / 256
  const resolutions: number[] = []
  const matrixIds: string[] = []
  for (let z = 0; z < 14; z++) {
    resolutions[z] = size / Math.pow(2, z)
    matrixIds[z] = String(z)
  }

  const source = new lib.WMTS({
    url: 'https://ahocevar.com/geoserver/gwc/service/wmts',
    layer: 'ne:NE1_HR_LC_SR_W_DR',
    matrixSet: matrixSet.value,
    format: 'image/png',
    projection,
    tileGrid: new lib.WMTSTileGrid({
      origin: lib.getTopLeft(projectionExtent),
      resolutions,
      matrixIds,
    }),
    style: '',
    wrapX: true,
    crossOrigin: 'anonymous',
  })

  wmtsLayer = new lib.TileLayer({ source, opacity: opacity.value })
  const map = createDemoMap(lib, el, { center: [8, 46], zoom: 4, base: 'none', layers: [wmtsLayer] })
  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">WMTS：预定义切片矩阵集，按行/列/级别直接取瓦片，比 WMS 更快、更适合做底图</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-tag size="small" effect="plain">matrixSet {{ matrixSet }}</el-tag>
      <el-tag size="small" type="info" effect="plain">resolutions 由 EPSG:3857 范围推导 14 级</el-tag>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="applyOpacity" />
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
