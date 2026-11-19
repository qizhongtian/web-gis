<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, pointInPolygon, seeded } from '@/utils/gis/leafletDemo'

type Level = 'enter' | 'leave'

interface Alarm {
  id: number
  time: string
  device: string
  level: Level
  fence: string
}

interface Target {
  name: string
  ll: [number, number]
  v: [number, number]
  inside: Record<string, boolean>
  marker: any
}

interface FenceDef {
  name: string
  ring: [number, number][]
  color: string
  layer: any
}

const running = ref(true)
const drawing = ref(false)
const alarmCount = ref(0)
const insideNow = ref(0)
const alarms = ref<Alarm[]>([])
const hint = ref('')

let map: any = null
let L: any = null
let timer = 0
let seq = 0
let draft: [number, number][] = []
let draftLayer: any = null
let draftPoints: any[] = []
let targets: Target[] = []
let fences: FenceDef[] = []

// 活动范围与「核心作业区」基本重合，目标主要演示进出「禁飞区」
const BBOX: [number, number, number, number] = [116.305, 39.865, 116.515, 39.975]

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function pushAlarm(device: string, level: Level, fence: string) {
  alarms.value.unshift({ id: ++seq, time: now(), device, level, fence })
  if (alarms.value.length > 60) alarms.value.pop()
  alarmCount.value++
}

function addFence(name: string, ring: [number, number][], color: string) {
  const layer = L.polygon(ring, {
    color,
    weight: 2,
    dashArray: '6 4',
    fillColor: color,
    fillOpacity: 0.08,
  })
    .addTo(map)
    // 外层围栏标签压在顶边，内嵌围栏标签放在面中心，避免互相遮挡
    .bindTooltip(name, {
      permanent: true,
      direction: fences.length === 0 ? 'top' : 'center',
      offset: fences.length === 0 ? [0, -4] : [0, 0],
    })
  fences.push({ name, ring, color, layer })
}

