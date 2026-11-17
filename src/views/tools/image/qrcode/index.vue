<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { createQrMatrix, type EccLevel } from '@/utils/tools/qrcode'
import { downloadBlob, loadImage, readFileAsDataUrl } from '@/utils/tools/file'

const text = ref('https://www.example.com')
const ecc = ref<EccLevel>('M')
const size = ref(320)
const margin = ref(2)
const fg = ref('#111827')
const bgColor = ref('#ffffff')
const transparent = ref(false)
const logoUrl = ref('')
const logoScale = ref(22)
const canvasRef = ref<HTMLCanvasElement>()
const fileRef = ref<HTMLInputElement>()
const error = ref('')
const info = ref({ version: 0, modules: 0, bytes: 0 })
const copied = ref(false)

let timer = 0
let logo: HTMLImageElement | null = null

const contentBytes = computed(() => new TextEncoder().encode(text.value).length)

async function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  error.value = ''
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (!text.value.trim()) {
    canvas.width = size.value
    canvas.height = size.value
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    info.value = { version: 0, modules: 0, bytes: 0 }
    return
  }

  try {
    const matrix = createQrMatrix(text.value, ecc.value)
    const total = matrix.size + margin.value * 2
    const px = size.value
    canvas.width = px
    canvas.height = px

    ctx.clearRect(0, 0, px, px)
    if (!transparent.value) {
      ctx.fillStyle = bgColor.value
      ctx.fillRect(0, 0, px, px)
    }

    const module = px / total
    ctx.fillStyle = fg.value
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (!matrix.modules[y][x]) continue
        ctx.fillRect(
          Math.floor((x + margin.value) * module),
          Math.floor((y + margin.value) * module),
          Math.ceil(module),
          Math.ceil(module),
        )
      }
    }

    // 中心 Logo
    if (logo) {
      const logoSize = (px * logoScale.value) / 100
      const pad = logoSize * 0.12
      const x = (px - logoSize) / 2
      const y = (px - logoSize) / 2
      ctx.fillStyle = transparent.value ? '#ffffff' : bgColor.value
      const radius = logoSize * 0.18
      ctx.beginPath()
      ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, radius)
      ctx.fill()
      ctx.drawImage(logo, x, y, logoSize, logoSize)
    }

    info.value = {
      version: matrix.version,
      modules: matrix.size,
      bytes: contentBytes.value,
    }
  } catch (e) {
    error.value = (e as Error).message
    info.value = { version: 0, modules: 0, bytes: contentBytes.value }
  }
}

function scheduleDraw(delay = 120) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => nextTick(draw), delay)
}

watch([text, ecc, size, margin, fg, bgColor, transparent, logoScale], () => scheduleDraw())

async function uploadLogo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return ElMessage.warning('请选择图片文件')
  try {
    const url = await readFileAsDataUrl(file)
    logo = await loadImage(url)
    logoUrl.value = url
    scheduleDraw(0)
  } catch {
    ElMessage.error('Logo 读取失败')
  }
  ;(e.target as HTMLInputElement).value = ''
}

function removeLogo() {
  logo = null
  logoUrl.value = ''
  scheduleDraw(0)
}

function download() {
  const canvas = canvasRef.value
  if (!canvas || !text.value.trim() || error.value) return ElMessage.info('请先生成有效二维码')
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `qrcode-${Date.now()}.png`)
  }, 'image/png')
  ElMessage.success('二维码已开始下载')
}

async function copyImage() {
  const canvas = canvasRef.value
  if (!canvas || !text.value.trim() || error.value) return ElMessage.info('请先生成有效二维码')
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
      return ElMessage.warning('当前浏览器不支持复制图片，请使用下载 PNG')
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copied.value = true
    ElMessage.success('二维码图片已复制')
    window.setTimeout(() => (copied.value = false), 1500)
  } catch {
    ElMessage.warning('复制失败，请使用下载 PNG')
  }
}

const samples = [
  { label: '网址', value: 'https://www.example.com' },
  { label: '文本', value: 'Web GIS 在线工具 · 二维码生成' },
  { label: 'WiFi', value: 'WIFI:T:WPA;S:MyWiFi;P:12345678;;' },
  { label: '名片', value: 'BEGIN:VCARD\nVERSION:3.0\nN:张;三\nTEL:13800000000\nEMAIL:zhangsan@example.com\nEND:VCARD' },
]

onMounted(() => scheduleDraw(0))
</script>

