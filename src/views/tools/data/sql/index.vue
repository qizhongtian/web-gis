<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText } from '@/utils/tools/file'

const SAMPLE = `select u.id, u.name, count(o.id) as order_count, sum(o.amount) total from users u left join orders o on o.user_id = u.id where u.status = 'active' and o.created_at >= '2026-01-01' group by u.id, u.name having count(o.id) > 3 order by total desc limit 20;`

const input = ref(SAMPLE)
const indentSize = ref(2)
const upperKeywords = ref(true)
const commaNewline = ref(true)
const output = ref('')
const copied = ref(false)

/** 换行前置的顶级子句 */
const CLAUSES = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION ALL',
  'UNION',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'ALTER TABLE',
  'DROP TABLE',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'JOIN',
  'AND',
  'OR',
  'WITH',
]

const MULTI = ['GROUP BY', 'ORDER BY', 'UNION ALL', 'INSERT INTO', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN']

const WORD = /[A-Za-z_\u4e00-\u9fa5]/
const WORD_PART = /[A-Za-z0-9_$.\u4e00-\u9fa5]/

/** 词法切分：字符串、注释、数字、单词、运算符 */
function tokenize(sql: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2
            continue
          }
          break
        }
        j++
      }
      tokens.push(sql.slice(i, j + 1))
      i = j + 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const stop = end === -1 ? sql.length : end
      tokens.push(sql.slice(i, stop).trim())
      i = stop
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? sql.length : end + 2
      tokens.push(sql.slice(i, stop))
      i = stop
      continue
    }
    if (WORD.test(ch)) {
      let j = i
      while (j < sql.length && WORD_PART.test(sql[j])) j++
      tokens.push(sql.slice(i, j))
      i = j
      continue
    }
    if (/\d/.test(ch)) {
      let j = i
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++
      tokens.push(sql.slice(i, j))
      i = j
      continue
    }
    const two = sql.slice(i, i + 2)
    if (['<>', '!=', '>=', '<=', '||', '::'].includes(two)) {
      tokens.push(two)
      i += 2
      continue
    }
    tokens.push(ch)
    i++
  }
  return tokens
}

/** 合并多词关键字，如 GROUP BY */
function mergeKeywords(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    let matched = false
    for (const phrase of MULTI) {
      const parts = phrase.split(' ')
      const slice = tokens.slice(i, i + parts.length)
      if (slice.length === parts.length && slice.every((t, idx) => t.toUpperCase() === parts[idx])) {
        out.push(phrase)
        i += parts.length - 1
        matched = true
        break
      }
    }
    if (!matched) out.push(tokens[i])
  }
  return out
}

const clauseSet = computed(() => new Set(CLAUSES.map((c) => c.toUpperCase())))

/** 括号前需要留空的词 */
const SPACE_BEFORE_PAREN = new Set(['IN', 'VALUES', 'EXISTS', 'AS', 'ON', 'AND', 'OR', 'NOT', 'WHERE', 'BETWEEN'])

function format(): string {
  const tokens = mergeKeywords(tokenize(input.value))
  const pad = ' '.repeat(Math.max(1, indentSize.value))
  const chunks: string[] = []
  let depth = 0
  let lineStart = true
  let prev = ''

  const newLine = () => {
    chunks.push('\n')
    lineStart = true
  }

  /** 写入一个片段：行首先补缩进，行中按需补空格 */
  const write = (text: string, space = true) => {
    if (lineStart) {
      chunks.push(pad.repeat(depth))
      lineStart = false
    } else if (space) {
      chunks.push(' ')
    }
    chunks.push(text)
  }

  tokens.forEach((token) => {
    const upper = token.toUpperCase()
    const isComment = token.startsWith('--') || token.startsWith('/*')

    if (isComment) {
      if (!lineStart) newLine()
      write(token, false)
      newLine()
      prev = ''
      return
    }

    if (clauseSet.value.has(upper)) {
      if (!lineStart) newLine()
      write(upperKeywords.value ? upper : token.toLowerCase(), false)
      prev = token
      return
    }

    if (token === '(') {
      write('(', !lineStart && SPACE_BEFORE_PAREN.has(prev.toUpperCase()))
      depth++
      prev = token
      return
    }
    if (token === ')') {
      depth = Math.max(0, depth - 1)
      write(')', false)
      prev = token
      return
    }
    if (token === ',') {
      write(',', false)
      if (commaNewline.value && depth === 0) newLine()
      prev = token
      return
    }
    if (token === ';') {
      write(';', false)
      newLine()
      prev = ''
      return
    }
    if (token === '.') {
      write('.', false)
      prev = token
      return
    }

    write(token, prev !== '.' && prev !== '(' && prev !== '::')
    prev = token
  })

  return chunks
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n[ \t]*$/g, '')
    .trim()
}