function drawDraft() {
  draftLayer?.remove()
  draftLayer = L.layerGroup().addTo(map)
  if (draft.length > 1) {
    L.polyline(draft, { color: '#f59e0b', weight: 2, dashArray: '4 4' }).addTo(draftLayer)
  }
  draftPoints.forEach((p) => p.remove())
  draftPoints = draft.map((ll) =>
    L.circleMarker(ll, { radius: 4, color: '#f59e0b', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(draftLayer),
  )
}

function finishDraw() {
  if (draft.length < 3) {
    hint.value = '至少需要 3 个顶点'
    return
  }
  addFence(`自定义围栏 ${fences.length + 1}`, draft.slice(), '#f59e0b')
  draft = []
  draftPoints.forEach((p) => p.remove())
  draftPoints = []
  draftLayer?.remove()
  draftLayer = null
  drawing.value = false
  hint.value = ''
}

function cancelDraw() {
  draft = []
  draftPoints.forEach((p) => p.remove())
  draftPoints = []
  draftLayer?.remove()
  draftLayer = null
  drawing.value = false
  hint.value = ''
}

function toggleDraw(value: any) {
  drawing.value = Boolean(value)
  if (!drawing.value) cancelDraw()
  else hint.value = '在地图上依次点击顶点，完成后点「完成围栏」'
}

function onMapClick(e: any) {
  if (!drawing.value) return
  draft.push([e.latlng.lat, e.latlng.lng])
  drawDraft()
  hint.value = `已添加 ${draft.length} 个顶点`
}

function tick() {
  if (!map || !running.value) return
  let inside = 0
  targets.forEach((t) => {
    // 简单匀速 + 边界反弹，制造穿越围栏的轨迹
    t.ll = [t.ll[0] + t.v[0], t.ll[1] + t.v[1]]
    if (t.ll[0] < BBOX[1] || t.ll[0] > BBOX[3]) t.v[0] *= -1
    if (t.ll[1] < BBOX[0] || t.ll[1] > BBOX[2]) t.v[1] *= -1
    t.marker.setLatLng(t.ll)

    let hit = false
    fences.forEach((f) => {
      const isIn = pointInPolygon(t.ll, f.ring)
      if (isIn) hit = true
      // 首次只记录初始状态，避免页面一打开就刷出一堆「离开」告警
      if (typeof t.inside[f.name] === 'boolean' && isIn !== t.inside[f.name]) {
        pushAlarm(t.name, isIn ? 'enter' : 'leave', f.name)
      }
      t.inside[f.name] = isIn
    })
    if (hit) inside++
  })
  insideNow.value = inside
}

function setRunning(value: any) {
  running.value = Boolean(value)
}

function clearAlarms() {
  alarms.value = []
  alarmCount.value = 0
}

function makeTargets() {
  const rnd = seeded(20261219)
  const names = ['车辆 A', '车辆 B', '巡检员 C', '车辆 D', '无人机 E']
  targets = names.map((name, i) => {
    const ll: [number, number] = [
      BBOX[1] + 0.03 + rnd() * (BBOX[3] - BBOX[1] - 0.06),
      BBOX[0] + 0.03 + rnd() * (BBOX[2] - BBOX[0] - 0.06),
    ]
    const marker = L.marker(ll, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid ${['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#ef4444'][i]};filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))"></div>`,
        iconSize: [12, 14],
        iconAnchor: [6, 14],
      }),
    })
      .addTo(map)
      .bindTooltip(name, { direction: 'top', offset: [0, -12] })
    return {
      name,
      ll,
      v: [(rnd() - 0.5) * 0.0022, (rnd() - 0.5) * 0.0032],
      inside: {},
      marker,
    }
  })
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.92, 116.41], zoom: 11, base: 'light' })
  alarms.value = []
  alarmCount.value = 0
  fences = []
  targets = []
  draft = []
  drawing.value = false
  hint.value = ''

  addFence(
    '核心作业区',
    [
      [39.86, 116.3],
      [39.86, 116.52],
      [39.98, 116.52],
      [39.98, 116.3],
    ],
    '#16a34a',
  )
  addFence(
    '禁飞区',
    [
      [39.9, 116.36],
      [39.9, 116.42],
      [39.945, 116.42],
      [39.945, 116.36],
    ],
    '#ef4444',
  )

  makeTargets()
  map.on('click', onMapClick)
  tick()
  timer = window.setInterval(tick, 700)

  return () => {
    window.clearInterval(timer)
    timer = 0
    map?.off('click', onMapClick)
    map?.remove()
    map = null
    targets = []
    fences = []
    draft = []
    draftLayer = null
    draftPoints = []
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      电子围栏：目标按固定间隔推进，逐个围栏做射线法包含判断，状态翻转即生成进出告警；也可手动绘制围栏
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-switch :model-value="running" size="small" active-text="目标移动" @change="setRunning" />
      <el-switch :model-value="drawing" size="small" active-text="绘制围栏" @change="toggleDraw" />
      <el-button v-if="drawing" size="small" type="primary" @click="finishDraw">完成围栏</el-button>
      <el-button v-if="drawing" size="small" @click="cancelDraw">取消</el-button>
      <el-tag size="small" effect="plain" type="success">围栏内 {{ insideNow }}</el-tag>
      <el-tag size="small" effect="plain" type="danger">累计告警 {{ alarmCount }}</el-tag>
      <el-button size="small" text @click="clearAlarms">清空告警</el-button>
    </div>
    <p v-if="hint" class="text-[12px] text-[#b45309]">{{ hint }}</p>
    <div class="max-h-36 overflow-auto rounded border border-[#e6e8eb]">
      <div
        v-for="a in alarms"
        :key="a.id"
        class="flex items-center gap-2 px-2 py-1 text-[12px] border-b border-[#f1f3f5] last:border-0"
      >
        <span class="font-mono text-[#94a3b8]">{{ a.time }}</span>
        <el-tag size="small" :type="a.level === 'enter' ? 'success' : 'warning'" effect="plain">
          {{ a.level === 'enter' ? '进入' : '离开' }}
        </el-tag>
        <span class="text-[#334155]">{{ a.device }}</span>
        <span class="text-[#64748b]">{{ a.fence }}</span>
      </div>
      <p v-if="!alarms.length" class="px-2 py-3 text-[12px] text-[#94a3b8]">暂无告警，等待目标穿越围栏…</p>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
