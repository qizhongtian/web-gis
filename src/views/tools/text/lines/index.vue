<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText } from '@/utils/tools/file'

const SAMPLE = `browser
Array
fetch
vue
Map
Promise
vue
set
Array`

const input = ref(SAMPLE)
const output = ref('')
const prefix = ref('')
const suffix = ref('')
const joinChar = ref(', ')
const filterKw = ref('')
const limit = ref(0)

const source = computed(() => (output.value ? output.value : input.value))
const lines = computed(() => source.value.split(/\r\n|\r|\n/))

const stat = computed(() => {
  const all = lines.value
  const nonEmpty = all.filter((l) => l.trim()).length
  const dup = all.length - new Set(all).size
  return { total: all.length, nonEmpty, dup }
})

function apply(fn: (list: string[]) => string[]) {
  output.value = fn(lines.value).join('\n')
}

const ops: { label: string; run: () => void }[] = [
  { label: '升序 A→Z', run: () => apply((l) => [...l].sort((a, b) => a.localeCompare(b, 'zh-CN'))) },
  { label: '降序 Z→A', run: () => apply((l) => [...l].sort((a, b) => b.localeCompare(a, 'zh-CN'))) },
  {
    label: '自然排序',
    run: () =>
      apply((l) => [...l].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))),
  },
  { label: '按长度', run: () => apply((l) => [...l].sort((a, b) => a.length - b.length)) },
  { label: '去重', run: () => apply((l) => [...new Set(l)]) },
  { label: '反转', run: () => apply((l) => [...l].reverse()) },
  { label: '随机打乱', run: () => apply((l) => shuffle([...l])) },
  { label: '去空行', run: () => apply((l) => l.filter((x) => x.trim())) },
  { label: '去重复空行', run: () => apply((l) => l.filter((x, i) => x.trim() || l[i - 1]?.trim())) },
  { label: '首尾空格', run: () => apply((l) => l.map((x) => x.trim())) },
  { label: '转小写', run: () => apply((l) => l.map((x) => x.toLowerCase())) },
  { label: '转大写', run: () => apply((l) => l.map((x) => x.toUpperCase())) },
  { label: '去 HTML 标签', run: () => apply((l) => l.map((x) => x.replace(/<[^>]+>/g, ''))) },
  { label: '去行内空白', run: () => apply((l) => l.map((x) => x.replace(/[ \t]{2,}/g, ' ').trim())) },
  { label: 'Tab 转空格', run: () => apply((l) => l.map((x) => x.replace(/\t/g, '  '))) },
]

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function addAffix() {
  apply((l) => l.map((x) => `${prefix.value}${x}${suffix.value}`))
}

function addNumber() {
  apply((l) => l.map((x, i) => `${i + 1}. ${x}`))
}

function addQuotes() {
  apply((l) => l.map((x) => `'${x.replace(/'/g, "\\'")}',`))
}

function joinLines() {
  output.value = lines.value.map((x) => x.trim()).filter(Boolean).join(joinChar.value)
}

function limitLines() {
  const n = Number(limit.value)
  if (!n || n < 1) return ElMessage.info('请填写保留行数')
  apply((l) => l.slice(0, n))
}

function filterByKeyword() {
  const kw = filterKw.value.trim()
  if (!kw) return ElMessage.info('请填写过滤关键词')
  apply((l) => l.filter((x) => x.includes(kw)))
}

function removeByKeyword() {
  const kw = filterKw.value.trim()
  if (!kw) return ElMessage.info('请填写排除关键词')
  apply((l) => l.filter((x) => !x.includes(kw)))
}

function filterByRegex() {
  const pattern = filterKw.value.trim()
  if (!pattern) return ElMessage.info('请填写正则')
  try {
    const re = new RegExp(pattern)
    apply((l) => l.filter((x) => re.test(x)))
  } catch (e) {
    ElMessage.error(`正则无效：${(e as Error).message}`)
  }
}

function backToInput() {
  input.value = source.value
  output.value = ''
}

async function copy() {
  if (!source.value) return ElMessage.info('暂无内容')
  if (await copyText(source.value)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

function download() {
  if (!source.value) return
  downloadText(source.value, 'lines.txt')
}

function reset() {
  output.value = ''
  input.value = SAMPLE
}
</script>

<template>
  <ToolPage title="行处理" desc="排序、去重、去空行、加前缀后缀、编号、过滤与拼接，一次处理整段文本" wide>
    <template #actions>
      <el-button size="small" @click="copy">复制</el-button>
      <el-button size="small" @click="download">下载</el-button>
      <el-button size="small" @click="backToInput">结果回填</el-button>
      <el-button size="small" @click="reset">重置</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <button v-for="op in ops" :key="op.label" type="button" class="tool-chip" @click="op.run()">
          {{ op.label }}
        </button>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <div class="flex items-center gap-1.5">
          <span class="text-[11.5px] text-[#9ca3af]">前缀</span>
          <el-input v-model="prefix" size="small" placeholder="如 - " style="width: 100px" />
          <span class="text-[11.5px] text-[#9ca3af]">后缀</span>
          <el-input v-model="suffix" size="small" placeholder="如 ；" style="width: 100px" />
          <el-button size="small" @click="addAffix">应用</el-button>
        </div>
        <el-button size="small" @click="addNumber">加序号</el-button>
        <el-button size="small" @click="addQuotes">转数组项</el-button>
        <div class="flex items-center gap-1.5">
          <span class="text-[11.5px] text-[#9ca3af]">拼接符</span>
          <el-input v-model="joinChar" size="small" style="width: 76px" />
          <el-button size="small" @click="joinLines">拼接为一行</el-button>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <div class="flex items-center gap-1.5">
          <span class="text-[11.5px] text-[#9ca3af]">关键词 / 正则</span>
          <el-input v-model="filterKw" size="small" placeholder="vue 或 ^A" style="width: 180px" />
        </div>
        <el-button size="small" @click="filterByKeyword">仅保留</el-button>
        <el-button size="small" @click="removeByKeyword">排除</el-button>
        <el-button size="small" @click="filterByRegex">正则过滤</el-button>
        <div class="flex items-center gap-1.5">
          <span class="text-[11.5px] text-[#9ca3af]">保留行数</span>
          <el-input-number v-model="limit" :min="0" size="small" controls-position="right" style="width: 90px" />
          <el-button size="small" @click="limitLines">截取</el-button>
        </div>
      </div>

      <div class="grid flex-1 gap-3 lg:grid-cols-2">
        <div class="flex min-h-[200px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">原始文本</span>
            <el-button size="small" text class="ml-auto" @click="input = ''">清空</el-button>
          </div>
          <textarea v-model="input" class="tool-io flex-1" spellcheck="false" placeholder="每行一条数据…" />
        </div>

        <div class="flex min-h-[200px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">处理结果</span>
            <span class="text-[11px] text-[#9ca3af]">{{ stat.total }} 行 · 非空 {{ stat.nonEmpty }} · 重复 {{ stat.dup }}</span>
            <el-button size="small" text class="ml-auto" :disabled="!output" @click="output = ''">清空结果</el-button>
          </div>
          <textarea v-model="output" class="tool-io flex-1" spellcheck="false" placeholder="操作结果会显示在这里，也可直接编辑" />
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 所有操作以「处理结果」为准，未产生结果时自动对原始文本处理，可连续叠加。</p>
        <p class="m-0">· 「转数组项」会给每行加单引号与逗号，便于直接粘贴进代码数组。</p>
      </div>
    </section>
  </ToolPage>
</template>
