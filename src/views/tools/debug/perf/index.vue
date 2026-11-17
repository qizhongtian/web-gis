<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, formatBytes } from '@/utils/tools/file'

interface TimingRow {
  label: string
  value: string
  hint?: string
}

const nav = ref<PerformanceNavigationTiming | null>(null)
const paint = ref<{ fp?: number; fcp?: number }>({})
const lcp = ref<number | null>(null)
const cls = ref(0)
const resources = ref<PerformanceResourceTiming[]>([])
const memory = ref<{ used: number; total: number } | null>(null)
const tick = ref(0)

let observer: PerformanceObserver | null = null
let lcpObserver: PerformanceObserver | null = null

const ms = (n?: number) => (n === undefined || !Number.isFinite(n) ? '—' : `${Math.round(n)} ms`)

const navRows = computed<TimingRow[]>(() => {
  const t = nav.value
  if (!t) return []
  return [
    { label: '重定向耗时', value: ms(t.redirectEnd - t.redirectStart), hint: 'redirect' },
    { label: 'DNS 查询', value: ms(t.domainLookupEnd - t.domainLookupStart), hint: 'DNS' },
    { label: 'TCP 连接', value: ms(t.connectEnd - t.connectStart), hint: '含 TLS 时更长' },
    { label: 'TLS 握手', value: ms(t.secureConnectionStart ? t.connectEnd - t.secureConnectionStart : 0), hint: 'HTTPS 才有' },
    { label: '请求响应（TTFB）', value: ms(t.responseStart - t.requestStart), hint: '首字节时间，服务端性能指标' },
    { label: '内容下载', value: ms(t.responseEnd - t.responseStart), hint: 'HTML 传输耗时' },
    { label: 'DOM 解析完成', value: ms(t.domContentLoadedEventEnd), hint: 'DOMContentLoaded' },
    { label: '页面完全加载', value: ms(t.loadEventEnd), hint: 'load 事件' },
    { label: '传输体积', value: formatBytes(t.transferSize || 0), hint: '含压缩后大小' },
  ]
})

const paintRows = computed<TimingRow[]>(() => [
  { label: '首次绘制 FP', value: ms(paint.value.fp), hint: '白屏结束' },
  { label: '首次内容绘制 FCP', value: ms(paint.value.fcp), hint: '首个文本/图片出现' },
  { label: '最大内容绘制 LCP', value: ms(lcp.value ?? undefined), hint: '≤ 2.5s 为良好' },
  { label: '累计布局偏移 CLS', value: cls.value ? cls.value.toFixed(3) : '0.000', hint: '≤ 0.1 为良好' },
])

const lcpLevel = computed(() => {
  const v = lcp.value ?? 0
  if (!lcp.value) return { text: '测量中', type: 'info' as const }
  if (v <= 2500) return { text: '良好', type: 'success' as const }
  if (v <= 4000) return { text: '需改进', type: 'warning' as const }
  return { text: '较差', type: 'danger' as const }
})

const resourceSummary = computed(() => {
  const map = new Map<string, { count: number; size: number; time: number }>()
  resources.value.forEach((r) => {
    const type = r.initiatorType || 'other'
    const prev = map.get(type) ?? { count: 0, size: 0, time: 0 }
    map.set(type, {
      count: prev.count + 1,
      size: prev.size + (r.transferSize || 0),
      time: prev.time + (r.duration || 0),
    })
  })
  return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.size - a.size)
})

const slowest = computed(() =>
  [...resources.value]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map((r) => ({
      name: r.name.split('/').pop()?.split('?')[0] || r.name,
      url: r.name,
      type: r.initiatorType,
      duration: Math.round(r.duration),
      size: r.transferSize || 0,
    })),
)

const totalTransfer = computed(() => resources.value.reduce((s, r) => s + (r.transferSize || 0), 0))

function collect() {
  tick.value++
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  nav.value = entry ?? null

  const paints = performance.getEntriesByType('paint')
  paint.value = {
    fp: paints.find((p) => p.name === 'first-paint')?.startTime,
    fcp: paints.find((p) => p.name === 'first-contentful-paint')?.startTime,
  }

  resources.value = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  if (mem) memory.value = { used: mem.usedJSHeapSize, total: mem.jsHeapSizeLimit }
}

function refresh() {
  collect()
  ElMessage.success('已刷新采集')
}

async function copy() {
  const text = [
    '导航耗时',
    ...navRows.value.map((r) => `${r.label}: ${r.value}`),
    '',
    '绘制与指标',
    ...paintRows.value.map((r) => `${r.label}: ${r.value}`),
    '',
    `资源数量: ${resources.value.length}`,
    `资源传输总量: ${formatBytes(totalTransfer.value)}`,
  ].join('\n')
  if (await copyText(text)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

onMounted(() => {
  collect()

  try {
    observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        const entry = e as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
        if (e.entryType === 'layout-shift' && !entry.hadRecentInput) cls.value += entry.value ?? 0
      })
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  } catch {
    observer = null
  }

  try {
    lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) lcp.value = last.startTime
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    lcpObserver = null
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  lcpObserver?.disconnect()
})
</script>

