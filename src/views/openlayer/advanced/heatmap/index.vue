<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/olDemo'

const radius = ref(16)
const blur = ref(18)
const points = ref(0)

let map: any = null
let ol: any = null
let heat: any = null
let source: any = null

function regenerate() {
  if (!ol) return
  source.clear()
  source.addFeatures(
    randomPoints(ol, 4000, [116.1, 39.7, 116.75, 40.15], () => ({
      weight: 0.2 + Math.random() * 0.8,
    })),
  )
  points.value = source.getFeatures().length
}

function onRadius(value: any) {
  radius.value = value
  heat?.setRadius(value)
}

function onBlur(value: any) {
  blur.value = value
  heat?.setBlur(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  source.addFeatures(
    randomPoints(lib, 4000, [116.1, 39.7, 116.75, 40.15], () => ({
      weight: 0.2 + Math.random() * 0.8,
    })),
  )
  points.value = source.getFeatures().length

  heat = new lib.Heatmap({
    source,
    radius: radius.value,
    blur: blur.value,
    weight: (f: any) => Number(f.get('weight') ?? 1),
    gradient: ['#22d3ee', '#22c55e', '#facc15', '#f97316', '#ef4444'],
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 11, base: 'imagery', layers: [heat] })
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">热力图：ol/layer/Heatmap 按权重聚合点密度，radius / blur / gradient 控制渲染效果</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-button size="small" type="primary" @click="regenerate">重新生成</el-button>
      <el-tag size="small" effect="plain">点数 {{ points }}</el-tag>
      <span class="text-[12px] text-[#64748b]">半径</span>
      <el-slider class="max-w-32" :model-value="radius" :min="4" :max="40" size="small" @input="onRadius" />
      <span class="text-[12px] text-[#64748b]">模糊</span>
      <el-slider class="max-w-32" :model-value="blur" :min="4" :max="40" size="small" @input="onBlur" />
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
