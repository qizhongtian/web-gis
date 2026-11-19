<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const COUNT = 100000
const radius = ref(2.5)
const count = ref(0)

let map: any = null
let ol: any = null
let layer: any = null

function webglStyle(r: number) {
  return {
    'circle-radius': r,
    'circle-fill-color': '#22d3ee',
    'circle-opacity': 0.75,
  }
}

function onRadius(value: any) {
  radius.value = value
  layer?.setStyle(webglStyle(Number(value)))
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const source = new lib.VectorSource({
    features: randomPoints(lib, COUNT, [110, 30, 122, 42]),
  })
  count.value = COUNT

  layer = new lib.WebGLPointsLayer({ source, style: webglStyle(radius.value) })
  map = createDemoMap(lib, el, { center: [116, 36], zoom: 5, base: 'light', layers: [layer] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      WebGL：WebGLPointsLayer 用 GPU 批量绘制，10 万点仍能流畅缩放；样式使用 WebGL 字面量表达式
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <el-tag size="small" type="success" effect="plain">点数 {{ count }}</el-tag>
      <el-tag size="small" type="info" effect="plain">渲染器 WebGL</el-tag>
      <span class="text-[12px] text-[#64748b]">点大小</span>
      <el-slider class="max-w-40" :model-value="radius" :min="1" :max="8" :step="0.5" size="small" @input="onRadius" />
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