<template>
  <ToolPage title="二维码生成" desc="纯前端生成二维码，可调纠错等级、尺寸、留白、颜色并支持中心 Logo" wide>
    <template #actions>
      <el-button size="small" @click="copyImage">{{ copied ? '已复制' : '复制图片' }}</el-button>
      <el-button size="small" type="primary" :disabled="!info.modules" @click="download">下载 PNG</el-button>
    </template>

    <div class="grid flex-1 gap-3 lg:grid-cols-[1fr_360px]">
      <section class="app-panel flex flex-col gap-3 p-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11.5px] text-[#6b7280]">示例</span>
          <button v-for="s in samples" :key="s.label" type="button" class="mini-chip" @click="text = s.value">
            {{ s.label }}
          </button>
        </div>

        <textarea
          v-model="text"
          class="io-box"
          spellcheck="false"
          placeholder="输入网址、文本、WiFi、名片等内容…"
        />

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div class="pb-1 text-[11.5px] text-[#6b7280]">纠错等级</div>
            <el-select v-model="ecc" size="small">
              <el-option label="L · 约 7%" value="L" />
              <el-option label="M · 约 15%" value="M" />
              <el-option label="Q · 约 25%" value="Q" />
              <el-option label="H · 约 30%" value="H" />
            </el-select>
          </div>
          <div>
            <div class="pb-1 text-[11.5px] text-[#6b7280]">尺寸 {{ size }}px</div>
            <el-slider v-model="size" :min="128" :max="1024" :step="32" size="small" />
          </div>
          <div>
            <div class="pb-1 text-[11.5px] text-[#6b7280]">留白 {{ margin }} 模块</div>
            <el-slider v-model="margin" :min="0" :max="8" size="small" />
          </div>
          <div>
            <div class="pb-1 text-[11.5px] text-[#6b7280]">Logo 占比 {{ logoScale }}%</div>
            <el-slider v-model="logoScale" :min="10" :max="32" size="small" :disabled="!logoUrl" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div class="flex items-center gap-2">
            <span class="text-[11.5px] text-[#6b7280]">前景色</span>
            <el-color-picker v-model="fg" size="small" />
            <code class="text-[11px] text-[#9ca3af]">{{ fg }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11.5px] text-[#6b7280]">背景色</span>
            <el-color-picker v-model="bgColor" size="small" :disabled="transparent" />
            <code class="text-[11px] text-[#9ca3af]">{{ transparent ? '透明' : bgColor }}</code>
          </div>
          <el-checkbox v-model="transparent" size="small">透明背景</el-checkbox>

          <div class="ml-auto flex items-center gap-2">
            <el-button size="small" @click="fileRef?.click()">上传 Logo</el-button>
            <el-button v-if="logoUrl" size="small" text @click="removeLogo">移除 Logo</el-button>
            <input ref="fileRef" type="file" accept="image/*" class="hidden" @change="uploadLogo" />
          </div>
        </div>

        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />
        <p class="text-[11px] text-[#9ca3af]">
          内容 {{ contentBytes }} 字节<span v-if="info.modules"> · 版本 {{ info.version }} · {{ info.modules }} × {{ info.modules }} 模块</span>
          <span v-if="logoUrl"> · 添加 Logo 后建议使用 Q 或 H 纠错等级以保证可扫描</span>
        </p>
      </section>

      <section class="app-panel flex flex-col p-3">
        <div class="pb-2 text-[12.5px] font-medium text-[#374151]">预览</div>
        <div class="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-[#eef0f3] p-3">
          <div
            class="flex max-w-full items-center justify-center"
            :style="{
              backgroundImage: transparent
                ? 'linear-gradient(45deg, #f1f3f5 25%, transparent 25%), linear-gradient(-45deg, #f1f3f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f3f5 75%), linear-gradient(-45deg, transparent 75%, #f1f3f5 75%)'
                : 'none',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
            }"
          >
            <canvas ref="canvasRef" class="max-w-full rounded-md" style="width: 100%; height: auto" />
          </div>
          <p class="mt-2 text-center text-[11px] text-[#9ca3af]">
            {{ info.modules ? '可长按 / 右键保存图片' : '输入内容后自动生成' }}
          </p>
        </div>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.io-box {
  display: block;
  width: 100%;
  flex: 1 1 0;
  min-height: 110px;
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
}
.io-box:focus {
  border-color: #bfd4fb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
  background: #fff;
}
.mini-chip {
  padding: 2px 8px;
  border: 1px solid #e6e8eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mini-chip:hover {
  border-color: #c7d7fb;
  background: #eef4ff;
  color: #2563eb;
}
</style>
