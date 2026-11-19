<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

const online = ref(true)
const follow = ref(true)
const speed = ref(0)
const mileage = ref(0)
const position = ref('')
const points = ref(0)

let map: any = null
let L: any = null
let target: any = null
let trail: any = null
let timer = 0
let idx = 0

const ROUTE: [number, number][] = (() => {
  const anchors: [number, number][] = [
    [39.86, 116.3],
    [39.9, 116.36],
    [39.94, 116.44],
    [39.91, 116.52],
    [39.85, 116.5],
  ]
  const out: [number, number][] = []
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    for (let k = 0; k < 60; k++) out.push([a[0] + ((b[0] - a[0]) * k) / 60, a[1] + ((b[1] - a[1]) * k) / 60])
  }
  out.push(anchors[anchors.length - 1])
  return out
})()

function step() {
  if (!map || !online.value) return
  idx = (idx + 1) % ROUTE.length
  const cur = ROUTE[idx]
  target.setLatLng(cur)

  const next = ROUTE[(idx + 1) % ROUTE.length]
  const prev = ROUTE[(idx - 1 + ROUTE.length) % ROUTE.length]
  // 速度 = 两点距离 / 上报间隔，再加一点抖动更真实
  const d = map.distance(prev, cur)
  speed.value = Math.round((d / 0.5) * 3.6 + Math.random() * 6)
  mileage.value += d
  position.value = `${cur[0].toFixed(5)}, ${cur[1].toFixed(5)}`

  const trailLatLngs = trail.getLatLngs()
  trailLatLngs.push(L.latLng(cur))
  if (trailLatLngs.length > 80) trailLatLngs.shift()
  trail.setLatLngs(trailLatLngs)
  points.value = trailLatLngs.length

  if (follow.value) map.panTo(cur, { animate: true, duration: 0.4 })
  void next
}

function setOnline(value: any) {
  online.value = Boolean(value)
  if (online.value && timer === 0) timer = window.setInterval(step, 500)
  if (!online.value) {
    window.clearInterval(timer)
    timer = 0
  }
}

function toggleFollow(value: any) {
  follow.value = Boolean(value)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 11 })
  idx = 0

  trail = L.polyline([], { color: '#f97316', weight: 4, opacity: 0.9 }).addTo(map)
  target = L.marker(ROUTE[0], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#22d3ee;border:3px solid #fff;box-shadow:0 0 0 6px rgba(34,211,238,.28)"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
  })
    .addTo(map)
    .bindTooltip('实时目标', { permanent: true, direction: 'top', offset: [0, -14] })

  timer = window.setInterval(step, 500)

  return () => {
    window.clearInterval(timer)
    timer = 0
    map?.remove()
    map = null
    target = null
    trail = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      实时定位：定时上报推进目标位置，尾迹只保留最近 N 个点，跟随模式让视野始终锁在目标上
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-switch :model-value="online" size="small" active-text="定位上报" @change="setOnline" />
      <el-checkbox :model-value="follow" size="small" @change="toggleFollow as any">视野跟随</el-checkbox>
      <el-tag size="small" effect="plain" type="success">速度 {{ speed }} km/h</el-tag>
      <el-tag size="small" effect="plain" type="info">累计 {{ formatDistance(mileage) }}</el-tag>
      <el-tag size="small" effect="plain" type="warning">尾迹 {{ points }} 点</el-tag>
    </div>
    <p class="text-[12px] font-mono text-[#475569]">当前位置 {{ position || '等待上报…' }}</p>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
