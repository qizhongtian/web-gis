<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createBaseLayer, createDemoMap, type BaseKind } from '@/utils/gis/olDemo'

const kind = ref<BaseKind>('osm')
const opacity = ref(1)
const tiles = ref(0)
let map: any = null
let ol: any = null
let layer: any = null

function rebuild(kindValue: BaseKind) {
  if (!map || !ol) return
  const next = createBaseLayer(ol, kindValue)
  next.setOpacity(opacity.value)
  next.getSource().on('tileloadend', () => (tiles.value += 1))
  layer = next
  map.getLayers().setAt(0, next)
}

function changeSource(value: any) {
  kind.value = value as BaseKind
  rebuild(kind.value)
}

function changeOpacity(value: number) {
  opacity.value = value
  layer?.setOpacity(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  layer = createBaseLayer(lib, kind.value)
  layer.getSource().on('tileloadend', () => (tiles.value += 1))
  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 10, base: 'none', layers: [layer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">TileLayer：瓦片分层渲染，setSource 换数据源，setOpacity 调透明度，监听 tileloadend 统计加载数</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-radio-group v-model="kind" size="small" @change="changeSource as any">
        <el-radio-button value="osm">OSM</el-radio-button>
        <el-radio-button value="light">浅色</el-radio-button>
        <el-radio-button value="imagery">影像</el-radio-button>
      </el-radio-group>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-40" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="changeOpacity as any" />
      <el-tag size="small" effect="plain">已加载瓦片 {{ tiles }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
