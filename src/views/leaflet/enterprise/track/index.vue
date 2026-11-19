<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, seeded } from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

interface TrackPoint {
  ll: [number, number]
  /** 相对起点的秒数 */
  t: number
}

interface StopPoint {
  ll: [number, number]
  start: number
  end: number
  minutes: number
}

const threshold = ref(8)
const showStop = ref(true)
const mileage = ref(0)
const duration = ref(0)
const avgSpeed = ref(0)
const stops = ref<StopPoint[]>([])
const computing = ref(false)

let map: any = null
let L: any = null
let stopLayer: any = null
let track: TrackPoint[] = []

const STOP_LIMIT = 45 // 停留判定半径（米）

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
}

/** 生成带 4 段停留的模拟 GPS 轨迹 */
function buildTrack() {
  const rnd = seeded(20261119)
  const anchors: [number, number][] = [
    [39.879, 116.318],
    [39.898, 116.352],
    [39.926, 116.386],
    [39.944, 116.44],
    [39.928, 116.492],
    [39.892, 116.514],
    [39.862, 116.474],
    [39.858, 116.408],
    [39.879, 116.318],
  ]
  const path: [number, number][] = []
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    const n = 52
    for (let k = 0; k < n; k++) {
      const r = k / n
      path.push([
        a[0] + (b[0] - a[0]) * r + (rnd() - 0.5) * 0.00035,
        a[1] + (b[1] - a[1]) * r + (rnd() - 0.5) * 0.00045,
      ])
    }
  }

  // 在固定位置插入停留（同一位置重复上报），时长固定便于对照阈值
  const stopsAt = [70, 150, 250, 330]
  const stayMinutes = [12, 18, 9, 15]
  const out: TrackPoint[] = []
  let t = 0
  path.forEach((ll, i) => {
    out.push({ ll, t })
    const stayIdx = stopsAt.indexOf(i)
    const stay = stayIdx >= 0 ? stayMinutes[stayIdx] : 0
    for (let k = 1; k <= stay; k++) {
      out.push({
        ll: [ll[0] + (rnd() - 0.5) * 0.00008, ll[1] + (rnd() - 0.5) * 0.00008],
        t: t + k * 60,
      })
    }
    // 相邻采样点约 80m，25s 一个点 ≈ 11km/h，停留时间单独计入
    t += 25 + stay * 60
  })
  return out
}

function analyze() {
  if (!map || !track.length) return
  computing.value = true

  let total = 0
  for (let i = 1; i < track.length; i++) total += map.distance(track[i - 1].ll, track[i].ll)
  mileage.value = total
  const span = track[track.length - 1].t - track[0].t
  duration.value = span
  // 平均速度只统计「运动时间」以外的整体时间，和仪表盘口径一致
  avgSpeed.value = span > 0 ? (total / span) * 3.6 : 0

  const found: StopPoint[] = []
  let i = 0
  while (i < track.length) {
    let j = i + 1
    while (j < track.length && map.distance(track[i].ll, track[j].ll) <= STOP_LIMIT) j++
    const minutes = (track[j - 1].t - track[i].t) / 60
    if (minutes >= threshold.value) {
      let lat = 0
      let lng = 0
      for (let k = i; k < j; k++) {
        lat += track[k].ll[0]
        lng += track[k].ll[1]
      }
      found.push({
        ll: [lat / (j - i), lng / (j - i)],
        start: track[i].t,
        end: track[j - 1].t,
        minutes: Math.round(minutes),
      })
    }
    i = Math.max(j, i + 1)
  }
  stops.value = found
  renderStops()
  computing.value = false
}

function renderStops() {
  if (!map) return
  stopLayer.clearLayers()
  if (!showStop.value) return
  stops.value.forEach((s, i) => {
    L.circleMarker(s.ll, {
      radius: Math.min(6 + s.minutes / 3, 18),
      color: '#7c3aed',
      weight: 2,
      fillColor: '#a78bfa',
      fillOpacity: 0.55,
    })
      .addTo(stopLayer)
      .bindPopup(
        `<b>停留点 ${i + 1}</b><br/>时长：${s.minutes} 分钟<br/>里程段：${fmtTime(s.start)} → ${fmtTime(s.end)}`,
      )
  })
  stopLayer.addTo(map)
}

function toggleStop(value: any) {
  showStop.value = Boolean(value)
  renderStops()
}

function onThreshold(value: number | number[]) {
  threshold.value = Array.isArray(value) ? value[0] : value
  analyze()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.41], zoom: 11, base: 'light' })
  track = buildTrack()
  stopLayer = L.layerGroup().addTo(map)

  const latlngs = track.map((p) => p.ll)
  L.polyline(latlngs, { color: '#2563eb', weight: 3, opacity: 0.85 }).addTo(map)
  L.circleMarker(latlngs[0], { radius: 7, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2 })
    .addTo(map)
    .bindTooltip('起点', { permanent: true, direction: 'right' })
  L.circleMarker(latlngs[latlngs.length - 1], {
    radius: 7,
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 1,
    weight: 2,
  })
    .addTo(map)
    .bindTooltip('终点', { permanent: true, direction: 'right' })

  map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] })
  analyze()

  return () => {
    map?.remove()
    map = null
    stopLayer = null
    track = []
  }
}

const totalLabel = computed(() => (duration.value ? fmtTime(duration.value) : '-'))
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      轨迹分析：先按「连续点间距 &lt; {{ STOP_LIMIT }}m」切分疑似停留段，再用停留时长阈值过滤，同时统计里程与平均速度
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#475569]">停留阈值 {{ threshold }} 分钟</span>
      <el-slider
        class="!w-40"
        :model-value="threshold"
        :min="2"
        :max="25"
        :step="1"
        size="small"
        @change="onThreshold"
      />
      <el-checkbox :model-value="showStop" size="small" @change="toggleStop as any">显示停留点</el-checkbox>
      <el-tag size="small" effect="plain" type="primary">里程 {{ formatDistance(mileage) }}</el-tag>
      <el-tag size="small" effect="plain" type="success">平均 {{ avgSpeed.toFixed(1) }} km/h</el-tag>
      <el-tag size="small" effect="plain" type="warning">停留 {{ stops.length }} 次</el-tag>
      <el-tag size="small" effect="plain" type="info">总时长 {{ totalLabel }}</el-tag>
      <el-tag v-if="computing" size="small" effect="plain">分析中…</el-tag>
    </div>
    <div class="max-h-36 overflow-auto rounded border border-[#e6e8eb]">
      <div
        v-for="(s, i) in stops"
        :key="`${s.start}-${i}`"
        class="flex items-center gap-3 px-2 py-1 text-[12px] border-b border-[#f1f3f5] last:border-0"
      >
        <span class="w-16 text-[#7c3aed]">停留 {{ i + 1 }}</span>
        <span class="w-24 font-mono text-[#94a3b8]">{{ fmtTime(s.start) }}</span>
        <span class="flex-1 text-[#475569]">{{ s.minutes }} 分钟</span>
        <span class="font-mono text-[#64748b]">{{ s.ll[0].toFixed(4) }}, {{ s.ll[1].toFixed(4) }}</span>
      </div>
      <p v-if="!stops.length" class="px-2 py-3 text-[12px] text-[#94a3b8]">
        当前阈值下没有停留点，调小阈值试试
      </p>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
