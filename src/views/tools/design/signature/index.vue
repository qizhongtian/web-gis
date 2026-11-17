<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { downloadDataUrl } from '@/utils/tools/file'

interface Point {
  x: number
  y: number
}

interface Stroke {
  color: string
  width: number
  points: Point[]
}

const COLORS = ['#111827', '#2563eb', '#dc2626', '#059669', '#7c3aed', '#db2777']
const canvasRef = ref<HTMLCanvasElement>()
const wrapRef = ref<HTMLElement>()
const strokes = ref<Stroke[]>([])
const redoStack = ref<Stroke[]>([])
const color = ref('#111827')
const penWidth = ref(3)
const bg = ref<'transparent' | 'white'>('transparent')
const showGuide = ref(true)
const drawing = ref(false)
const hasContent = ref(false)
const canvasSize = ref({ w: 800, h: 320 })

let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let current: Stroke | null = null
let observer: ResizeObserver | null = null

function setupCanvas() {
  const canvas = canvasRef.value
  const wrap = wrapRef.value
  if (!canvas || !wrap) return
  const rect = wrap.getBoundingClientRect()
  const cssW = Math.max(320, Math.round(rect.width))
  const cssH = 320
  dpr = Math.min(window.devicePixelRatio || 1, 3)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  canvasSize.value = { w: cssW, h: cssH }
  render()
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points
  if (!pts.length) return
  context.strokeStyle = stroke.color
  context.lineWidth = stroke.width
  context.beginPath()
  if (pts.length === 1) {
    context.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
    context.fillStyle = stroke.color
    context.fill()
    return
  }
  context.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2
    const midY = (pts[i].y + pts[i + 1].y) / 2
    context.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY)
  }
  const last = pts[pts.length - 1]
  context.lineTo(last.x, last.y)
  context.stroke()
}

function render() {
  if (!ctx) return
  ctx.clearRect(0, 0, canvasSize.value.w, canvasSize.value.h)
  if (bg.value === 'white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasSize.value.w, canvasSize.value.h)
  }
  strokes.value.forEach((s) => drawStroke(ctx!, s))
  if (current) drawStroke(ctx, current)
  hasContent.value = strokes.value.length > 0
}

function pointFromEvent(e: PointerEvent): Point {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.setPointerCapture(e.pointerId)
  drawing.value = true
  current = { color: color.value, width: penWidth.value, points: [pointFromEvent(e)] }
  render()
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value || !current) return
  const p = pointFromEvent(e)
  const last = current.points[current.points.length - 1]
  // 过滤过密的点，减少重绘压力
  if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return
  current.points.push(p)
  render()
}

function finishStroke() {
  if (!drawing.value) return
  drawing.value = false
  if (current && current.points.length) {
    strokes.value.push(current)
    redoStack.value = []
  }
  current = null
  render()
}

function undo() {
  if (!strokes.value.length) return
  const last = strokes.value.pop()
  if (last) redoStack.value.push(last)
  render()
}

function redo() {
  const last = redoStack.value.pop()
  if (!last) return
  strokes.value.push(last)
  render()
}

function clearAll() {
  if (!strokes.value.length) return
  ElMessageBox.confirm('确定清空签名内容？', '提示', { type: 'warning' })
    .then(() => {
      strokes.value = []
      redoStack.value = []
      render()
    })
    .catch(() => undefined)
}

function exportPng() {
  const canvas = canvasRef.value
  if (!canvas || !hasContent.value) return ElMessage.info('请先书写签名')
  downloadDataUrl(canvas.toDataURL('image/png'), `signature-${Date.now()}.png`)
  ElMessage.success('图片已开始下载')
}

/** 复制为图片（需要浏览器支持 ClipboardItem） */
async function copyImage() {
  const canvas = canvasRef.value
  if (!canvas || !hasContent.value) return ElMessage.info('请先书写签名')
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
      return ElMessage.warning('当前浏览器不支持复制图片，请使用下载 PNG')
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    ElMessage.success('图片已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请使用下载 PNG')
  }
}

