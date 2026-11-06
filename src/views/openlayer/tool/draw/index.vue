<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'

const type = ref('Point')
let map: any = null
let draw: any = null
let source: any = null
let ol: any = null

function setType(t: string) {
  type.value = t
  if (!map || !ol) return
  const { Draw } = ol
  map.removeInteraction(draw)
  draw = new Draw({ source, type: t })
  map.addInteraction(draw)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const { Map, View, TileLayer, VectorLayer, VectorSource, OSM, Draw, fromLonLat } = lib
  source = new VectorSource()
  draw = new Draw({ source, type: type.value })
  map = new Map({
    target: el,
    layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source })],
    view: new View({ center: fromLonLat([116.407, 39.904]), zoom: 8 }),
  })
  map.addInteraction(draw)
  return () => map.setTarget(null)
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">绘制工具：Draw 交互绘制点 / 线 / 面（v-permission 控制绘制权限）</p>
    <div class="flex items-center gap-2">
      <el-radio-group
        v-model="type"
        size="small"
        v-permission="'gis:draw'"
        @change="setType as any"
      >
        <el-radio-button value="Point">点</el-radio-button>
        <el-radio-button value="LineString">线</el-radio-button>
        <el-radio-button value="Polygon">面</el-radio-button>
      </el-radio-group>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
