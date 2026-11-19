<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const playing = ref(false)
const progress = ref(0)
const speed = ref(1)
const follow = ref(true)
const info = ref('')

let map: any = null
let ol: any = null
let marker: any = null
let trackGeometry: any = null
let timer: any = null

const path = [
  [116.15, 39.86],
  [116.2, 39.88],
  [116.26, 39.9],
  [116.32, 39.93],
  [116.38, 39.9],
  [116.44, 39.94],
  [116.5, 39.98],
  [116.56, 40.0],
  [116.62, 40.04],
]

function step(value: number) {
  progress.value = Math.min(1, Math.max(0, value))
  const coord = trackGeometry.getCoordinateAt(progress.value)
  marker.getGeometry().setCoordinates(coord)
  const lonLat = ol.toLonLat(coord)
  info.value = `进度 ${(progress.value * 100).toFixed(0)}% · ${lonLat[0].toFixed(4)}, ${lonLat[1].toFixed(4)}`
  if (follow.value) map.getView().setCenter(coord)
}

function tick() {
  step(progress.value + 0.003 * speed.value)
  if (progress.value >= 1) stop()
}

function play() {
  if (playing.value) return
  if (progress.value >= 1) step(0)
  playing.value = true
  timer = setInterval(tick, 50)
}

function stop() {
  playing.value = false
  clearInterval(timer)
  timer = null
}

function toggle() {
  playing.value ? stop() : play()
}

function onSlider(value: any) {
  stop()
  step(Number(value))
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  trackGeometry = new lib.LineString(path.map(([lon, lat]) => lib.fromLonLat([lon, lat])))

  const trackLayer = new lib.VectorLayer({
    source: new lib.VectorSource({ features: [new lib.Feature(trackGeometry)] }),
    style: new lib.Style({ stroke: new lib.Stroke({ color: '#22d3ee', width: 4, lineDash: [10, 6] }) }),
  })

  marker = new lib.Feature(new lib.Point(trackGeometry.getCoordinateAt(0)))
  const markerLayer = new lib.VectorLayer({
    source: new lib.VectorSource({ features: [marker] }),
    style: new lib.Style({
      image: new lib.CircleStyle({
        radius: 8,
        fill: new lib.Fill({ color: '#f97316' }),
        stroke: new lib.Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, {
    center: [116.38, 39.93],
    zoom: 12,
    base: 'light',
    layers: [trackLayer, markerLayer],
  })
  step(0)
  play()

  return () => {
    stop()
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">轨迹回放：LineString.getCoordinateAt 按比例取点，定时器推进进度，实现车辆/人员轨迹回放</p>
    <div class="flex flex-wrap items-center gap-3">
      <el-button size="small" type="primary" @click="toggle">{{ playing ? '暂停' : '播放' }}</el-button>
      <el-tag size="small" effect="plain">{{ info }}</el-tag>
      <el-checkbox v-model="follow" size="small">视角跟随</el-checkbox>
      <span class="text-[12px] text-[#64748b]">倍速</span>
      <el-select v-model="speed" size="small" class="w-20">
        <el-option :value="0.5" label="0.5x" />
        <el-option :value="1" label="1x" />
        <el-option :value="2" label="2x" />
        <el-option :value="4" label="4x" />
      </el-select>
    </div>
    <el-slider :model-value="progress" :min="0" :max="1" :step="0.001" size="small" @input="onSlider" />
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
