<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { downloadBlob, formatBytes, formatDelta, loadImage, readFileAsDataUrl } from '@/utils/tools/file'

const fileRef = ref<HTMLInputElement>()
const dragging = ref(false)
const source = ref('')
const fileName = ref('image')
const originalSize = ref(0)
const dimensions = ref({ w: 0, h: 0 })
const compressedUrl = ref('')
const compressedBlob = ref<Blob | null>(null)
const compressedSize = ref(0)
const compressedDims = ref({ w: 0, h: 0 })
const processing = ref(false)
const compare = ref(50)
const error = ref('')

const quality = ref(80)
const maxWidth = ref(0)
const format = ref<'auto' | 'image/jpeg' | 'image/webp' | 'image/png'>('auto')

const webpSupported = ref(true)

const outputFormat = computed(() => {
  if (format.value !== 'auto') return format.value
  return webpSupported.value ? 'image/webp' : 'image/jpeg'
})

const ext = computed(() => {
  const f = outputFormat.value
  if (f === 'image/png') return 'png'
  if (f === 'image/webp') return 'webp'
  return 'jpg'
})

const saved = computed(() => {
  if (!originalSize.value || !compressedSize.value) return 0
  return originalSize.value - compressedSize.value
})

const ratioText = computed(() =>
  originalSize.value && compressedSize.value ? formatDelta(originalSize.value, compressedSize.value) : '',
)

let timer = 0

/** 检测 WebP 支持 */
async function detectWebp() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const data = canvas.toDataURL('image/webp')
  webpSupported.value = data.startsWith('data:image/webp')
}

async function loadFile(file: File | null | undefined) {
  if (!file) return
  if (!file.type.startsWith('image/')) return ElMessage.warning('请选择图片文件')
  error.value = ''
  fileName.value = file.name.replace(/\.\w+$/, '')
  originalSize.value = file.size
  try {
    const url = await readFileAsDataUrl(file)
    const img = await loadImage(url)
    source.value = url
    dimensions.value = { w: img.naturalWidth, h: img.naturalHeight }
    compare.value = 50
    scheduleCompress(0)
  } catch {
    ElMessage.error('图片读取失败')
  }
}

function onInputChange(e: Event) {
  loadFile((e.target as HTMLInputElement).files?.[0])
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  loadFile(e.dataTransfer?.files?.[0])
}

async function compress() {
  if (!source.value) return
  if (!outputFormat.value.startsWith('image/')) return
  processing.value = true
  error.value = ''
  try {
    const img = await loadImage(source.value)
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (maxWidth.value > 0 && w > maxWidth.value) {
      h = Math.round((maxWidth.value / w) * h)
      w = maxWidth.value
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器不支持 Canvas')
    if (outputFormat.value === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), outputFormat.value, quality.value / 100),
    )
    if (!blob) throw new Error('压缩失败，请尝试其它格式')
    if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
    compressedBlob.value = blob
    compressedSize.value = blob.size
    compressedDims.value = { w, h }
    compressedUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    error.value = (e as Error).message
    compressedUrl.value = ''
    compressedBlob.value = null
    compressedSize.value = 0
  } finally {
    processing.value = false
  }
}

function scheduleCompress(delay = 220) {
  window.clearTimeout(timer)
  timer = window.setTimeout(compress, delay)
}

watch([quality, maxWidth, format], () => scheduleCompress())

function reset() {
  source.value = ''
  compressedUrl.value = ''
  compressedBlob.value = null
  compressedSize.value = 0
  originalSize.value = 0
  error.value = ''
}

function download() {
  if (!compressedBlob.value) return
  downloadBlob(compressedBlob.value, `${fileName.value}-compressed.${ext.value}`)
}

onUnmounted(() => {
  window.clearTimeout(timer)
  if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
})

detectWebp()
</script>

