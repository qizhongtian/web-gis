<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const COUNT = 30000
const count = ref(0)
const cost = ref('—')
const opacity = ref(1)

let map: any = null
let ol: any = null
let source: any = null
let layer: any = null

function load() {
  if (!ol) return
  const features = randomPoints(ol, COUNT, [115.9, 39.6, 116.9, 40.25])
  source.clear()
  const start = performance.now()
  source.addFeatures(features)
  cost.value = `${(performance.now() - start).toFixed(0)} ms`
  count.value = source.getFeatures().length
}

function clear() {
  source.clear()
  count.value = 0
  cost.value = '—'
}

function onOpacity(value: any) {
  opacity.value = value
  layer?.setOpacity(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  // 共享同一个 Style 实例，避免每个要素重复创建样式对象
  const sharedStyle = new lib.Style({
    image: new lib.CircleStyle({
      radius: 2,
      fill: new lib.Fill({ color: 'rgba(34,211,238,0.85)' }),
    }),
  })
  layer = new lib.VectorLayer({ source, style: sharedStyle, opacity: opacity.value })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 10, base: 'light', layers: [layer] })
  load()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      海量数据：3 万点单图层渲染，关键点是「共享样式 + 批量 addFeatures」，避免逐要素创建 Style 造成卡顿
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="load">重新生成 {{ COUNT }} 点</el-button>
      <el-button size="small" @click="clear">清空</el-button>
      <el-tag size="small" type="success" effect="plain">要素数 {{ count }}</el-tag>
      <el-tag size="small" effect="plain">addFeatures 耗时 {{ cost }}</el-tag>
      <span class="text-[12px] text-[#64748b]">透明度</span>
      <el-slider class="max-w-32" :model-value="opacity" :min="0" :max="1" :step="0.05" size="small" @input="onOpacity" />
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
