<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const pad = (n: number, len = 2) => String(n).padStart(len, '0')
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const running = ref(true)
const now = ref(Date.now())
let timer = 0

const tsInput = ref(String(Math.floor(Date.now() / 1000)))
const dateValue = ref<Date>(new Date())

function tick() {
  if (running.value) now.value = Date.now()
}

onMounted(() => {
  timer = window.setInterval(tick, 200)
})
onUnmounted(() => window.clearInterval(timer))

const nowDate = computed(() => new Date(now.value))

/** 判断时间戳单位：>= 1e11 视为毫秒 */
function toDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const num = Number(s)
  if (!Number.isFinite(num)) return null
  const ms = Math.abs(num) >= 1e11 ? num : num * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

const parsedDate = computed(() => toDate(tsInput.value))
const parsedUnit = computed(() => {
  const s = tsInput.value.trim()
  if (!/^-?\d+$/.test(s)) return ''
  return Math.abs(Number(s)) >= 1e11 ? '毫秒（13 位）' : '秒（10 位）'
})

const tzOffset = computed(() => {
  const offset = -new Date().getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
})

function fmtDate(d: Date, pattern: string): string {
  const map: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
    SSS: pad(d.getMilliseconds(), 3),
  }
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (k) => map[k] ?? k)
}

function relative(d: Date): string {
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [1000 * 60 * 60 * 24 * 365, '年'],
    [1000 * 60 * 60 * 24 * 30, '个月'],
    [1000 * 60 * 60 * 24, '天'],
    [1000 * 60 * 60, '小时'],
    [1000 * 60, '分钟'],
    [1000, '秒'],
  ]
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const value = Math.floor(abs / ms)
      return diff >= 0 ? `${value} ${label}后` : `${value} ${label}前`
    }
  }
  return '刚刚'
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
}

