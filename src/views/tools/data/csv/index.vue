<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText, formatBytes } from '@/utils/tools/file'

const SAMPLE_CSV = `id,name,city,score,active
1,张三,北京,92,true
2,李四,上海,85.5,false
3,"王五, 小五",深圳,78,true`

const mode = ref<'csv2json' | 'json2csv'>('csv2json')
const input = ref(SAMPLE_CSV)
const output = ref('')
const error = ref('')
const delimiter = ref<'auto' | ',' | ';' | '\t' | '|'>('auto')
const delimiters = [
  { label: '自动识别', value: 'auto' },
  { label: '逗号 ,', value: ',' },
  { label: '分号 ;', value: ';' },
  { label: '制表符 Tab', value: '\t' },
  { label: '竖线 |', value: '|' },
]
const hasHeader = ref(true)
const inferTypes = ref(true)

/** 自动识别分隔符：取首行出现次数最多的候选 */
function detectDelimiter(text: string): string {
  if (delimiter.value !== 'auto') return delimiter.value
  const firstLine = text.split(/\r?\n/)[0] || ''
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = -1
  candidates.forEach((c) => {
    const count = firstLine.split(c).length - 1
    if (count > bestCount) {
      best = c
      bestCount = count
    }
  })
  return best
}

/** 解析 CSV：支持引号包裹、转义双引号、字段内换行 */
function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // 忽略，交给 \n 处理
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function castValue(raw: string): string | number | boolean | null {
  const v = raw.trim()
  if (!inferTypes.value) return raw
  if (v === '') return ''
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v)
  return raw
}

const parsedRows = computed(() => {
  error.value = ''
  if (!input.value.trim()) return []
  try {
    return parseCsv(input.value, detectDelimiter(input.value))
  } catch (e) {
    error.value = `CSV 解析失败：${(e as Error).message}`
    return []
  }
})

const stats = computed(() => {
  const rows = parsedRows.value
  if (!rows.length) return null
  const cols = Math.max(...rows.map((r) => r.length))
  return { rows: hasHeader.value ? rows.length - 1 : rows.length, cols, bytes: formatBytes(new TextEncoder().encode(input.value).length) }
})

function run() {
  error.value = ''
  output.value = ''
  if (mode.value === 'csv2json') return csvToJson()
  return jsonToCsv()
}

function csvToJson() {
  const rows = parsedRows.value
  if (!rows.length) {
    error.value = '没有可解析的数据'
    return
  }
  const header = hasHeader.value ? rows[0].map((h, i) => h.trim() || `column${i + 1}`) : rows[0].map((_, i) => `column${i + 1}`)
  const body = hasHeader.value ? rows.slice(1) : rows
  const list = body.map((r) => {
    const obj: Record<string, unknown> = {}
    header.forEach((key, i) => (obj[key] = castValue(r[i] ?? '')))
    return obj
  })
  output.value = JSON.stringify(list, null, 2)
  ElMessage.success(`已转换 ${list.length} 行`)
}

