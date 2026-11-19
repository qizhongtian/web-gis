<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const level = ref('待加载')
const requests = ref(0)
const loading = ref(false)
const cacheHit = ref(0)

let map: any = null
let L: any = null
let layerGroup: any = null
let currentKey = ''
let seq = 0

interface Tier {
  key: string
  label: string
  count: number
  radius: number
  color: string
}

const TIERS: Tier[] = [
  { key: 'province', label: '省级（z<8）', count: 12, radius: 9, color: '#8b5cf6' },
  { key: 'city', label: '市级（8≤z<12）', count: 90, radius: 6, color: '#22d3ee' },
  { key: 'district', label: '区县（z≥12）', count: 480, radius: 4, color: '#10b981' },
]

const cache = new Map<string, any>()

function tierOf(zoom: number) {
  return zoom < 8 ? TIERS[0] : zoom < 12 ? TIERS[1] : TIERS[2]
}

/** 模拟接口：按层级返回不同粒度的数据 */
function fakeRequest(tier: Tier) {
  return new Promise<[number, number][]>((resolve) => {
    window.setTimeout(() => {
      const seed = 100 + TIERS.findIndex((t) => t.key === tier.key)
      resolve(randomPoints(tier.count, [116.1, 39.68, 116.72, 40.12], seed))
    }, 280)
  })
}

async function refresh() {
  if (!map) return
  const tier = tierOf(map.getZoom())
  if (tier.key === currentKey) return
  currentKey = tier.key
  const token = ++seq
  level.value = tier.label

  const cached = cache.get(tier.key)
  if (cached) {
    cacheHit.value += 1
    render(cached, tier)
    return
  }

  loading.value = true
  requests.value += 1
  const data = await fakeRequest(tier)
  if (token !== seq || !map) return // 快速缩放时丢弃过期响应
  cache.set(tier.key, data)
  loading.value = false
  render(data, tier)
}

function render(data: [number, number][], tier: Tier) {
  layerGroup.clearLayers()
  data.forEach((p) =>
    L.circleMarker(p, {
      radius: tier.radius,
      color: '#fff',
      weight: 1,
      fillColor: tier.color,
      fillOpacity: 0.85,
    }).addTo(layerGroup),
  )
}

function clearCache() {
  cache.clear()
  cacheHit.value = 0
  requests.value = 0
  currentKey = ''
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 6 })
  layerGroup = L.layerGroup().addTo(map)
  map.on('zoomend', refresh)
  await refresh()
  return () => {
    map?.off('zoomend', refresh)
    map?.remove()
    map = null
    layerGroup = null
    cache.clear()
    currentKey = ''
    seq++
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      分级加载：按 zoom 决定请求粒度，加载过的层级进缓存；用序号丢弃过期响应，避免快速缩放时数据错乱
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="plain" type="info">当前 {{ level }}</el-tag>
      <el-tag size="small" effect="plain" type="success">请求 {{ requests }}</el-tag>
      <el-tag size="small" effect="plain" type="warning">缓存命中 {{ cacheHit }}</el-tag>
      <el-tag v-if="loading" size="small" type="danger" effect="dark">加载中…</el-tag>
      <el-button size="small" @click="clearCache">清空缓存并重载</el-button>
      <span class="text-[12px] text-[#6b7280]">缩放到不同层级观察请求与命中</span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
