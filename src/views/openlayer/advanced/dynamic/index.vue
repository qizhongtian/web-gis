<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const running = ref(true)
const speed = ref(1)

let map: any = null
let ol: any = null
let layer: any = null
let raf = 0
let elapsed = 0
let last = 0

function onSpeed(value: any) {
  speed.value = value
}

function loop(time: number) {
  if (!last) last = time
  const delta = Math.min(time - last, 100)
  last = time
  if (running.value) elapsed += delta * speed.value
  layer?.changed()
  raf = requestAnimationFrame(loop)
}

function toggle(value: any) {
  running.value = Boolean(value)
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const line = new lib.Feature(
    new lib.LineString([
      lib.fromLonLat([116.18, 39.86]),
      lib.fromLonLat([116.407, 39.904]),
      lib.fromLonLat([116.65, 39.99]),
    ]),
  )
  const pulse1 = new lib.Feature(new lib.Point(lib.fromLonLat([116.3, 39.9])))
  const pulse2 = new lib.Feature(new lib.Point(lib.fromLonLat([116.52, 39.96])))

  layer = new lib.VectorLayer({
    source: new lib.VectorSource({ features: [line, pulse1, pulse2] }),
    style: (feature: any) => {
      const geometry = feature.getGeometry()
      if (geometry.getType() === 'LineString') {
        return new lib.Style({
          stroke: new lib.Stroke({
            color: '#22d3ee',
            width: 3,
            lineDash: [12, 10],
            lineDashOffset: -(elapsed / 25) % 22,
          }),
        })
      }
      const phase = (elapsed % 1400) / 1400
      return new lib.Style({
        image: new lib.CircleStyle({
          radius: 10 + phase * 16,
          fill: new lib.Fill({ color: `rgba(249,115,22,${1 - phase})` }),
          stroke: new lib.Stroke({ color: '#f97316', width: 2 }),
        }),
      })
    },
  })

  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 11, base: 'light', layers: [layer] })
  raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">动态渲染：requestAnimationFrame 改变线偏移与脉冲半径，layer.changed() 触发重绘，无额外 DOM</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-switch :model-value="running" size="small" active-text="播放" @change="toggle as any" />
      <span class="text-[12px] text-[#64748b]">速度</span>
      <el-slider class="max-w-40" :model-value="speed" :min="0.2" :max="4" :step="0.2" size="small" @input="onSpeed" />
      <el-tag size="small" type="info" effect="plain">{{ speed.toFixed(1) }}x</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
