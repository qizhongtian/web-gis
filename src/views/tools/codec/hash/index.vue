<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, formatBytes } from '@/utils/tools/file'
import { isCryptoAvailable, md5, sha, type ShaAlgorithm } from '@/utils/tools/hash'

const SAMPLE = 'web-gis · 前端开发常用工具集'

const text = ref(SAMPLE)
const upper = ref(false)
const onlyMd5 = ref(false)
const fileName = ref('')
const fileBuffer = ref<ArrayBuffer | null>(null)
const fileSize = ref(0)
const fileRef = ref<HTMLInputElement>()
const copied = ref('')

const algorithms = computed<{ key: string; label: string; bits: number }[]>(() => [
  { key: 'MD5', label: 'MD5', bits: 128 },
  { key: 'SHA-1', label: 'SHA-1', bits: 160 },
  { key: 'SHA-256', label: 'SHA-256', bits: 256 },
  { key: 'SHA-384', label: 'SHA-384', bits: 384 },
  { key: 'SHA-512', label: 'SHA-512', bits: 512 },
])

const results = ref<{ label: string; value: string; bits: number }[]>([])

/** 输入源：文件优先，其次是文本 */
function currentInput(): string | ArrayBuffer {
  return fileBuffer.value ?? text.value
}

async function compute() {
  const input = currentInput()
  const list: { label: string; value: string; bits: number }[] = []
  for (const algo of algorithms.value) {
    if (onlyMd5.value && algo.key !== 'MD5') continue
    try {
      const value =
        algo.key === 'MD5'
          ? md5(input as string | Uint8Array)
          : await sha(algo.key as ShaAlgorithm, input)
      list.push({ label: algo.label, value: upper.value ? value.toUpperCase() : value, bits: algo.bits })
    } catch {
      list.push({ label: algo.label, value: '计算失败（需 https / localhost）', bits: algo.bits })
    }
  }
  results.value = list
}

watch([text, upper, onlyMd5, fileBuffer], compute, { immediate: true })

const sourceLabel = computed(() =>
  fileName.value ? `文件 ${fileName.value} · ${formatBytes(fileSize.value)}` : `文本 ${text.value.length} 字符`,
)

async function copy(value: string, label: string) {
  if (await copyText(value)) {
    copied.value = label
    ElMessage.success(`${label} 已复制`)
    window.setTimeout(() => (copied.value = ''), 1500)
  } else ElMessage.error('复制失败')
}

async function pickFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  fileSize.value = file.size
  fileBuffer.value = await file.arrayBuffer()
  ElMessage.success(`已载入 ${file.name}`)
  ;(e.target as HTMLInputElement).value = ''
}

function clearFile() {
  fileName.value = ''
  fileSize.value = 0
  fileBuffer.value = null
}

function loadSample() {
  clearFile()
  text.value = SAMPLE
}
</script>

<template>
  <ToolPage title="哈希计算" desc="MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 一次算全，支持文件校验" wide>
    <template #actions>
      <el-button size="small" @click="fileRef?.click()">选择文件</el-button>
      <el-button size="small" @click="loadSample">填充示例</el-button>
      <el-button size="small" @click="fileBuffer = null; fileName = ''; text = ''">清空</el-button>
      <input ref="fileRef" type="file" class="hidden" @change="pickFile" />
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="text-[12.5px] font-medium text-[#374151]">{{ sourceLabel }}</span>
        <el-tag v-if="fileBuffer" size="small" type="success" closable @close="clearFile">文件模式</el-tag>
        <div class="ml-auto flex items-center gap-4">
          <label class="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
            <el-switch v-model="upper" size="small" /> 大写
          </label>
          <label class="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
            <el-switch v-model="onlyMd5" size="small" /> 仅 MD5
          </label>
        </div>
      </div>

      <textarea
        v-if="!fileBuffer"
        v-model="text"
        class="tool-io"
        spellcheck="false"
        placeholder="输入要计算哈希的文本…"
      />

      <el-alert
        v-if="!isCryptoAvailable()"
        title="当前环境没有 crypto.subtle（非安全上下文），SHA 系列不可用，MD5 仍可计算"
        type="warning"
        show-icon
        :closable="false"
        class="!py-1.5"
      />

      <div class="grid gap-2">
        <div v-for="row in results" :key="row.label" class="hash-row">
          <div class="flex items-center gap-2">
            <span class="hash-label">{{ row.label }}</span>
            <span class="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[10.5px] text-[#9ca3af]">{{ row.bits }} bit</span>
            <button type="button" class="tool-link-btn ml-auto" @click="copy(row.value, row.label)">
              {{ copied === row.label ? '已复制' : '复制' }}
            </button>
          </div>
          <p class="hash-value">{{ row.value }}</p>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 哈希是单向摘要，无法反推原文；用于校验完整性、缓存键、去重指纹。</p>
        <p class="m-0">· 密码存储不要直接 MD5 / SHA，应使用 bcrypt / scrypt / Argon2 这类带盐慢哈希。</p>
        <p class="m-0">· 计算大文件时读入 ArrayBuffer 一次完成，百万级字符建议分片（增量哈希需自己拼接状态）。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.hash-row {
  border: 1px solid #eef0f3;
  border-radius: 10px;
  padding: 8px 12px;
  background: #fff;
}
.hash-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}
.hash-value {
  margin: 6px 0 0;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: #2563eb;
  word-break: break-all;
}
</style>
