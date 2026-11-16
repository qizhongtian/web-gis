<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText, formatBytes, readFileAsText } from '@/utils/tools/file'

const SAMPLE = `{
  "name": "web-gis",
  "version": "1.0.0",
  "private": true,
  "features": ["cesium", "openlayers", "leaflet"],
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "config": {
    "map": { "center": [116.397, 39.908], "zoom": 12 },
    "theme": { "dark": false, "primary": "#2563eb" }
  }
}`

const input = ref(SAMPLE)
const output = ref('')
const indent = ref<'2' | '4' | 'tab'>('2')
const error = ref('')
const fileRef = ref<HTMLInputElement>()
const copied = ref(false)

interface JsonStats {
  type: string
  keys: number
  nodes: number
  depth: number
  arrays: number
}

const stats = ref<JsonStats | null>(null)

const inputSize = computed(() => formatBytes(new TextEncoder().encode(input.value).length))
const outputSize = computed(() => formatBytes(new TextEncoder().encode(output.value).length))

function indentText() {
  return indent.value === 'tab' ? '\t' : Number(indent.value)
}

/** 递归排序对象键 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

function analyze(value: unknown, depth = 0): JsonStats {
  let keys = 0
  let nodes = 1
  let maxDepth = depth
  let arrays = 0
  if (Array.isArray(value)) {
    arrays++
    for (const item of value) {
      const sub = analyze(item, depth + 1)
      keys += sub.keys
      nodes += sub.nodes
      arrays += sub.arrays
      maxDepth = Math.max(maxDepth, sub.depth)
    }
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    keys += entries.length
    for (const [, item] of entries) {
      const sub = analyze(item, depth + 1)
      keys += sub.keys
      nodes += sub.nodes
      arrays += sub.arrays
      maxDepth = Math.max(maxDepth, sub.depth)
    }
  }
  return {
    type: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
    keys,
    nodes,
    depth: maxDepth,
    arrays,
  }
}

/** 解析并返回格式化文本；失败时给出行列位置 */
function parseInput(): { value: unknown } | null {
  error.value = ''
  stats.value = null
  if (!input.value.trim()) {
    error.value = '请输入 JSON 内容'
    return null
  }
  try {
    const value = JSON.parse(input.value)
    stats.value = analyze(value)
    return { value }
  } catch (e) {
    const raw = (e as Error).message
    const lineMatch = /line (\d+) column (\d+)/.exec(raw)
    const posMatch = /position (\d+)/.exec(raw)
    let where = ''
    if (lineMatch) {
      where = `（第 ${lineMatch[1]} 行，第 ${lineMatch[2]} 列）`
    } else if (posMatch) {
      const pos = Number(posMatch[1])
      const before = input.value.slice(0, pos)
      const line = before.split('\n').length
      const col = pos - before.lastIndexOf('\n')
      where = `（第 ${line} 行，第 ${col} 列）`
    }
    error.value = `JSON 语法错误${where}：${raw}`
    return null
  }
}

function formatJson() {
  const parsed = parseInput()
  if (!parsed) return
  output.value = JSON.stringify(parsed.value, null, indentText())
  ElMessage.success('格式化完成')
}

function minify() {
  const parsed = parseInput()
  if (!parsed) return
  output.value = JSON.stringify(parsed.value)
  ElMessage.success('已压缩')
}

function validate() {
  const parsed = parseInput()
  if (parsed) ElMessage.success('JSON 格式合法')
}

function sortKeys() {
  const parsed = parseInput()
  if (!parsed) return
  output.value = JSON.stringify(sortValue(parsed.value), null, indentText())
  ElMessage.success('键名已按字母排序')
}

/** 将文本转成 JSON 字符串字面量（转义） */
function escapeText() {
  error.value = ''
  output.value = JSON.stringify(input.value)
  ElMessage.success('转义完成')
}

function unescapeText() {
  error.value = ''
  const raw = input.value.trim()
  try {
    const value = JSON.parse(raw.startsWith('"') ? raw : `"${raw.replace(/"/g, '\\"')}"`)
    output.value = typeof value === 'string' ? value : JSON.stringify(value, null, indentText())
    ElMessage.success('反转义完成')
  } catch (e) {
    error.value = `反转义失败：${(e as Error).message}`
  }
}

