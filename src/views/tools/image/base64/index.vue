<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadBlob, downloadText, formatBytes, loadImage, readFileAsDataUrl } from '@/utils/tools/file'

interface ImageInfo {
  name: string
  type: string
  size: number
  width: number
  height: number
}

const tab = ref<'toBase64' | 'toImage'>('toBase64')
const info = ref<ImageInfo | null>(null)
const dataUrl = ref('')
const dragging = ref(false)
const fileRef = ref<HTMLInputElement>()
const outputType = ref<'dataUrl' | 'base64' | 'css' | 'html'>('dataUrl')
const copiedKey = ref('')

const reverseInput = ref('')
const reverseMime = ref('image/png')

const base64 = computed(() => dataUrl.value.replace(/^data:[^;]+;base64,/, ''))

const output = computed(() => {
  if (!dataUrl.value) return ''
  switch (outputType.value) {
    case 'base64':
      return base64.value
    case 'css':
      return `background-image: url("${dataUrl.value}");`
    case 'html':
      return `<img src="${dataUrl.value}" alt="${info.value?.name ?? 'image'}" />`
    default:
      return dataUrl.value
  }
})

const base64Size = computed(() => (base64.value ? base64.value.length : 0))
const ratio = computed(() => {
  if (!info.value || !base64Size.value) return ''
  const pct = ((base64Size.value - info.value.size) / info.value.size) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
})

async function handleFile(file: File | undefined | null) {
  if (!file) return
  if (!file.type.startsWith('image/')) return ElMessage.warning('请选择图片文件')
  if (file.size > 8 * 1024 * 1024) return ElMessage.warning('图片建议小于 8MB，过大的 Base64 会影响性能')
  try {
    const url = await readFileAsDataUrl(file)
    const img = await loadImage(url)
    dataUrl.value = url
    info.value = {
      name: file.name,
      type: file.type,
      size: file.size,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }
  } catch {
    ElMessage.error('图片读取失败')
  }
}

function onInputChange(e: Event) {
  handleFile((e.target as HTMLInputElement).files?.[0])
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFile(e.dataTransfer?.files?.[0])
}

function clearAll() {
  dataUrl.value = ''
  info.value = null
}

async function copy(value: string, key: string) {
  if (!value) return
  if (await copyText(value)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  } else ElMessage.error('复制失败')
}

function downloadTxt() {
  if (!output.value) return
  downloadText(output.value, `${info.value?.name?.replace(/\.\w+$/, '') ?? 'image'}.base64.txt`)
}

function toReverse() {
  if (!dataUrl.value) return
  reverseInput.value = base64.value
  tab.value = 'toImage'
  buildReverse()
}