const sizeLabel = computed(() => `${canvasSize.value.w} × 320`)

watch([color, penWidth, bg], () => render())

onMounted(() => {
  nextTick(() => {
    setupCanvas()
    observer = new ResizeObserver(() => setupCanvas())
    if (wrapRef.value) observer.observe(wrapRef.value)
  })
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <ToolPage title="电子签名" desc="鼠标 / 触屏手写签名，支持颜色笔迹、撤销重做与透明 PNG 导出" wide>
    <template #actions>
      <el-button size="small" :disabled="!strokes.length" @click="undo">撤销</el-button>
      <el-button size="small" :disabled="!redoStack.length" @click="redo">重做</el-button>
      <el-button size="small" :disabled="!hasContent" @click="clearAll">清空</el-button>
      <el-button size="small" @click="copyImage">复制图片</el-button>
      <el-button size="small" type="primary" :disabled="!hasContent" @click="exportPng">下载 PNG</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col p-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div class="flex items-center gap-1.5">
          <span class="text-[11.5px] text-[#6b7280]">笔迹颜色</span>
          <button
            v-for="c in COLORS"
            :key="c"
            type="button"
            class="h-6 w-6 rounded-full border-2 transition"
            :class="color === c ? 'border-[#2563eb] scale-110' : 'border-transparent'"
            :style="{ background: c }"
            :title="c"
            @click="color = c"
          />
          <el-color-picker v-model="color" size="small" />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[11.5px] text-[#6b7280]">笔宽</span>
          <el-slider v-model="penWidth" :min="1" :max="16" size="small" style="width: 110px" />
          <span class="w-[30px] font-mono text-[11px] text-[#6b7280]">{{ penWidth }}px</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[11.5px] text-[#6b7280]">背景</span>
          <el-radio-group v-model="bg" size="small">
            <el-radio-button value="transparent">透明</el-radio-button>
            <el-radio-button value="white">白色</el-radio-button>
          </el-radio-group>
        </div>

        <el-checkbox v-model="showGuide" size="small">辅助线</el-checkbox>
        <span class="ml-auto text-[11px] text-[#9ca3af]">画布 {{ sizeLabel }} · 支持数位板 / 触屏</span>
      </div>

      <div ref="wrapRef" class="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          class="relative overflow-hidden rounded-xl border border-[#e6e8eb]"
          :style="{
            background: bg === 'white' ? '#fff' : undefined,
            backgroundColor: bg === 'transparent' ? '#fff' : undefined,
            backgroundImage:
              bg === 'transparent'
                ? 'linear-gradient(45deg, #f1f3f5 25%, transparent 25%), linear-gradient(-45deg, #f1f3f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f3f5 75%), linear-gradient(-45deg, transparent 75%, #f1f3f5 75%)'
                : undefined,
            backgroundSize: bg === 'transparent' ? '16px 16px' : undefined,
            backgroundPosition: bg === 'transparent' ? '0 0, 0 8px, 8px -8px, -8px 0' : undefined,
          }"
        >
          <canvas
            ref="canvasRef"
            class="relative z-10 cursor-crosshair touch-none"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="finishStroke"
            @pointercancel="finishStroke"
          />
          <div v-if="showGuide && !hasContent && !drawing" class="pointer-events-none absolute inset-x-0 bottom-14 z-0 mx-auto w-2/3 border-b border-dashed border-[#d1d5db]" />
          <div v-if="showGuide && !hasContent && !drawing" class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-[13px] text-[#c3c8d1]">
            在此处书写签名
          </div>
        </div>
      </div>

      <p class="mt-2 text-[11px] leading-relaxed text-[#9ca3af]">
        提示：签名仅在本机浏览器中绘制，不会上传任何数据；导出透明背景 PNG 可直接叠加到合同、表单等图片上。
      </p>
    </section>
  </ToolPage>
</template>
