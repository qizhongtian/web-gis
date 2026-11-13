<script lang="ts">
/** 代码块数据结构（供页面传入） */
export interface CodeBlock {
  title: string
  /** 折叠时也可见的一句话说明 */
  desc?: string
  code: string
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 关键代码面板：多个代码块，每块可单独展开 / 收起
 * - 无第三方高亮依赖，内置轻量 token 着色（注释 / 字符串 / 数字 / 关键字 / 类名）
 * - 折叠状态按块独立维护，支持一键全部展开 / 收起
 * - 代码块默认全部收起，避免右侧面板一进来就被大段代码占满
 */
const props = withDefaults(
  defineProps<{
    blocks: CodeBlock[]
    title?: string
    /** 默认展开的块下标 */
    defaultOpen?: number[]
  }>(),
  { title: '关键代码', defaultOpen: () => [] },
)

const openIndex = ref<number[]>([...props.defaultOpen])
const copied = ref(-1)
let copyTimer = 0

const allOpen = computed(() => openIndex.value.length === props.blocks.length)

function isOpen(i: number) {
  return openIndex.value.includes(i)
}

function toggle(i: number) {
  openIndex.value = isOpen(i) ? openIndex.value.filter((n) => n !== i) : [...openIndex.value, i]
}

function toggleAll() {
  openIndex.value = allOpen.value ? [] : props.blocks.map((_, i) => i)
}

async function copy(code: string, i: number) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = i
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => (copied.value = -1), 1500)
  } catch {
    copied.value = -1
  }
}

const KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'async',
  'await',
  'function',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'new',
  'class',
  'extends',
  'import',
  'from',
  'export',
  'try',
  'catch',
  'finally',
  'throw',
  'typeof',
  'true',
  'false',
  'null',
  'undefined',
  'this',
])

const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 轻量语法着色（先转义 HTML，再按 token 包裹 span） */
function highlight(code: string) {
  return esc(code).replace(TOKEN, (m, comment, str, num, word) => {
    if (comment) return `<span class="tk-com">${comment}</span>`
    if (str) return `<span class="tk-str">${str}</span>`
    if (num) return `<span class="tk-num">${num}</span>`
    if (KEYWORDS.has(word)) return `<span class="tk-kw">${word}</span>`
    // 首字母大写的标识符按类名 / 命名空间着色（如 Cesium、Entity）
    if (/^[A-Z]/.test(word)) return `<span class="tk-cls">${word}</span>`
    return m
  })
}
</script>

<template>
  <section class="code-panel">
    <header class="panel-top">
      <i class="dot" />
      <span class="panel-title">{{ props.title }}</span>
      <button type="button" class="all-btn" @click="toggleAll">{{ allOpen ? '全部收起' : '全部展开' }}</button>
    </header>

    <div class="blocks">
      <article v-for="(b, i) in props.blocks" :key="i" class="block" :class="{ open: isOpen(i) }">
        <header class="block-head" @click="toggle(i)">
          <span class="idx">{{ i + 1 }}</span>
          <span class="block-title">{{ b.title }}</span>
          <svg class="chev" :class="{ open: isOpen(i) }" viewBox="0 0 12 12" width="12" height="12">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </header>

        <p v-if="b.desc" class="desc">{{ b.desc }}</p>

        <div v-show="isOpen(i)" class="code-wrap">
          <button type="button" class="copy-btn" @click.stop="copy(b.code, i)">
            {{ copied === i ? '已复制' : '复制' }}
          </button>
          <pre class="code"><code v-html="highlight(b.code)" /></pre>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.code-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
.panel-top {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.panel-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1f2328;
}
.all-btn {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.all-btn:hover {
  color: #2563eb;
  background: #eff6ff;
}

.blocks {
  flex: 1;
  min-height: 0;
  padding: 10px;
  overflow: auto;
}
.block {
  margin-bottom: 8px;
  border-radius: 9px;
  border: 1px solid #e9eef5;
  background: #fff;
  overflow: hidden;
}
.block:last-child {
  margin-bottom: 0;
}
.block.open {
  border-color: #dbe6f5;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.07);
}
.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}
.idx {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 600;
}
.block-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.chev {
  flex: none;
  color: #94a3b8;
  transition: transform 0.18s ease;
}
.chev.open {
  transform: rotate(180deg);
}
.desc {
  margin: 0;
  padding: 0 10px 8px 35px;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.55;
}
.code-wrap {
  position: relative;
  border-top: 1px solid #eef2f7;
}
.copy-btn {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.55);
  color: #cbd5e1;
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.copy-btn:hover {
  color: #fff;
  background: rgba(37, 99, 235, 0.85);
}
.code {
  margin: 0;
  padding: 10px 12px;
  max-height: 340px;
  overflow: auto;
  background: #0b1623;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11.5px;
  line-height: 1.65;
  tab-size: 2;
}
.code :deep(.tk-kw) {
  color: #7dd3fc;
}
.code :deep(.tk-str) {
  color: #fbbf24;
}
.code :deep(.tk-num) {
  color: #a5b4fc;
}
.code :deep(.tk-com) {
  color: #64748b;
  font-style: italic;
}
.code :deep(.tk-cls) {
  color: #5eead4;
}
</style>