/* ---------- Base64 → 图片 ---------- */
const reversePreview = computed(() => {
  const raw = reverseInput.value.trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:${reverseMime.value};base64,${raw.replace(/\s/g, '')}`
})

const reverseValid = computed(() => {
  const raw = reverseInput.value.trim()
  if (!raw) return false
  const b64 = raw.startsWith('data:') ? raw.split(',')[1] ?? '' : raw
  return /^[A-Za-z0-9+/=\s]+$/.test(b64) && b64.replace(/\s/g, '').length > 0
})

const reverseError = ref('')

function buildReverse() {
  reverseError.value = ''
  if (!reverseInput.value.trim()) return
  if (!reverseValid.value) {
    reverseError.value = 'Base64 内容格式不正确'
    return
  }
  const img = new Image()
  img.onerror = () => (reverseError.value = '无法解析为图片，请检查内容或 MIME 类型')
  img.onload = () => (reverseError.value = '')
  img.src = reversePreview.value
}

async function downloadReverse() {
  if (!reversePreview.value) return
  try {
    const res = await fetch(reversePreview.value)
    const blob = await res.blob()
    const ext = (blob.type.split('/')[1] || 'png').replace('svg+xml', 'svg')
    downloadBlob(blob, `decoded-${Date.now()}.${ext}`)
  } catch {
    ElMessage.error('图片解码失败')
  }
}

function clearReverse() {
  reverseInput.value = ''
  reverseError.value = ''
}
</script>

<template>
  <ToolPage title="图片 Base64" desc="图片与 Base64 / DataURL 双向转换，支持拖拽上传、CSS / HTML 代码生成" wide>
    <template #actions>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="toBase64">图片 → Base64</el-radio-button>
        <el-radio-button value="toImage">Base64 → 图片</el-radio-button>
      </el-radio-group>
    </template>

    <!-- 图片转 Base64 -->
    <div v-if="tab === 'toBase64'" class="grid flex-1 gap-3 lg:grid-cols-2">
      <section class="app-panel flex flex-col gap-3 p-3">
        <div
          class="flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition"
          :class="dragging ? 'border-[#2563eb] bg-[#eef4ff]' : 'border-[#e6e8eb] bg-[#fafbfc] hover:border-[#bfd4fb]'"
          @click="fileRef?.click()"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <template v-if="!dataUrl">
            <div class="text-[26px] text-[#c3c8d1]">⬆</div>
            <p class="mt-2 text-[13px] text-[#4b5563]">点击或拖拽图片到此处</p>
            <p class="mt-1 text-[11.5px] text-[#9ca3af]">支持 PNG / JPG / GIF / WebP / SVG，建议小于 8MB</p>
          </template>
          <img v-else :src="dataUrl" alt="预览" class="max-h-[280px] max-w-full rounded-lg object-contain" />
          <input ref="fileRef" type="file" accept="image/*" class="hidden" @change="onInputChange" />
        </div>

        <div v-if="info" class="space-y-1.5 rounded-xl border border-[#eef0f3] p-2.5 text-[11.5px]">
          <div class="flex justify-between gap-3"><span class="text-[#9ca3af]">文件名</span><span class="truncate text-[#374151]" :title="info.name">{{ info.name }}</span></div>
          <div class="flex justify-between gap-3"><span class="text-[#9ca3af]">类型</span><span class="font-mono text-[#374151]">{{ info.type }}</span></div>
          <div class="flex justify-between gap-3"><span class="text-[#9ca3af]">尺寸</span><span class="font-mono text-[#374151]">{{ info.width }} × {{ info.height }}</span></div>
          <div class="flex justify-between gap-3"><span class="text-[#9ca3af]">原始大小</span><span class="font-mono text-[#374151]">{{ formatBytes(info.size) }}</span></div>
          <div class="flex justify-between gap-3"><span class="text-[#9ca3af]">Base64 长度</span><span class="font-mono text-[#374151]">{{ base64Size }} 字符</span></div>
          <div v-if="ratio" class="flex justify-between gap-3"><span class="text-[#9ca3af]">体积变化</span><span class="font-mono text-[#d97706]">{{ ratio }}</span></div>
          <div class="flex gap-2 pt-1">
            <el-button size="small" class="flex-1" @click="clearAll">清除</el-button>
            <el-button size="small" class="flex-1" type="primary" plain @click="toReverse">转为解码</el-button>
          </div>
        </div>
      </section>

      <section class="app-panel flex flex-col gap-2 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <el-radio-group v-model="outputType" size="small">
            <el-radio-button value="dataUrl">DataURL</el-radio-button>
            <el-radio-button value="base64">纯 Base64</el-radio-button>
            <el-radio-button value="css">CSS</el-radio-button>
            <el-radio-button value="html">HTML</el-radio-button>
          </el-radio-group>
          <div class="ml-auto flex items-center gap-1">
            <el-button size="small" text :disabled="!output" @click="copy(output, 'out')">
              {{ copiedKey === 'out' ? '已复制' : '复制' }}
            </el-button>
            <el-button size="small" text :disabled="!output" @click="downloadTxt">下载 .txt</el-button>
          </div>
        </div>

        <textarea
          :value="output"
          readonly
          class="io-box"
          spellcheck="false"
          placeholder="上传图片后自动生成 Base64 / DataURL…"
        />
        <p class="text-[11px] leading-relaxed text-[#9ca3af]">
          小提示：Base64 会让体积膨胀约 33%，适合小图标内联；大图建议使用图片压缩或独立文件。
        </p>
      </section>
    </div>

    <!-- Base64 转图片 -->
    <div v-else class="grid flex-1 gap-3 lg:grid-cols-2">
      <section class="app-panel flex flex-col gap-2 p-3">
        <div class="flex items-center gap-2">
          <span class="text-[12.5px] font-medium text-[#374151]">Base64 / DataURL</span>
          <el-select v-model="reverseMime" size="small" style="width: 130px" class="ml-auto">
            <el-option label="PNG" value="image/png" />
            <el-option label="JPEG" value="image/jpeg" />
            <el-option label="GIF" value="image/gif" />
            <el-option label="WebP" value="image/webp" />
            <el-option label="SVG" value="image/svg+xml" />
          </el-select>
        </div>
        <textarea
          v-model="reverseInput"
          class="io-box"
          spellcheck="false"
          placeholder="粘贴 Base64 或 data:image/...;base64,... 内容"
          @input="buildReverse"
        />
        <el-alert v-if="reverseError" :title="reverseError" type="error" show-icon :closable="false" class="!py-1.5" />
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-[#9ca3af]">{{ reverseInput.length }} 字符</span>
          <el-button size="small" text class="ml-auto" @click="clearReverse">清空</el-button>
          <el-button size="small" :disabled="!reversePreview || !!reverseError" @click="downloadReverse">下载图片</el-button>
        </div>
      </section>

      <section class="app-panel flex min-h-[260px] flex-1 flex-col p-3">
        <div class="pb-2 text-[12.5px] font-medium text-[#374151]">预览</div>
        <div class="flex flex-1 items-center justify-center rounded-xl border border-[#eef0f3] bg-[#fafbfc] p-3">
          <img
            v-if="reversePreview && !reverseError"
            :src="reversePreview"
            alt="解码预览"
            class="max-h-[360px] max-w-full rounded-lg object-contain"
          />
          <span v-else class="text-[12.5px] text-[#9ca3af]">暂无有效图片</span>
        </div>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.io-box {
  display: block;
  width: 100%;
  height: auto;
  flex: 1 1 0;
  min-height: 200px;
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  outline: none;
  resize: vertical;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11.5px;
  line-height: 1.65;
  word-break: break-all;
}
.io-box:focus {
  border-color: #bfd4fb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
  background: #fff;
}
</style>
