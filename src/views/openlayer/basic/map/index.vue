<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const zoom = ref(10)
let map: any = null

async function init(ol: any, el: HTMLElement) {
  map = createDemoMap(ol, el, { center: [116.407, 39.904], zoom: 10, base: 'osm' })
  const update = () => {
    zoom.value = Number(map.getView().getZoom()?.toFixed(2))
  }
  map.getView().on('change:resolution', update)
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">地图初始化：target + layers + view 三要素创建 ol/Map，View 负责中心点与缩放级别</p>
    <div class="flex items-center gap-2">
      <el-tag size="small" effect="plain">当前层级：{{ zoom }}</el-tag>
      <el-tag size="small" effect="plain">中心：116.407, 39.904</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