/** 把任意值拍平成 CSV 单元格 */
function cellOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function escapeCell(value: string, sep: string): string {
  if (value.includes('"') || value.includes('\n') || value.includes(sep)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function jsonToCsv() {
  let data: unknown
  try {
    data = JSON.parse(input.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message}`
    return
  }
  const list = Array.isArray(data) ? data : [data]
  if (!list.length) {
    error.value = 'JSON 数组为空'
    return
  }
  const sep = delimiter.value === 'auto' ? ',' : delimiter.value
  // 收集并集键，保持首次出现顺序
  const keys: string[] = []
  list.forEach((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item as Record<string, unknown>).forEach((k) => {
        if (!keys.includes(k)) keys.push(k)
      })
    }
  })
  if (!keys.length) {
    error.value = '仅支持对象数组（或单个对象）转 CSV'
    return
  }
  const head = keys.map((k) => escapeCell(k, sep)).join(sep)
  const body = list.map((item) =>
    keys.map((k) => escapeCell(cellOf((item as Record<string, unknown>)?.[k]), sep)).join(sep),
  )
  output.value = [head, ...body].join('\n')
  ElMessage.success(`已转换 ${list.length} 行`)
}

const outputSize = computed(() => formatBytes(new TextEncoder().encode(output.value).length))

async function copy() {
  if (!output.value) return ElMessage.info('请先转换')
  if (await copyText(output.value)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

function download() {
  if (!output.value) return
  const isJson = mode.value === 'csv2json'
  downloadText(output.value, isJson ? 'data.json' : 'data.csv', isJson ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8')
}

function loadSample() {
  mode.value = 'csv2json'
  input.value = SAMPLE_CSV
  output.value = ''
  error.value = ''
}

function swapMode() {
  mode.value = mode.value === 'csv2json' ? 'json2csv' : 'csv2json'
  if (output.value) {
    input.value = output.value
    output.value = ''
  }
}
</script>

<template>
  <ToolPage title="CSV ↔ JSON" desc="CSV 与 JSON 互转，支持自定义分隔符、表头与数值类型推断" wide>
    <template #actions>
      <el-button size="small" @click="loadSample">填充示例</el-button>
      <el-button size="small" @click="swapMode">切换方向</el-button>
      <el-button size="small" @click="input = ''; output = ''">清空</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="csv2json">CSV → JSON</el-radio-button>
          <el-radio-button value="json2csv">JSON → CSV</el-radio-button>
        </el-radio-group>
        <span class="mx-1 h-4 w-px bg-[#e6e8eb]" />
        <span class="text-[12px] text-[#6b7280]">分隔符</span>
        <el-select v-model="delimiter" size="small" style="width: 130px">
          <el-option v-for="d in delimiters" :key="d.label" :label="d.label" :value="d.value" />
        </el-select>
        <template v-if="mode === 'csv2json'">
          <el-checkbox v-model="hasHeader" size="small">首行为表头</el-checkbox>
          <el-checkbox v-model="inferTypes" size="small">推断数字 / 布尔</el-checkbox>
        </template>
        <el-button size="small" type="primary" class="ml-auto" @click="run">转换</el-button>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div v-if="stats" class="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-[#6b7280]">
        <span>数据行 {{ stats.rows }}</span>
        <span>列数 {{ stats.cols }}</span>
        <span>输入体积 {{ stats.bytes }}</span>
        <span v-if="output">输出体积 {{ outputSize }}</span>
      </div>

      <div class="grid flex-1 gap-3 lg:grid-cols-2">
        <div class="flex min-h-[240px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">{{ mode === 'csv2json' ? 'CSV' : 'JSON' }}</span>
            <span class="text-[11px] text-[#9ca3af]">{{ input.split('\n').length }} 行</span>
          </div>
          <textarea v-model="input" class="tool-io flex-1" spellcheck="false" placeholder="粘贴内容…" />
        </div>

        <div class="flex min-h-[240px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">{{ mode === 'csv2json' ? 'JSON' : 'CSV' }}</span>
            <div class="ml-auto flex items-center gap-1">
              <el-button size="small" text :disabled="!output" @click="input = output; output = ''">回填输入</el-button>
              <el-button size="small" text :disabled="!output" @click="copy">复制</el-button>
              <el-button size="small" text :disabled="!output" @click="download">下载</el-button>
            </div>
          </div>
          <textarea v-model="output" class="tool-io flex-1" spellcheck="false" placeholder="转换结果…" />
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 解析支持引号包裹、字段内逗号与换行、`""` 转义双引号，兼容 Excel 导出的 CSV。</p>
        <p class="m-0">· JSON → CSV 会取所有对象的键并集作为表头，缺失字段留空，嵌套对象序列化为 JSON 字符串。</p>
      </div>
    </section>
  </ToolPage>
</template>