function minify(): string {
  const tokens = tokenize(input.value)
  let out = ''
  tokens.forEach((token, index) => {
    const isString = /^['"`]/.test(token)
    if (token === ',') {
      out += ', '
      return
    }
    if (token === '(') {
      out = out.replace(/\s+$/, '') + '('
      return
    }
    if (token === ')') {
      out = out.replace(/\s+$/, '') + ')'
      return
    }
    const prev = tokens[index - 1] || ''
    const needSpace = index > 0 && !['(', '.', '::'].includes(prev) && token !== '.' && prev !== '::'
    out += (needSpace && !out.endsWith(' ') && !isString ? ' ' : '') + token
  })
  return out.replace(/\s+/g, ' ').trim()
}

function run() {
  output.value = input.value.trim() ? format() : ''
  if (output.value) ElMessage.success('已格式化')
}

function runMinify() {
  output.value = input.value.trim() ? minify() : ''
  if (output.value) ElMessage.success('已压缩')
}

async function copy() {
  if (!output.value) return ElMessage.info('请先格式化')
  if (await copyText(output.value)) {
    copied.value = true
    ElMessage.success('已复制')
    window.setTimeout(() => (copied.value = false), 1200)
  } else ElMessage.error('复制失败')
}

function download() {
  if (!output.value) return
  downloadText(output.value, 'query.sql', 'text/plain;charset=utf-8')
}

// 首次渲染即格式化示例
run()
</script>

<template>
  <ToolPage title="SQL 格式化" desc="SQL 美化与压缩，自动换行子句、缩进括号、统一关键字大小写" wide>
    <template #actions>
      <el-button size="small" type="primary" @click="run">格式化</el-button>
      <el-button size="small" @click="runMinify">压缩</el-button>
      <el-button size="small" :disabled="!output" @click="copy">{{ copied ? '已复制' : '复制' }}</el-button>
      <el-button size="small" :disabled="!output" @click="download">下载</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <el-checkbox v-model="upperKeywords" size="small">关键字大写</el-checkbox>
        <el-checkbox v-model="commaNewline" size="small">逗号换行</el-checkbox>
        <div class="flex items-center gap-2">
          <span class="text-[12px] text-[#6b7280]">缩进</span>
          <el-input-number v-model="indentSize" :min="1" :max="8" size="small" controls-position="right" style="width: 86px" />
        </div>
        <el-button size="small" text class="ml-auto" @click="input = SAMPLE; output = ''">填充示例</el-button>
      </div>

      <div class="grid flex-1 gap-3 lg:grid-cols-2">
        <div class="flex min-h-[280px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">原始 SQL</span>
            <el-button size="small" text class="ml-auto" @click="input = ''">清空</el-button>
          </div>
          <textarea v-model="input" class="tool-io flex-1" spellcheck="false" placeholder="粘贴 SQL…" />
        </div>

        <div class="flex min-h-[280px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">结果</span>
            <span class="text-[11px] text-[#9ca3af]">{{ output ? output.split('\n').length + ' 行' : '' }}</span>
          </div>
          <textarea v-model="output" class="tool-io flex-1" spellcheck="false" placeholder="结果…" />
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 格式化基于词法切分，字符串与注释内容不会被改动；`--` 行注释与 `/* */` 块注释原样保留。</p>
        <p class="m-0">· 复杂嵌套（子查询、CASE WHEN）建议配合编辑器的格式化插件使用。</p>
      </div>
    </section>
  </ToolPage>
</template>
