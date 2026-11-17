<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText } from '@/utils/tools/file'

const SAMPLE = `{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1001,
    "name": "web-gis",
    "tags": ["cesium", "openlayers"],
    "center": { "lng": 116.397, "lat": 39.908 },
    "layers": [
      { "id": 1, "title": "影像", "visible": true, "opacity": 0.8 },
      { "id": 2, "title": "矢量", "visible": false }
    ],
    "updatedAt": "2026-11-17T10:00:00Z",
    "deletedAt": null
  }
}`

const input = ref(SAMPLE)
const rootName = ref('Root')
const useExport = ref(true)
const readonlyProps = ref(false)
const optionalWhenMissing = ref(true)
const useInterface = ref(true)
const output = ref('')
const error = ref('')

const pascal = (raw: string) =>
  raw
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Item'

const isSafeKey = (key: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
const propKey = (key: string) => (isSafeKey(key) ? key : `'${key.replace(/'/g, "\\'")}'`)
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const isObjectLike = (v: unknown) => isPlainObject(v)

function generate() {
  error.value = ''
  output.value = ''
  if (!input.value.trim()) {
    error.value = '请输入 JSON'
    return
  }

  let data: unknown
  try {
    data = JSON.parse(input.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message}`
    return
  }

  const blocks: string[] = []
  const used = new Set<string>()
  const keyword = useInterface.value ? 'interface' : 'type'

  function uniqueName(hint: string) {
    let name = pascal(hint)
    if (!name) name = 'Item'
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    let i = 2
    while (used.has(`${name}${i}`)) i++
    const next = `${name}${i}`
    used.add(next)
    return next
  }

  /** 对象 → 生成一个命名类型块，返回类型名 */
  function emitObject(hint: string, obj: Record<string, unknown>, depth: number, extraOptional?: Set<string>): string {
    const name = uniqueName(hint)
    const keys = Object.keys(obj)
    const members: string[] = []

    keys.forEach((key) => {
      const value = obj[key]
      const type = typeOf(value, `${name}${pascal(key)}`, depth + 1)
      const missing = value === null || value === undefined || extraOptional?.has(key)
      const optional = optionalWhenMissing.value && missing ? '?' : ''
      const readonly = readonlyProps.value ? 'readonly ' : ''
      members.push(`${'  '.repeat(depth + 1)}${readonly}${propKey(key)}${optional}: ${type}`)
    })

    if (!members.length) members.push(`${'  '.repeat(depth + 1)}[key: string]: unknown`)

    const head = `${'  '.repeat(depth)}${useExport.value ? 'export ' : ''}${keyword} ${name}${useInterface.value ? '' : ' ='} {`
    blocks.push(`${head}\n${members.join('\n')}\n${'  '.repeat(depth)}}`)
    return name
  }

  /** 数组 → 合并对象元素后生成一个 Item 类型 */
  function emitArray(hint: string, list: unknown[], depth: number): string {
    if (!list.length) return 'unknown[]'
    const objects = list.filter(isPlainObject)
    if (objects.length) {
      const merged: Record<string, unknown> = {}
      const missing = new Set<string>()
      objects.forEach((obj) => {
        Object.keys(obj).forEach((key) => {
          const value = obj[key]
          if (!(key in merged) || merged[key] === null || merged[key] === undefined) merged[key] = value
          if (value === null || value === undefined) missing.add(key)
        })
        // 同数组中其他元素缺失的键也能被识别为可选
        Object.keys(merged).forEach((key) => {
          if (!(key in obj)) missing.add(key)
        })
      })
      const name = emitObject(`${hint}Item`, merged, depth, missing)
      return `${name}[]`
    }
    const types = [...new Set(list.map((v) => primitiveType(v)))]
    return `${types.length > 1 ? `(${types.join(' | ')})` : types[0]}[]`
  }

  function primitiveType(value: unknown): string {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'unknown[]'
    switch (typeof value) {
      case 'string':
        return 'string'
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      default:
        return 'unknown'
    }
  }

  function typeOf(value: unknown, hint: string, depth: number): string {
    if (isObjectLike(value)) return emitObject(hint, value, depth)
    if (Array.isArray(value)) return emitArray(hint, value, depth)
    return primitiveType(value)
  }

  const name = pascal(rootName.value)
  if (isObjectLike(data)) {
    emitObject(name, data, 0)
    output.value = blocks.join('\n\n')
  } else if (Array.isArray(data)) {
    const type = emitArray(name, data, 0)
    const alias = `${useExport.value ? 'export ' : ''}type ${name} = ${type}`
    output.value = [alias, ...blocks].join('\n\n')
  } else {
    output.value = `${useExport.value ? 'export ' : ''}type ${name} = ${primitiveType(data)}`
  }

  if (!output.value.trim()) error.value = '无法从该 JSON 推断类型'
  else ElMessage.success('类型已生成')
}

async function copy() {
  if (!output.value) return ElMessage.info('请先生成')
  if (await copyText(output.value)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

function download() {
  if (!output.value) return
  downloadText(output.value, `${pascal(rootName.value)}.ts`, 'text/typescript;charset=utf-8')
}

function loadSample() {
  input.value = SAMPLE
  generate()
}

generate()
</script>

<template>
  <ToolPage title="JSON → TypeScript" desc="按 JSON 结构推断 interface / type，数组自动合并字段并标记可选属性" wide>
    <template #actions>
      <el-button size="small" @click="loadSample">填充示例</el-button>
      <el-button size="small" @click="copy">复制</el-button>
      <el-button size="small" @click="download">下载 .ts</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-1.5">
          <span class="text-[12px] text-[#6b7280]">根类型名</span>
          <el-input v-model="rootName" size="small" style="width: 130px" />
        </div>
        <el-button size="small" type="primary" @click="generate">生成类型</el-button>
        <el-checkbox v-model="useExport" size="small">export</el-checkbox>
        <el-checkbox v-model="useInterface" size="small">interface</el-checkbox>
        <el-checkbox v-model="readonlyProps" size="small">readonly</el-checkbox>
        <el-checkbox v-model="optionalWhenMissing" size="small">null / 缺失标为可选</el-checkbox>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid flex-1 gap-3 lg:grid-cols-2">
        <div class="flex min-h-[280px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">JSON 样例</span>
            <el-button size="small" text class="ml-auto" @click="input = ''">清空</el-button>
          </div>
          <textarea v-model="input" class="tool-io flex-1" spellcheck="false" placeholder="粘贴接口返回的 JSON…" />
        </div>

        <div class="flex min-h-[280px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">TypeScript</span>
            <span class="text-[11px] text-[#9ca3af]">{{ output ? output.split('\n').length + ' 行' : '' }}</span>
            <el-button size="small" text class="ml-auto" :disabled="!output" @click="copy">复制</el-button>
          </div>
          <textarea v-model="output" class="tool-io flex-1" spellcheck="false" placeholder="生成结果…" />
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 对象数组会合并所有元素的键，缺失或为 null 的字段自动加 `?`，子对象拆成独立 interface。</p>
        <p class="m-0">· 生成结果只是起点：接口字段建议再补字面量联合（如 status）、`Date` 处理与必填校验。</p>
      </div>
    </section>
  </ToolPage>
</template>
