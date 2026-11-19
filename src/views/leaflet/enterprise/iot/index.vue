<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, randomPoints, seeded } from '@/utils/gis/leafletDemo'

type Status = 'normal' | 'warn' | 'offline'

interface Device {
  id: string
  name: string
  ll: [number, number]
  status: Status
  temp: number
}

const devices = ref<Device[]>([])
const autoRefresh = ref(true)
const selected = ref('')

let map: any = null
let L: any = null
let layerGroup: any = null
let markers: Record<string, any> = {}
let timer = 0

const COLOR: Record<Status, string> = { normal: '#10b981', warn: '#ef4444', offline: '#94a3b8' }
const LABEL: Record<Status, string> = { normal: '正常', warn: '告警', offline: '离线' }

function icon(status: Status) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${COLOR[status]};
      border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function build() {
  const rnd = seeded(202611)
  const pts = randomPoints(12, [116.16, 39.74, 116.64, 40.06], 202611)
  devices.value = pts.map((ll, i) => ({
    id: `DEV-${String(i + 1).padStart(3, '0')}`,
    name: `监测点 ${i + 1}`,
    ll,
    status: rnd() > 0.72 ? 'warn' : 'normal',
    temp: Number((18 + rnd() * 12).toFixed(1)),
  }))
}

function render() {
  if (!map) return
  layerGroup.clearLayers()
  markers = {}
  devices.value.forEach((d) => {
    const m = L.marker(d.ll, { icon: icon(d.status) })
      .addTo(layerGroup)
      .bindTooltip(`${d.id} · ${LABEL[d.status]}`, { direction: 'top', offset: [0, -10] })
      .bindPopup(
        `<div style="font-size:12px;line-height:1.8"><b>${d.name}</b><br/>编号：${d.id}<br/>状态：${LABEL[d.status]}<br/>温度：${d.temp}℃<br/>坐标：${d.ll[0].toFixed(4)}, ${d.ll[1].toFixed(4)}</div>`,
      )
    m.on('click', () => {
      selected.value = `${d.id} ${LABEL[d.status]} ${d.temp}℃`
    })
    markers[d.id] = m
  })
}

function tick() {
  // 模拟设备心跳：随机翻转个别设备状态与温度
  devices.value = devices.value.map((d) => {
    const roll = Math.random()
    let status = d.status
    if (roll > 0.92) status = d.status === 'warn' ? 'normal' : 'warn'
    else if (roll > 0.88) status = d.status === 'offline' ? 'normal' : 'offline'
    return { ...d, status, temp: Number(Math.max(12, Math.min(36, d.temp + (Math.random() - 0.5))).toFixed(1)) }
  })
  render()
}

function focus(d: Device) {
  selected.value = `${d.id} ${LABEL[d.status]} ${d.temp}℃`
  map?.flyTo(d.ll, 14, { duration: 0.8 })
  markers[d.id]?.openPopup()
}

function setAuto(value: any) {
  autoRefresh.value = Boolean(value)
  if (autoRefresh.value && timer === 0) timer = window.setInterval(tick, 2500)
  if (!autoRefresh.value) {
    window.clearInterval(timer)
    timer = 0
  }
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.4], zoom: 10, base: 'dark' })
  layerGroup = L.layerGroup().addTo(map)
  build()
  render()
  timer = window.setInterval(tick, 2500)
  return () => {
    window.clearInterval(timer)
    timer = 0
    map?.remove()
    map = null
    layerGroup = null
    markers = {}
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      物联网监控：设备状态用图标颜色表达，心跳刷新只更新变化的要素，列表点击与地图联动
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <el-switch :model-value="autoRefresh" size="small" active-text="心跳刷新" @change="setAuto" />
      <el-tag size="small" effect="plain" type="success">
        正常 {{ devices.filter((d) => d.status === 'normal').length }}
      </el-tag>
      <el-tag size="small" effect="plain" type="danger">
        告警 {{ devices.filter((d) => d.status === 'warn').length }}
      </el-tag>
      <el-tag size="small" effect="plain" type="info">
        离线 {{ devices.filter((d) => d.status === 'offline').length }}
      </el-tag>
      <span v-if="selected" class="text-[12px] text-[#64748b]">{{ selected }}</span>
    </div>
    <div class="max-h-32 overflow-auto rounded border border-[#e6e8eb]">
      <div
        v-for="d in devices"
        :key="d.id"
        class="flex items-center gap-3 px-2 py-1 text-[12px] cursor-pointer hover:bg-[#f6f8fa] border-b border-[#f1f3f5] last:border-0"
        @click="focus(d)"
      >
        <i class="inline-block w-2.5 h-2.5 rounded-full" :style="{ background: COLOR[d.status] }"></i>
        <span class="w-20 text-[#334155]">{{ d.id }}</span>
        <span class="flex-1 text-[#64748b]">{{ d.name }}</span>
        <span class="text-[#94a3b8]">{{ d.temp }}℃</span>
        <span :style="{ color: COLOR[d.status] }">{{ LABEL[d.status] }}</span>
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
