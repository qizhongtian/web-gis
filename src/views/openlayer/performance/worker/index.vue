<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const COUNT = 200000
const COLS = 28
const ROWS = 22
const BBOX: [number, number, number, number] = [116.05, 39.68, 116.75, 40.16]

const status = ref('待开始')
const workerCost = ref('—')
const mainCost = ref('—')
const cells = ref(0)

let map: any = null
let ol: any = null
let layer: any = null
let source: any = null
let worker: Worker | null = null

/** 在 Worker 中生成 20 万个点并做网格聚合，主线程只负责组装面要素 */
const workerCode = `
self.onmessage = (e) => {
  const { count, cols, rows } = e.data
  const start = performance.now()
  const buckets = new Array(cols * rows).fill(0)
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(Math.random() * cols)
    const cy = Math.floor(Math.random() * rows)
    buckets[cy * cols + cx] += 1
  }
  self.postMessage({ buckets, cols, rows, elapsed: performance.now() - start })
}
`

function ensureWorker() {
  if (worker) return worker
  const url = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }))
  worker = new Worker(url)
  worker.onmessage = (e: MessageEvent) => {
    const started = performance.now()
    const { buckets, cols, rows, elapsed } = e.data
    const dx = (BBOX[2] - BBOX[0]) / cols
    const dy = (BBOX[3] - BBOX[1]) / rows
    const max = Math.max(...buckets)
    const features: any[] = []

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const value = buckets[y * cols + x]
        if (!value) continue
        const extent = ol.transformExtent(
          [BBOX[0] + x * dx, BBOX[1] + y * dy, BBOX[0] + (x + 1) * dx, BBOX[1] + (y + 1) * dy],
          'EPSG:4326',
          'EPSG:3857',
        )
        features.push(
          new ol.Feature({
            geometry: ol.polygonFromExtent(extent),
            value,
            ratio: value / max,
          }),
        )
      }
    }

    source.clear()
    source.addFeatures(features)
    cells.value = features.length
    workerCost.value = `${elapsed.toFixed(1)} ms`
    mainCost.value = `${(performance.now() - started).toFixed(1)} ms`
    status.value = `完成：${COUNT.toLocaleString()} 点 → ${features.length} 个网格`
  }
  return worker
}

function run() {
  if (!worker && !ol) return
  status.value = 'Worker 计算中…'
  ensureWorker().postMessage({ count: COUNT, cols: COLS, rows: ROWS })
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  source = new lib.VectorSource()
  layer = new lib.VectorLayer({
    source,
    style: (feature: any) => {
      const ratio = Number(feature.get('ratio') ?? 0)
      return new lib.Style({
        fill: new lib.Fill({
          color: `rgba(${Math.round(34 + 221 * ratio)},${Math.round(211 - 140 * ratio)},${Math.round(238 - 200 * ratio)},0.75)`,
        }),
        stroke: new lib.Stroke({ color: 'rgba(255,255,255,0.35)', width: 0.5 }),
      })
    },
  })

  map = createDemoMap(lib, el, { center: [116.4, 39.92], zoom: 10, base: 'light', layers: [layer] })
  ensureWorker()
  run()

  return () => {
    worker?.terminate()
    worker = null
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      Worker：耗时计算放进 Web Worker，主线程不阻塞，返回结果后一次性构建要素（20 万点 → 网格聚合）
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="run">重新计算</el-button>
      <el-tag size="small" type="success" effect="plain">{{ status }}</el-tag>
      <el-tag size="small" effect="plain">Worker 耗时 {{ workerCost }}</el-tag>
      <el-tag size="small" effect="plain">主线程组装 {{ mainCost }}</el-tag>
      <el-tag size="small" type="info" effect="plain">网格数 {{ cells }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
