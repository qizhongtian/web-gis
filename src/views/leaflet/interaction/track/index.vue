<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

const playing = ref(false)
const progress = ref(0)
const speed = ref(2)
const totalDistance = ref(0)

let map: any = null
let L: any = null
let track: [number, number][] = []
let passed: any = null
let full: any = null
let cursor: any = null
let raf = 0
let index = 0

function buildTrack(): [number, number][] {
  // 一条带转弯的模拟行车轨迹
  const anchors: [number, number][] = [
    [39.85, 116.28],
    [39.9, 116.34],
    [39.94, 116.42],
    [39.92, 116.5],
    [39.86, 116.52],
    [39.82, 116.45],
  ]
  const pts: [number, number][] = []
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    for (let k = 0; k < 40; k++) {
      const t = k / 40
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  pts.push(anchors[anchors.length - 1])
  return pts
}

function bearing(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad)
  const x =
    Math.cos(a[0] * rad) * Math.sin(b[0] * rad) -
    Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function setCursor(i: number) {
  const cur = track[Math.min(i, track.length - 1)]
  const next = track[Math.min(i + 1, track.length - 1)]
  const angle = bearing(cur, next)
  cursor.setLatLng(cur)
  cursor.setIcon(
    L.divIcon({
      className: '',
      html: `<div style="width:26px;height:26px;transform:rotate(${angle - 90}deg);color:#f97316;font-size:22px;
        line-height:26px;text-align:center;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">➤</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }),
  )
  passed.setLatLngs(track.slice(0, i + 1))
  map.panTo(cur, { animate: false })
  progress.value = Math.round((i / (track.length - 1)) * 100)
}

function tick() {
  if (!playing.value) return
  index += speed.value
  if (index >= track.length - 1) {
    index = track.length - 1
    setCursor(index)
    playing.value = false
    return
  }
  setCursor(index)
  raf = requestAnimationFrame(tick)
}

function play() {
  if (!map) return
  if (index >= track.length - 1) index = 0
  playing.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function pause() {
  playing.value = false
  cancelAnimationFrame(raf)
}

function reset() {
  pause()
  index = 0
  setCursor(0)
}

function seek(value: any) {
  const pct = Number(value)
  pause()
  index = Math.round((pct / 100) * (track.length - 1))
  setCursor(index)
  progress.value = pct
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.88, 116.4], zoom: 11 })
  track = buildTrack()

  let total = 0
  for (let i = 1; i < track.length; i++) total += map.distance(track[i - 1], track[i])
  totalDistance.value = total

  full = L.polyline(track, { color: '#94a3b8', weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(map)
  passed = L.polyline(track.slice(0, 1), { color: '#f97316', weight: 4 }).addTo(map)
  cursor = L.marker(track[0]).addTo(map)

  map.fitBounds(full.getBounds(), { padding: [30, 30] })
  setCursor(0)

  return () => {
    pause()
    map?.remove()
    map = null
    passed = full = cursor = null
    progress.value = 0
    index = 0
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">轨迹回放：requestAnimationFrame 推进索引，已走路径实时绘制，方向箭头按航向旋转</p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="play" :disabled="playing">播放</el-button>
      <el-button size="small" @click="pause" :disabled="!playing">暂停</el-button>
      <el-button size="small" @click="reset">重置</el-button>
      <span class="text-[12px] text-[#64748b]">速度</span>
      <el-slider class="max-w-28" :model-value="speed" :min="1" :max="8" :step="1" size="small" @input="(v) => (speed = Number(v))" />
      <el-tag size="small" effect="plain" type="info">进度 {{ progress }}%</el-tag>
      <el-tag size="small" effect="plain" type="success">全程 {{ formatDistance(totalDistance) }}</el-tag>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-[12px] text-[#64748b]">拖动定位</span>
      <el-slider :model-value="progress" :min="0" :max="100" :step="1" size="small" @input="seek" />
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