<template>
  <ToolPage title="性能面板" desc="读取 Performance API：导航耗时、绘制指标、资源体积与慢请求排行" wide>
    <template #actions>
      <el-tag size="small" :type="lcpLevel.type">LCP {{ lcpLevel.text }}</el-tag>
      <el-button size="small" @click="refresh">刷新采集</el-button>
      <el-button size="small" @click="copy">复制报告</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="grid gap-3 lg:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">
            核心指标
            <span class="text-[11px] font-normal text-[#9ca3af]">当前页面加载</span>
          </div>
          <div v-for="row in paintRows" :key="row.label" class="tool-kv">
            <span class="tool-kv-label">{{ row.label }}</span>
            <span class="tool-kv-value">{{ row.value }}</span>
            <span class="text-[11px] text-[#c0c4cc]">{{ row.hint }}</span>
          </div>
        </div>

        <div class="tool-card">
          <div class="tool-card-head">
            资源概览
            <span class="text-[11px] font-normal text-[#9ca3af]">{{ resources.length }} 个请求 · {{ formatBytes(totalTransfer) }}</span>
          </div>
          <div v-for="row in resourceSummary" :key="row.type" class="tool-kv">
            <span class="tool-kv-label">{{ row.type }}</span>
            <span class="tool-kv-value">{{ row.count }} 个 / {{ formatBytes(row.size) }}</span>
            <span class="text-[11px] text-[#c0c4cc]">累计 {{ Math.round(row.time) }} ms</span>
          </div>
          <p v-if="!resourceSummary.length" class="m-0 py-3 text-[12px] text-[#9ca3af]">暂无资源记录</p>
        </div>
      </div>

      <div class="tool-card">
        <div class="tool-card-head">导航耗时（Navigation Timing）</div>
        <div class="grid gap-x-6 gap-y-0 md:grid-cols-2">
          <div v-for="row in navRows" :key="row.label" class="tool-kv">
            <span class="tool-kv-label">{{ row.label }}</span>
            <span class="tool-kv-value text-[#2563eb]">{{ row.value }}</span>
            <span class="hidden text-[11px] text-[#c0c4cc] sm:inline">{{ row.hint }}</span>
          </div>
        </div>
        <p v-if="!navRows.length" class="m-0 py-3 text-[12px] text-[#9ca3af]">浏览器不支持 Navigation Timing Level 2</p>
      </div>

      <div class="tool-card">
        <div class="tool-card-head">
          最慢的 10 个请求
          <span class="text-[11px] font-normal text-[#9ca3af]">仅统计当前页面</span>
        </div>
        <div class="overflow-auto">
          <table class="tool-table">
            <thead>
              <tr>
                <th>资源</th>
                <th style="width: 90px">类型</th>
                <th style="width: 90px">耗时</th>
                <th style="width: 90px">体积</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in slowest" :key="item.url">
                <td class="font-mono text-[11.5px] break-all" :title="item.url">{{ item.name }}</td>
                <td class="text-[11px] text-[#9ca3af]">{{ item.type }}</td>
                <td class="whitespace-nowrap font-mono text-[11.5px]" :class="item.duration > 300 ? 'text-[#dc2626]' : 'text-[#374151]'">
                  {{ item.duration }} ms
                </td>
                <td class="whitespace-nowrap text-[11px] text-[#9ca3af]">{{ formatBytes(item.size) }}</td>
              </tr>
              <tr v-if="!slowest.length">
                <td colspan="4" class="py-6 text-center text-[12px] text-[#9ca3af]">暂无资源记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="memory" class="tool-card">
        <div class="tool-card-head">
          JS 堆内存（仅 Chromium 系）
          <span class="ml-auto text-[11px] font-normal text-[#9ca3af]">{{ formatBytes(memory.used) }} / {{ formatBytes(memory.total) }}</span>
        </div>
        <el-progress :percentage="Number(((memory.used / memory.total) * 100).toFixed(1))" :stroke-width="8" :show-text="false" />
      </div>

      <div class="tool-note">
        <p class="m-0">· 指标为当前会话实测，刷新页面后重新采集；生产环境建议接入 web-vitals 上报真实用户数据（RUM）。</p>
        <p class="m-0">· 优化顺序：先降体积（Code Splitting / 图片压缩），再减请求，最后才考虑微调渲染。</p>
      </div>
    </section>
  </ToolPage>
</template>
