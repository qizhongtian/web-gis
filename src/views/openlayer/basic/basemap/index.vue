<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createBaseLayer, createDemoMap, type BaseKind } from '@/utils/gis/olDemo'

const base = ref<BaseKind>('osm')
let map: any = null
let ol: any = null

/** 直接替换第 0 个图层（底图），保留其余图层与视图状态 */
function apply(kind: BaseKind) {
  base.value = kind
  if (!map || !ol) return
  map.getLayers().setAt(0, createBaseLayer(ol, kind))
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10, base: base.value })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">底图：TileLayer + XYZ / OSM 数据源，切换时只替换底图图层，视图状态保持不变</p>
    <el-radio-group v-model="base" size="small" @change="apply as any">
      <el-radio-button value="osm">OSM</el-radio-button>
      <el-radio-button value="light">浅色</el-radio-button>
      <el-radio-button value="imagery">影像</el-radio-button>
      <el-radio-button value="topo">地形</el-radio-button>
    </el-radio-group>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