<template>
  <ToolPage title="图片压缩" desc="本地 Canvas 压缩，支持质量 / 尺寸 / 格式调节与压缩前后对比预览" wide>
    <template #actions>
      <el-button size="small" @click="fileRef?.click()">选择图片</el-button>
      <el-button size="small" :disabled="!source" @click="reset">重置</el-button>
      <el-button size="small" type="primary" :disabled="!compressedBlob" @click="download">下载压缩图</el-button>
      <input ref="fileRef" type="file" accept="image/*" class="hidden" @change="onInputChange" />
    </template>

    <div v-if="!source" class="app-panel flex flex-1 flex-col p-3">
      <div
        class="flex min-h-[320px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition"
        :class="dragging ? 'border-[#2563eb] bg-[#eef4ff]' : 'border-[#e6e8eb] bg-[#fafbfc] hover:border-[#bfd4fb]'"
        @click="fileRef?.click()"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="text-[30px] text-[#c3c8d1]">🗜</div>
        <p class="mt-2 text-[13px] text-[#4b5563]">点击或拖拽图片到此处开始压缩</p>
        <p class="mt-1 text-[11.5px] text-[#9ca3af]">图片仅在浏览器本地处理，不会上传到服务器</p>
      </div>
    </div>

    <div v-else class="grid flex-1 gap-3 lg:grid-cols-[320px_1fr]">
      <section class="app-panel flex flex-col gap-3 p-3">
        <div class="flex items-center gap-2">
          <span class="text-[12.5px] font-medium text-[#374151]">压缩设置</span>
          <el-tag v-if="webpSupported" size="small" type="success" class="!text-[10px]">WebP 可用</el-tag>
        </div>

        <div>
          <div class="flex items-center justify-between pb-1 text-[11.5px] text-[#6b7280]">
            <span>压缩质量</span>
            <span class="font-mono">{{ quality }}%</span>
          </div>
          <el-slider v-model="quality" :min="10" :max="100" :step="5" size="small" />
          <div class="flex gap-1.5 pt-1">
            <button type="button" class="mini-chip" @click="quality = 90">高质量</button>
            <button type="button" class="mini-chip" @click="quality = 75">推荐</button>
            <button type="button" class="mini-chip" @click="quality = 50">极限压缩</button>
          </div>
        </div>

        <div>
          <div class="pb-1 text-[11.5px] text-[#6b7280]">最大宽度（0 表示保持原尺寸）</div>
          <el-input-number v-model="maxWidth" :min="0" :max="8000" :step="100" size="small" controls-position="right" style="width: 100%" />
        </div>

        <div>
          <div class="pb-1 text-[11.5px] text-[#6b7280]">输出格式</div>
          <el-select v-model="format" size="small" style="width: 100%">
            <el-option label="自动（优先 WebP）" value="auto" />
            <el-option label="WebP" value="image/webp" />
            <el-option label="JPEG" value="image/jpeg" />
            <el-option label="PNG（无损）" value="image/png" />
          </el-select>
        </div>

        <div class="space-y-1.5 rounded-xl border border-[#eef0f3] bg-[#fafbfc] p-2.5 text-[11.5px]">
          <div class="flex justify-between"><span class="text-[#9ca3af]">原图尺寸</span><span class="font-mono">{{ dimensions.w }} × {{ dimensions.h }}</span></div>
          <div class="flex justify-between"><span class="text-[#9ca3af]">原图大小</span><span class="font-mono">{{ formatBytes(originalSize) }}</span></div>
          <div class="flex justify-between"><span class="text-[#9ca3af]">输出尺寸</span><span class="font-mono">{{ compressedDims.w || '-' }} × {{ compressedDims.h || '-' }}</span></div>
          <div class="flex justify-between"><span class="text-[#9ca3af]">压缩后大小</span><span class="font-mono text-[#059669]">{{ compressedSize ? formatBytes(compressedSize) : '-' }}</span></div>
          <div class="flex justify-between"><span class="text-[#9ca3af]">体积变化</span><span class="font-mono" :class="saved > 0 ? 'text-[#059669]' : 'text-[#d97706]'">{{ ratioText || '-' }}</span></div>
        </div>

        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />
        <el-button size="small" type="primary" class="w-full" :disabled="!compressedBlob" @click="download">下载压缩图</el-button>
      </section>

      <section class="app-panel flex flex-col p-3">
        <div class="flex flex-wrap items-center gap-2 pb-2">
          <span class="text-[12.5px] font-medium text-[#374151]">对比预览</span>
          <span class="text-[11px] text-[#9ca3af]">左：原图 · 右：压缩后</span>
          <span v-if="processing" class="ml-auto text-[11px] text-[#2563eb]">处理中…</span>
          <span v-else-if="saved > 0" class="ml-auto text-[11px] text-[#059669]">节省 {{ formatBytes(saved) }}</span>
        </div>

        <div class="relative flex min-h-[380px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#eef0f3] bg-[#fafbfc] p-2">
          <div class="relative inline-block max-w-full select-none overflow-hidden" style="line-height: 0">
            <img :src="source" alt="原图" class="block max-h-[520px] max-w-full object-contain" />
            <img
              v-if="compressedUrl"
              :src="compressedUrl"
              alt="压缩后"
              class="absolute inset-0 h-full w-full object-contain"
              :style="{ clipPath: `inset(0 0 0 ${compare}%)` }"
            />
            <div
              v-if="compressedUrl"
              class="pointer-events-none absolute inset-y-0 w-[2px] bg-[#2563eb]/70"
              :style="{ left: `${compare}%` }"
            >
              <span class="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2563eb] shadow" />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-[11px] text-[#9ca3af]">对比位置</span>
          <el-slider v-model="compare" :min="0" :max="100" size="small" class="flex-1" />
          <span class="w-[36px] text-right font-mono text-[11px] text-[#6b7280]">{{ compare }}%</span>
        </div>

        <p class="pt-1 text-[11px] text-[#9ca3af]">
          格式说明：JPEG 不支持透明背景（自动填充白底），PNG 为无损压缩，WebP 通常可获得更小体积。
        </p>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
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
