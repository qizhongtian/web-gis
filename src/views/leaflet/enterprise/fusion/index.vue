<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import {
  createBaseLayer,
  createDemoMap,
  distanceToSegment,
  pointInPolygon,
  randomPoints,
  seeded,
} from '@/utils/gis/leafletDemo'
import { formatDistance } from '@/utils/gis/coord'

interface SourceItem {
  key: string
  name: string
  type: string
  color: string
  count: string
  visible: boolean
}

interface Hit {
  source: string
  color: string
  title: string
  detail: string
}

const sources = ref<SourceItem[]>([
  { key: 'poi', name: 'POI 矢量点', type: '向量', color: '#2563eb', count: '60 个', visible: true },
  { key: 'route', name: '配送路网', type: '向量', color: '#f97316', count: '1 条', visible: true },
  { key: 'district', name: '行政区划面', type: '向量', color: '#10b981', count: '1 个', visible: true },
  { key: 'sensor', name: '实时传感器', type: '流式', color: '#8b5cf6', count: '5 个', visible: true },
  { key: 'imagery', name: '影像底图服务', type: '栅格', color: '#64748b', count: '1 服务', visible: false },
])

const hits = ref<Hit[]>([])
const clickAt = ref('')
const sensorTick = ref(0)

let map: any = null
let L: any = null
let timer = 0
let pois: [number, number][] = []
let route: [number, number][] = []
let ring: [number, number][] = []
let sensors: { ll: [number, number]; dir: [number, number]; marker: any }[] = []
const layers: Record<string, any> = {}

const DISTRICT: [number, number][] = [
  [39.86, 116.34],
  [39.9, 116.33],
  [39.95, 116.4],
  [39.96, 116.49],
  [39.9, 116.53],
  [39.85, 116.47],
]

function buildData() {
  const rnd = seeded(20260301)
  pois = randomPoints(60, [116.33, 39.85, 116.53, 39.96], 20260301)

  const anchors: [number, number][] = [
    [39.875, 116.35],
    [39.905, 116.395],
    [39.935, 116.44],
    [39.915, 116.49],
    [39.878, 116.5],
  ]
  route = []
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    for (let k = 0; k < 40; k++) route.push([a[0] + ((b[0] - a[0]) * k) / 40, a[1] + ((b[1] - a[1]) * k) / 40])
  }
  route.push(anchors[anchors.length - 1])
  ring = DISTRICT

  sensors = []
  for (let i = 0; i < 5; i++) {
    sensors.push({
      ll: [
        39.87 + rnd() * 0.08,
        116.35 + rnd() * 0.15,
      ],
      dir: [(rnd() - 0.5) * 0.0006, (rnd() - 0.5) * 0.0009],
      marker: null,
    })
  }
}