const resultRows = computed(() => {
  const d = parsedDate.value
  if (!d) return []
  const seconds = Math.floor(d.getTime() / 1000)
  return [
    { label: '本地时间', value: fmtDate(d, 'YYYY-MM-DD HH:mm:ss'), key: 'local' },
    { label: '本地时间（带毫秒）', value: fmtDate(d, 'YYYY-MM-DD HH:mm:ss.SSS'), key: 'local-ms' },
    { label: 'ISO 8601', value: d.toISOString(), key: 'iso' },
    { label: 'UTC 时间', value: d.toUTCString(), key: 'utc' },
    { label: 'RFC 2822', value: d.toUTCString().replace('GMT', '+0000'), key: 'rfc' },
    { label: '中文格式', value: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${fmtDate(d, 'HH:mm:ss')}`, key: 'cn' },
    { label: '日期', value: fmtDate(d, 'YYYY-MM-DD'), key: 'date' },
    { label: '时间', value: fmtDate(d, 'HH:mm:ss'), key: 'time' },
    { label: '星期', value: WEEK[d.getDay()], key: 'week' },
    { label: '毫秒时间戳', value: String(d.getTime()), key: 'ms' },
    { label: '秒时间戳', value: String(seconds), key: 'sec' },
    { label: '第几天 / 第几周', value: `第 ${dayOfYear(d)} 天 · 第 ${Math.ceil(dayOfYear(d) / 7)} 周`, key: 'doy' },
    { label: '季度', value: `第 ${Math.floor(d.getMonth() / 3) + 1} 季度`, key: 'quarter' },
    { label: '相对现在', value: relative(d), key: 'rel' },
  ]
})

const reverseRows = computed(() => {
  const d = dateValue.value
  if (!d || Number.isNaN(d.getTime())) return []
  return [
    { label: '秒级时间戳', value: String(Math.floor(d.getTime() / 1000)), key: 'rev-sec' },
    { label: '毫秒级时间戳', value: String(d.getTime()), key: 'rev-ms' },
    { label: 'ISO 8601', value: d.toISOString(), key: 'rev-iso' },
    { label: '本地时间', value: fmtDate(d, 'YYYY-MM-DD HH:mm:ss'), key: 'rev-local' },
  ]
})

const copiedKey = ref('')

async function copy(value: string, key: string) {
  if (await copyText(value)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  } else ElMessage.error('复制失败')
}

function useNow() {
  tsInput.value = String(Math.floor(Date.now() / 1000))
}

function toNowDate() {
  dateValue.value = new Date()
}

/** 时间戳快捷偏移 */
function shiftTs(ms: number) {
  const d = parsedDate.value ?? new Date()
  tsInput.value = String(Math.floor((d.getTime() + ms) / 1000))
}

/** 从当前时间戳生成到反向转换 */
function fillReverse() {
  const d = parsedDate.value
  if (!d) return
  dateValue.value = new Date(d.getTime())
  ElMessage.success('已填入上方时间')
}
</script>

<template>
  <ToolPage title="时间戳转换" desc="Unix 时间戳与日期互转，自动识别秒 / 毫秒，含多种常用格式" wide>
    <template #actions>
      <el-tag size="small" type="info" class="!text-[11px]">{{ tzOffset }}</el-tag>
      <el-button size="small" @click="running = !running">{{ running ? '暂停' : '继续' }}</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <!-- 当前时间 -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-gradient-to-r from-[#eef4ff] to-[#f5f3ff] px-4 py-3">
        <div>
          <div class="text-[11px] text-[#6b7280]">当前时间</div>
          <div class="mt-0.5 font-mono text-[19px] font-semibold leading-none text-[#1d4ed8]">
            {{ fmtDate(nowDate, 'YYYY-MM-DD HH:mm:ss') }}
            <span class="text-[12px] text-[#6b7280]">.{{ pad(nowDate.getMilliseconds(), 3) }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="ts-chip" @click="copy(String(Math.floor(now / 1000)), 'now-sec')">
            秒 {{ Math.floor(now / 1000) }}
          </button>
          <button type="button" class="ts-chip" @click="copy(String(now), 'now-ms')">毫秒 {{ now }}</button>
        </div>
        <div class="ml-auto text-[11.5px] text-[#6b7280]">{{ WEEK[nowDate.getDay()] }} · {{ tzOffset }}</div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <!-- 时间戳 → 日期 -->
        <div class="rounded-xl border border-[#eef0f3] p-3">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[13px] font-medium text-[#374151]">时间戳 → 日期</span>
            <span v-if="parsedUnit" class="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[10.5px] text-[#6b7280]">{{ parsedUnit }}</span>
            <el-button size="small" text class="ml-auto" @click="useNow">当前时间</el-button>
          </div>
          <el-input v-model="tsInput" placeholder="输入 10 位秒级或 13 位毫秒级时间戳" clearable class="font-mono" />
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] text-[#9ca3af]">快捷</span>
            <button type="button" class="ts-chip" @click="shiftTs(-3600_000)">-1 小时</button>
            <button type="button" class="ts-chip" @click="shiftTs(-86400_000)">-1 天</button>
            <button type="button" class="ts-chip" @click="shiftTs(86400_000)">+1 天</button>
            <button type="button" class="ts-chip" @click="shiftTs(7 * 86400_000)">+1 周</button>
            <el-button size="small" text class="!ml-auto" :disabled="!parsedDate" @click="fillReverse">填入右侧</el-button>
          </div>

          <el-alert v-if="!parsedDate && tsInput" title="无效的时间戳" type="warning" show-icon :closable="false" class="mt-2 !py-1.5" />

          <div v-if="parsedDate" class="mt-2 divide-y divide-[#f3f4f6]">
            <div v-for="row in resultRows" :key="row.key" class="flex items-center gap-3 py-1.5">
              <span class="w-[124px] shrink-0 text-[11.5px] text-[#9ca3af]">{{ row.label }}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#1f2328]" :title="row.value">{{ row.value }}</span>
              <button type="button" class="ts-copy" @click="copy(row.value, row.key)">
                {{ copiedKey === row.key ? '已复制' : '复制' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 日期 → 时间戳 -->
        <div class="rounded-xl border border-[#eef0f3] p-3">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[13px] font-medium text-[#374151]">日期 → 时间戳</span>
            <el-button size="small" text class="ml-auto" @click="toNowDate">设为当前</el-button>
          </div>
          <el-date-picker
            v-model="dateValue"
            type="datetime"
            placeholder="选择日期时间"
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />

          <div class="mt-2 divide-y divide-[#f3f4f6]">
            <div v-for="row in reverseRows" :key="row.key" class="flex items-center gap-3 py-1.5">
              <span class="w-[124px] shrink-0 text-[11.5px] text-[#9ca3af]">{{ row.label }}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#1f2328]" :title="row.value">{{ row.value }}</span>
              <button type="button" class="ts-copy" @click="copy(row.value, row.key)">
                {{ copiedKey === row.key ? '已复制' : '复制' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-[#fafbfc] p-2.5 text-[11.5px] leading-relaxed text-[#6b7280]">
        说明：10 位为秒级时间戳，13 位为毫秒级；本页按浏览器本地时区（{{ tzOffset }}）展示，ISO / UTC 格式为世界标准时间。
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.ts-chip {
  padding: 2px 8px;
  border: 1px solid #e6e8eb;
  border-radius: 999px;
  background: #fff;
  color: #4b5563;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ts-chip:hover {
  border-color: #c7d7fb;
  background: #eef4ff;
  color: #2563eb;
}
.ts-copy {
  flex: none;
  padding: 1px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
}
.ts-copy:hover {
  background: #eef4ff;
  color: #2563eb;
}
</style>