/** 对象 → a=1&b=2 形式，便于拼接 query */
function toQuery() {
  const parsed = parseInput()
  if (!parsed) return
  const value = parsed.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    error.value = '仅支持顶层为对象的 JSON 转为 QueryString'
    return
  }
  const params = new URLSearchParams()
  const walk = (v: unknown, prefix: string) => {
    if (v === null || v === undefined) return
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, prefix))
    } else if (typeof v === 'object') {
      Object.entries(v as Record<string, unknown>).forEach(([k, vv]) =>
        walk(vv, prefix ? `${prefix}[${k}]` : k),
      )
    } else {
      params.append(prefix, String(v))
    }
  }
  walk(value, '')
  output.value = params.toString()
  ElMessage.success('已转为 QueryString')
}

async function copyOutput() {
  if (!output.value) return ElMessage.info('请先生成结果')
  if (await copyText(output.value)) {
    copied.value = true
    ElMessage.success('结果已复制')
    window.setTimeout(() => (copied.value = false), 1500)
  } else ElMessage.error('复制失败')
}

function useOutputAsInput() {
  if (!output.value) return
  input.value = output.value
}

function importFileFromDisk() {
  fileRef.value?.click()
}

async function importFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    input.value = await readFileAsText(file)
    ElMessage.success(`已载入 ${file.name}`)
  } catch {
    ElMessage.error('文件读取失败')
  }
  ;(e.target as HTMLInputElement).value = ''
}

function exportJson() {
  const content = output.value || input.value
  if (!content) return
  downloadText(content, 'data.json', 'application/json;charset=utf-8')
}

function clearAll() {
  input.value = ''
  output.value = ''
  error.value = ''
  stats.value = null
}
</script>

<template>
  <ToolPage title="JSON 工具" desc="格式化、压缩、校验、键排序、转义 / 反转义、转 QueryString" wide>
    <template #actions>
      <el-button size="small" @click="importFileFromDisk">载入文件</el-button>
      <el-button size="small" @click="exportJson">下载 JSON</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <input ref="fileRef" type="file" accept=".json,application/json,text/plain" class="hidden" @change="importFile" />
    </template>

    <section class="app-panel p-3 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-button size="small" type="primary" @click="formatJson">格式化</el-button>
        <el-button size="small" @click="minify">压缩</el-button>
        <el-button size="small" @click="validate">校验</el-button>
        <el-button size="small" @click="sortKeys">键排序</el-button>
        <el-button size="small" @click="escapeText">转义</el-button>
        <el-button size="small" @click="unescapeText">反转义</el-button>
        <el-button size="small" @click="toQuery">转 Query</el-button>
        <span class="mx-1 h-4 w-px bg-[#e6e8eb]" />
        <span class="text-[12px] text-[#6b7280]">缩进</span>
        <el-select v-model="indent" size="small" style="width: 88px">
          <el-option label="2 空格" value="2" />
          <el-option label="4 空格" value="4" />
          <el-option label="Tab" value="tab" />
        </el-select>
        <el-button size="small" text @click="input = SAMPLE">填充示例</el-button>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div v-if="stats" class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div v-for="item in [
          { label: '根类型', value: stats.type },
          { label: '键数量', value: stats.keys },
          { label: '节点数', value: stats.nodes },
          { label: '最大层级', value: stats.depth },
          { label: '数组个数', value: stats.arrays },
        ]" :key="item.label" class="stat-cell">
          <span class="stat-label">{{ item.label }}</span>
          <span class="stat-value">{{ item.value }}</span>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="flex flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">输入</span>
            <span class="text-[11px] text-[#9ca3af]">{{ inputSize }} · {{ input.split('\n').length }} 行</span>
            <el-button size="small" text class="ml-auto" @click="input = ''">清空</el-button>
          </div>
          <textarea v-model="input" class="io-box" spellcheck="false" placeholder="粘贴 JSON 文本…" />
        </div>

        <div class="flex flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">结果</span>
            <span class="text-[11px] text-[#9ca3af]">{{ outputSize }}</span>
            <div class="ml-auto flex items-center gap-1">
              <el-button size="small" text :disabled="!output" @click="useOutputAsInput">回填输入</el-button>
              <el-button size="small" text :disabled="!output" @click="copyOutput">
                {{ copied ? '已复制' : '复制' }}
              </el-button>
            </div>
          </div>
          <textarea v-model="output" class="io-box" spellcheck="false" placeholder="处理结果将显示在这里…" />
        </div>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.io-box {
  display: block;
  width: 100%;
  height: calc(100vh - 430px);
  min-height: 240px;
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  outline: none;
  resize: vertical;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  tab-size: 2;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.io-box:focus {
  border-color: #bfd4fb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
  background: #fff;
}
.stat-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fafbfc;
}
.stat-label {
  font-size: 11.5px;
  color: #9ca3af;
}
.stat-value {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: #2563eb;
}
</style>
