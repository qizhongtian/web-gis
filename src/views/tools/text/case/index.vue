<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const input = ref('user profile avatar')

/** 拆词：兼容 camel / snake / kebab / 空格 / 数字边界 */
function splitWords(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.\\/]+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\w\u4e00-\u9fa5]/g, ''))
    .filter(Boolean)
}

const words = computed(() => splitWords(input.value))
const lower = computed(() => words.value.map((w) => w.toLowerCase()))
const upper = computed(() => words.value.map((w) => w.toUpperCase()))

const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')

const results = computed(() => {
  const l = lower.value
  const u = upper.value
  const list = [
    { label: 'camelCase', value: l.map((w, i) => (i === 0 ? w : cap(w))).join('') },
    { label: 'PascalCase', value: l.map(cap).join('') },
    { label: 'snake_case', value: l.join('_') },
    { label: 'CONSTANT_CASE', value: u.join('_') },
    { label: 'kebab-case', value: l.join('-') },
    { label: 'dot.case', value: l.join('.') },
    { label: 'path/case', value: l.join('/') },
    { label: 'Title Case', value: l.map(cap).join(' ') },
    { label: 'Sentence case', value: l.length ? cap(l[0]) + (l.length > 1 ? ' ' + l.slice(1).join(' ') : '') : '' },
    { label: 'UPPER SPACE', value: u.join(' ') },
    { label: 'lower space', value: l.join(' ') },
    { label: '首字母缩写', value: u.map((w) => w.charAt(0)).join('') },
  ]
  return list.filter((r) => r.value)
})

/** 检测输入符合哪种命名风格 */
const detect = computed(() => {
  const raw = input.value.trim()
  if (!raw) return ''
  if (/^[A-Z][A-Z0-9_]*$/.test(raw)) return 'CONSTANT_CASE'
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(raw)) return 'snake_case'
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(raw)) return 'kebab-case'
  if (/^[A-Z][A-Za-z0-9]*$/.test(raw)) return 'PascalCase'
  if (/^[a-z][A-Za-z0-9]*$/.test(raw)) return 'camelCase'
  if (/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(raw)) return 'dot.case'
  if (/\s/.test(raw)) return 'space separated'
  return '无法判断'
})

const copied = ref('')

async function copy(value: string, label: string) {
  if (await copyText(value)) {
    copied.value = label
    ElMessage.success('已复制')
    window.setTimeout(() => (copied.value = ''), 1500)
  } else ElMessage.error('复制失败')
}

const samples = ['user profile avatar', 'Web GIS Viewer', 'http_response_code', 'getUserInfo', 'API_KEY_VALUE']

function useAsInput(value: string) {
  input.value = value
}
</script>

<template>
  <ToolPage title="命名风格转换" desc="camel / Pascal / snake / kebab / dot / CONSTANT 一次生成，自动拆词">
    <template #actions>
      <el-button size="small" @click="input = ''">清空</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div>
        <div class="flex items-center gap-2 pb-1.5">
          <span class="text-[12.5px] font-medium text-[#374151]">输入</span>
          <el-tag v-if="detect" size="small" type="info">疑似 {{ detect }}</el-tag>
          <span class="ml-auto text-[11px] text-[#9ca3af]">拆出 {{ words.length }} 个词</span>
        </div>
        <el-input v-model="input" placeholder="如 user profile avatar / getUserInfo / API_KEY" clearable />
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-[#9ca3af]">示例</span>
          <button v-for="s in samples" :key="s" type="button" class="tool-chip" @click="input = s">{{ s }}</button>
          <button type="button" class="tool-chip ml-auto" @click="input = words.join(' ')" :disabled="!words.length">
            重置为空格分隔
          </button>
        </div>
      </div>

      <div class="grid gap-2 md:grid-cols-2">
        <div v-for="row in results" :key="row.label" class="result-row">
          <span class="w-[118px] shrink-0 text-[11.5px] text-[#9ca3af]">{{ row.label }}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-[13px] text-[#1f2328]" :title="row.value">{{ row.value }}</span>
          <button type="button" class="tool-link-btn" @click="copy(row.value, row.label)">
            {{ copied === row.label ? '已复制' : '复制' }}
          </button>
          <button type="button" class="tool-link-btn" @click="useAsInput(row.value)">再转</button>
        </div>
      </div>

      <p v-if="!results.length" class="m-0 py-6 text-center text-[12px] text-[#9ca3af]">输入内容后自动生成各风格</p>

      <div class="tool-note">
        <p class="m-0">· 变量 / 函数用 camelCase，类与组件用 PascalCase，常量用 CONSTANT_CASE，文件名多用 kebab-case。</p>
        <p class="m-0">· 组件文件名与 Vue 组件名保持一致，`&lt;script setup&gt;` 中 defineOptions({ name }) 建议用 PascalCase。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fff;
}
.result-row:hover {
  border-color: #dbe5fb;
  background: #fcfdff;
}
</style>
