<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

type Mode = 'url' | 'base64' | 'html' | 'unicode' | 'hex'

const SAMPLE: Record<Mode, string> = {
  url: 'https://example.com/search?q=Web GIS 在线工具&lang=zh-CN',
  base64: 'Web GIS 在线工具 · Base64 编解码',
  html: '<div class="tip">A & B < 100，请勿 "转义"</div>',
  unicode: '中文 Unicode 转义示例',
  hex: 'Hello 十六进制',
}

const mode = ref<Mode>('url')
const direction = ref<'encode' | 'decode'>('encode')
const input = ref(SAMPLE.url)
const output = ref('')
const error = ref('')
const nonAsciiOnly = ref(true)
const copied = ref(false)

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'url', label: 'URL 编码', hint: '基于 encodeURIComponent / decodeURIComponent，适合查询参数' },
  { value: 'base64', label: 'Base64', hint: 'UTF-8 安全的 Base64 编解码，兼容 URL-safe 字符' },
  { value: 'html', label: 'HTML 实体', hint: '转义 & < > " \' 与常用实体' },
  { value: 'unicode', label: 'Unicode', hint: '转为 \\uXXXX 转义序列，便于写入代码字符串' },
  { value: 'hex', label: 'Hex 十六进制', hint: '按 UTF-8 字节转十六进制，常用于协议调试' },
]

const currentHint = computed(() => MODES.find((m) => m.value === mode.value)?.hint ?? '')

function encodeBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

function decodeBase64(text: string) {
  let s = text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  ' ': '&nbsp;',
}
const HTML_REVERSE: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  times: '×',
  divide: '÷',
  yen: '¥',
  euro: '€',
  pound: '£',
  deg: '°',
  plusmn: '±',
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] ?? c)
}

function unescapeHtml(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return HTML_REVERSE[body.toLowerCase()] ?? whole
  })
}

function escapeUnicode(text: string, asciiOnly: boolean) {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0
      if (asciiOnly && code < 128) return ch
      if (code > 0xffff) {
        const high = Math.floor((code - 0x10000) / 0x400) + 0xd800
        const low = ((code - 0x10000) % 0x400) + 0xdc00
        return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
      }
      return `\\u${code.toString(16).padStart(4, '0')}`
    })
    .join('')
}

function unescapeUnicode(text: string) {
  return text
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function encodeHex(text: string) {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

function decodeHex(text: string) {
  const clean = text.replace(/0x/gi, '').replace(/[\s,;:-]/g, '')
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2 !== 0) {
    throw new Error('十六进制字符串格式不正确（需偶数个 0-9a-f 字符）')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function convert(text: string, dir: 'encode' | 'decode'): string {
  if (!text) return ''
  switch (mode.value) {
    case 'url':
      return dir === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text)
    case 'base64':
      return dir === 'encode' ? encodeBase64(text) : decodeBase64(text)
    case 'html':
      return dir === 'encode' ? escapeHtml(text) : unescapeHtml(text)
    case 'unicode':
      return dir === 'encode' ? escapeUnicode(text, nonAsciiOnly.value) : unescapeUnicode(text)
    case 'hex':
      return dir === 'encode' ? encodeHex(text) : decodeHex(text)
    default:
      return text
  }
}

function run(dir: 'encode' | 'decode') {
  error.value = ''
  direction.value = dir
  try {
    output.value = convert(input.value, dir)
  } catch (e) {
    output.value = ''
    error.value = `${dir === 'encode' ? '编码' : '解码'}失败：${(e as Error).message}`
  }
}

function switchMode(m: Mode) {
  mode.value = m
  input.value = SAMPLE[m]
  output.value = ''
  error.value = ''
  run('encode')
}

function onModeChange(value: string | number | boolean | undefined) {
  switchMode(value as Mode)
}

function swap() {
  const prev = output.value
  if (!prev) return
  input.value = prev
  direction.value = direction.value === 'encode' ? 'decode' : 'encode'
  run(direction.value)
}

async function copyOutput() {
  if (!output.value) return ElMessage.info('暂无可复制内容')
  if (await copyText(output.value)) {
    copied.value = true
    ElMessage.success('已复制')
    window.setTimeout(() => (copied.value = false), 1500)
  } else ElMessage.error('复制失败')
}

const inputBytes = computed(() => new TextEncoder().encode(input.value).length)
const outputBytes = computed(() => new TextEncoder().encode(output.value).length)
</script>

<template>
  <ToolPage title="编码解码" desc="URL / Base64 / HTML 实体 / Unicode / Hex 互转，UTF-8 安全处理" wide>
    <template #actions>
      <el-button size="small" @click="swap">结果转输入</el-button>
      <el-button size="small" type="primary" @click="copyOutput">{{ copied ? '已复制' : '复制结果' }}</el-button>
    </template>

    <section class="app-panel p-3 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-radio-group :model-value="mode" size="small" @change="onModeChange">
          <el-radio-button v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</el-radio-button>
        </el-radio-group>
        <el-checkbox v-if="mode === 'unicode'" v-model="nonAsciiOnly" size="small">仅转义非 ASCII</el-checkbox>
        <div class="ml-auto flex items-center gap-2">
          <el-button size="small" :type="direction === 'encode' ? 'primary' : 'default'" @click="run('encode')">编码 →</el-button>
          <el-button size="small" :type="direction === 'decode' ? 'primary' : 'default'" @click="run('decode')">← 解码</el-button>
        </div>
      </div>

      <p class="text-[11.5px] text-[#9ca3af]">{{ currentHint }}</p>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid gap-3 lg:grid-cols-2">
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">原文</span>
            <span class="text-[11px] text-[#9ca3af]">{{ input.length }} 字符 · {{ inputBytes }} 字节</span>
            <el-button size="small" text class="ml-auto" @click="input = ''">清空</el-button>
          </div>
          <textarea v-model="input" class="io-box" spellcheck="false" placeholder="输入待转换内容…" />
        </div>
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">结果</span>
            <span class="text-[11px] text-[#9ca3af]">{{ output.length }} 字符 · {{ outputBytes }} 字节</span>
          </div>
          <textarea v-model="output" class="io-box" spellcheck="false" placeholder="转换结果…" />
        </div>
      </div>

      <div v-if="mode === 'base64' && output" class="rounded-lg bg-[#fafbfc] p-2.5 text-[11.5px] text-[#6b7280]">
        可作为图片 DataURL 使用：
        <code class="ml-1 rounded bg-[#eef4ff] px-1.5 py-0.5 text-[#1d4ed8]">data:image/png;base64,{{ output.slice(0, 32) }}…</code>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.io-box {
  display: block;
  width: 100%;
  height: calc(100vh - 360px);
  min-height: 260px;
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
  word-break: break-all;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.io-box:focus {
  border-color: #bfd4fb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
  background: #fff;
}
</style>
