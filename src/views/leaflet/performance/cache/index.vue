<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints } from '@/utils/gis/leafletDemo'

const capacity = ref(8)
const hits = ref(0)
const misses = ref(0)
const keys = ref<string[]>([])
const lastCost = ref(0)
const lastKey = ref('')

let map: any = null
let L: any = null
let layerGroup: any = null
let seq = 0

/** 简易 LRU：Map 的插入顺序天然可作为访问顺序 */
class LRU<K, V> {
  private map = new Map<K, V>()
  constructor(private cap: number) {}
  get size() {
    return this.map.size
  }
  keys() {
    return [...this.map.keys()]
  }
  get(key: K) {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }
  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }
  resize(cap: number) {
    this.cap = cap
    while (this.map.size > cap) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }
  clear() {
    this.map.clear()
  }
}

// 注意：实例化必须放在 class 声明之后，否则触发 TDZ 报错
const cache = new LRU<string, [number, number][]>(8)

const hitRate = computed(() => {
  const totalHits = hits.value + misses.value
  return totalHits ? `${Math.round((hits.value / totalHits) * 100)}%` : '-'
})

const rate = (key: string) =>
  new Promise<[number, number][]>((resolve) => {
    window.setTimeout(() => {
      const seed = Number(key.split('-')[1]) * 37 + 11
      resolve(randomPoints(120, [116.15, 39.72, 116.66, 40.08], seed))
    }, 320)
  })

async function request(key: string) {
  if (!map) return
  lastKey.value = key
  const cached = cache.get(key)
  if (cached) {
    hits.value++
    lastCost.value = 0
  } else {
    misses.value++
    const t0 = performance.now()
    const data = await rate(key)
    lastCost.value = Math.round(performance.now() - t0)
    cache.set(key, data)
    render(cached ?? data)
    keys.value = cache.keys() as string[]
    return
  }
  render(cached)
  keys.value = cache.keys() as string[]
}

function render(data: [number, number][]) {
  layerGroup.clearLayers()
  data.forEach((p) =>
    L.circleMarker(p, { radius: 4, color: '#fff', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.85 }).addTo(layerGroup),
  )
}

function randomRequest() {
  seq += 1
  request(`tile-${1 + (seq % 20)}`)
}

function hotRequest() {
  // 反复请求同一区域 → 命中缓存
  request('tile-3')
}

function setCapacity(value: any) {
  capacity.value = Number(value)
  cache.resize(capacity.value)
  keys.value = cache.keys() as string[]
}

function reset() {
  cache.clear()
  hits.value = 0
  misses.value = 0
  lastCost.value = 0
  keys.value = []
  layerGroup?.clearLayers()
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10 })
  layerGroup = L.layerGroup().addTo(map)
  return () => {
    map?.remove()
    map = null
    layerGroup = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      缓存：LRU 保存已请求的网格数据，重复访问直接复用；容量决定内存上限，超出淘汰最久未用的键
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-button size="small" type="primary" @click="randomRequest">请求新区域</el-button>
      <el-button size="small" @click="hotRequest">请求热门区域</el-button>
      <el-button size="small" @click="reset">重置</el-button>
      <span class="text-[12px] text-[#64748b]">容量 {{ capacity }}</span>
      <el-slider class="max-w-28" :model-value="capacity" :min="2" :max="20" :step="1" size="small" @input="setCapacity" />
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <el-tag size="small" effect="plain" type="success">命中 {{ hits }}</el-tag>
      <el-tag size="small" effect="plain" type="danger">未命中 {{ misses }}</el-tag>
      <el-tag size="small" effect="plain" type="info">命中率 {{ hitRate }}</el-tag>
      <el-tag v-if="lastKey" size="small" effect="plain" type="warning">{{ lastKey }} · {{ lastCost }}ms</el-tag>
    </div>
    <div class="flex items-center gap-1 flex-wrap text-[12px] text-[#475569]">
      <span class="text-[#94a3b8]">缓存键：</span>
      <el-tag v-for="k in keys" :key="k" size="small" type="info" effect="plain">{{ k }}</el-tag>
      <span v-if="!keys.length" class="text-[#9ca3af]">空</span>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
