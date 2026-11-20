<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadMapLibre } from '@/utils/gis/maplibreLoader'
import { circleRing, createMap, lineFC, waitReady } from '@/utils/gis/glDemo'

const playing = ref(true)
const speed = ref(60)
const progress = ref(0)
let map: any = null
let marker: any = null
let raf = 0
let traveled = 0
let totalLen = 0
let route: [number, number][] = []
let lastSync = 0

const R = 6371008.8
function toRad(d: number) {
  return (d * Math.PI) / 180
}
function dist(a: [number, number], b: [number, number]) {
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 按里程插值出坐标与方位角 */
function pointAt(d: number): { ll: [number, number]; bearing: number } {
  let acc = 0
  for (let i = 1; i < route.length; i++) {
    const seg = dist(route[i - 1], route[i])
    if (acc + seg >= d) {
      const t = (d - acc) / (seg || 1)
      const a = route[i - 1]
      const b = route[i]
      const ll: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
      return { ll, bearing }
    }
    acc += seg
  }
  return { ll: route[route.length - 1], bearing: 0 }
}

function step(ts: number) {
  raf = requestAnimationFrame(step)
  if (!map || !playing.value) return
  traveled = (traveled + speed.value * 5) % totalLen
  const { ll, bearing } = pointAt(traveled)
  marker?.setLngLat(ll)
  if (marker) marker.getElement().style.transform = `rotate(${bearing}deg)`

  // 已走轨迹
  const passed: [number, number][] = []
  let acc = 0
  for (let i = 0; i < route.length; i++) {
    passed.push(route[i])
    if (i > 0) {
      acc += dist(route[i - 1], route[i])
      if (acc >= traveled) break
    }
  }
  passed.push(ll)
  map.getSource('passed')?.setData(lineFC(passed))

  if (ts - lastSync > 150) {
    lastSync = ts
    progress.value = Math.round((traveled / totalLen) * 100)
  }
}

async function init(lib: any, el: HTMLElement) {
  map = createMap(lib, el, { base: 'dark', center: [116.4074, 39.9042], zoom: 11.2, pitch: 40 })
  route = circleRing([116.4074, 39.9042], 5, 72)
  totalLen = route.reduce((sum, p, i) => (i ? sum + dist(route[i - 1], p) : 0), 0)
  traveled = 0

  await waitReady(map)

  map.addSource('route', { type: 'geojson', data: lineFC([...route, route[0]]) })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#334155', 'line-width': 4, 'line-dasharray': [2, 1] },
  })
  map.addSource('passed', { type: 'geojson', data: lineFC(route.slice(0, 1)) })
  map.addLayer({ id: 'passed-line', type: 'line', source: 'passed', paint: { 'line-color': '#22d3ee', 'line-width': 4 } })

  const arrow = document.createElement('div')
  arrow.style.cssText =
    'width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:16px solid #f97316;filter:drop-shadow(0 0 4px rgba(249,115,22,.8))'
  marker = new lib.Marker({ element: arrow, rotationAlignment: 'map' }).setLngLat(route[0]).addTo(map)

  raf = requestAnimationFrame(step)

  return () => {
    cancelAnimationFrame(raf)
    marker?.remove()
    marker = null
    map?.remove()
    map = null
  }
}

function toggle() {
  playing.value = !playing.value
}

function applySpeed(v: number) {
  speed.value = v
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      路径动画：requestAnimationFrame 推进里程，按里程插值出坐标与方位角，Marker 用 CSS 旋转对齐方向，配合 setData 绘制已走轨迹
    </p>
    <div class="flex items-center gap-4 flex-wrap text-[12px] text-[#64748b]">
      <el-button size="small" type="primary" @click="toggle">{{ playing ? '暂停' : '播放' }}</el-button>
      <span class="flex items-center gap-2">速度 {{ speed }} m/s
        <el-slider class="!w-36" :model-value="speed" :min="10" :max="200" :step="10" size="small" @input="applySpeed as any" />
      </span>
      <el-tag size="small">进度 {{ progress }}%</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadMapLibre" :init="init" />
  </div>
</template>