function createLayers() {
  // 1) POI 矢量点
  const poiGroup = L.layerGroup()
  pois.forEach((ll, i) => {
    L.circleMarker(ll, {
      radius: 3.5,
      color: '#1d4ed8',
      weight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.85,
    })
      .addTo(poiGroup)
      .bindTooltip(`POI-${String(i + 1).padStart(2, '0')}`, { direction: 'top' })
  })
  layers.poi = poiGroup
  poiGroup.addTo(map)

  // 2) 路网（线）
  layers.route = L.polyline(route, { color: '#f97316', weight: 4, opacity: 0.9 })
    .addTo(map)
    .bindTooltip('配送路网', { sticky: true })

  // 3) 行政区面
  layers.district = L.polygon(ring, {
    color: '#0d9488',
    weight: 2,
    fillColor: '#10b981',
    fillOpacity: 0.1,
  })
    .addTo(map)
    .bindTooltip('示范区', { permanent: true, direction: 'center' })

  // 4) 实时传感器（流式点位）
  const sensorGroup = L.layerGroup()
  sensors.forEach((s, i) => {
    s.marker = L.marker(s.ll, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#8b5cf6;border:2px solid #fff;box-shadow:0 0 0 4px rgba(139,92,246,.25)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    })
      .addTo(sensorGroup)
      .bindTooltip(`传感器 S-${i + 1}`, { direction: 'top' })
  })
  layers.sensor = sensorGroup
  sensorGroup.addTo(map)

  // 5) 栅格服务（默认关闭）
  layers.imagery = createBaseLayer(L, 'imagery')
}

function syncSource(key: string, visible: boolean) {
  const layer = layers[key]
  if (!layer) return
  if (visible) layer.addTo(map)
  else layer.remove()
}

function toggleSource(key: string, value: any) {
  const item = sources.value.find((s) => s.key === key)
  if (!item) return
  item.visible = Boolean(value)
  syncSource(key, item.visible)
}

function moveSensors() {
  if (!map) return
  sensors.forEach((s) => {
    s.ll = [s.ll[0] + s.dir[0], s.ll[1] + s.dir[1]]
    if (s.ll[0] < 39.85 || s.ll[0] > 39.96) s.dir[0] *= -1
    if (s.ll[1] < 116.33 || s.ll[1] > 116.53) s.dir[1] *= -1
    s.marker?.setLatLng(s.ll)
  })
  sensorTick.value++
}

/** 点击地图：把各数据源在同一个坐标系下做一次联合查询 */
function onMapClick(e: any) {
  if (!map) return
  const ll: [number, number] = [e.latlng.lat, e.latlng.lng]
  clickAt.value = `${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`

  let nearestPoi = pois[0]
  let poiDist = Infinity
  pois.forEach((p) => {
    const d = map.distance(ll, p)
    if (d < poiDist) {
      poiDist = d
      nearestPoi = p
    }
  })

  let lineDist = Infinity
  for (let i = 1; i < route.length; i++) {
    lineDist = Math.min(lineDist, distanceToSegment(ll, route[i - 1], route[i]))
  }

  let nearestSensor = sensors[0].ll
  let sensorDist = Infinity
  sensors.forEach((s) => {
    const d = map.distance(ll, s.ll)
    if (d < sensorDist) {
      sensorDist = d
      nearestSensor = s.ll
    }
  })

  const inDistrict = pointInPolygon(ll, ring)

  hits.value = [
    {
      source: 'POI 矢量点',
      color: '#2563eb',
      title: `最近 POI ${formatDistance(poiDist)}`,
      detail: `${nearestPoi[0].toFixed(4)}, ${nearestPoi[1].toFixed(4)}`,
    },
    {
      source: '配送路网',
      color: '#f97316',
      title: `距路网 ${formatDistance(lineDist)}`,
      detail: lineDist < 150 ? '紧邻道路，可判定为路上事件' : '远离道路',
    },
    {
      source: '行政区划面',
      color: '#10b981',
      title: inDistrict ? '位于示范区内' : '位于示范区外',
      detail: '射线法包含判断',
    },
    {
      source: '实时传感器',
      color: '#8b5cf6',
      title: `最近传感器 ${formatDistance(sensorDist)}`,
      detail: `${nearestSensor[0].toFixed(4)}, ${nearestSensor[1].toFixed(4)}`,
    },
  ]

  L.circleMarker(ll, {
    radius: 6,
    color: '#dc2626',
    weight: 2,
    fillColor: '#fff',
    fillOpacity: 1,
  })
    .addTo(map)
    .bindTooltip('查询点', { direction: 'top' })
    .openTooltip()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.905, 116.43], zoom: 12, base: 'light' })
  hits.value = []
  clickAt.value = ''
  sensorTick.value = 0

  buildData()
  createLayers()
  sources.value.forEach((s) => syncSource(s.key, s.visible))
  map.on('click', onMapClick)
  timer = window.setInterval(moveSensors, 1200)

  return () => {
    window.clearInterval(timer)
    timer = 0
    map?.off('click', onMapClick)
    map?.remove()
    map = null
    Object.keys(layers).forEach((k) => delete layers[k])
    sensors = []
    pois = []
    route = []
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      多源融合：矢量点、路网、行政面、流式传感器与栅格服务统一到 WGS84 下叠置，点击地图做跨源联合查询
    </p>
    <div class="flex items-center gap-3 flex-wrap">
      <el-checkbox
        v-for="s in sources"
        :key="s.key"
        :model-value="s.visible"
        size="small"
        @change="(v: any) => toggleSource(s.key, v)"
      >
        <i class="inline-block w-2 h-2 rounded-full mr-1" :style="{ background: s.color }"></i>
        {{ s.name }}
        <span class="text-[#94a3b8]">({{ s.type }} · {{ s.count }})</span>
      </el-checkbox>
    </div>
    <div class="grid grid-cols-2 gap-2 text-[12px]">
      <p class="text-[#475569]">
        查询点：<span class="font-mono text-[#334155]">{{ clickAt || '点击地图开始查询' }}</span>
      </p>
      <p class="text-[#94a3b8]">传感器心跳 {{ sensorTick }} 次</p>
    </div>
    <div class="max-h-40 overflow-auto rounded border border-[#e6e8eb]">
      <div
        v-for="h in hits"
        :key="h.source"
        class="flex items-center gap-2 px-2 py-1 text-[12px] border-b border-[#f1f3f5] last:border-0"
      >
        <i class="inline-block w-2 h-2 rounded-full" :style="{ background: h.color }"></i>
        <span class="w-24 text-[#334155]">{{ h.source }}</span>
        <span class="flex-1 text-[#475569]">{{ h.title }}</span>
        <span class="text-[#94a3b8]">{{ h.detail }}</span>
      </div>
      <p v-if="!hits.length" class="px-2 py-3 text-[12px] text-[#94a3b8]">
        点击地图任意位置，查看各数据源的联合查询结果
      </p>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
