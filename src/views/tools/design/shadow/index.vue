<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { parseColor } from '@/utils/tools/color'
import { copyText } from '@/utils/tools/file'

interface Layer {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  opacity: number
  inset: boolean
}

const mode = ref<'box' | 'text'>('box')
const layers = ref<Layer[]>([
  { x: 0, y: 8, blur: 24, spread: -4, color: '#111827', opacity: 16, inset: false },
  { x: 0, y: 2, blur: 6, spread: 0, color: '#111827', opacity: 8, inset: false },
])
const copiedKey = ref('')
const previewBg = ref<'light' | 'dark' | 'grid'>('light')

const PRESETS: { name: string; mode: 'box' | 'text'; layers: Layer[] }[] = [
  {
    name: '卡片',
    mode: 'box',
    layers: [
      { x: 0, y: 1, blur: 3, spread: 0, color: '#111827', opacity: 10, inset: false },
      { x: 0, y: 8, blur: 24, spread: -6, color: '#111827', opacity: 12, inset: false },
    ],
  },
  {
    name: '悬浮',
    mode: 'box',
    layers: [
      { x: 0, y: 10, blur: 30, spread: -8, color: '#111827', opacity: 22, inset: false },
      { x: 0, y: 2, blur: 6, spread: -2, color: '#111827', opacity: 8, inset: false },
    ],
  },
  {
    name: '轻浮',
    mode: 'box',
    layers: [{ x: 0, y: 4, blur: 12, spread: -2, color: '#2563eb', opacity: 18, inset: false }],
  },
  {
    name: '内凹',
    mode: 'box',
    layers: [
      { x: 0, y: 2, blur: 6, spread: 0, color: '#111827', opacity: 14, inset: true },
      { x: 0, y: -2, blur: 6, spread: 0, color: '#ffffff', opacity: 60, inset: true },
    ],
  },
  {
    name: '霓虹',
    mode: 'box',
    layers: [{ x: 0, y: 0, blur: 28, spread: 4, color: '#6366f1', opacity: 55, inset: false }],
  },
  {
    name: '立体',
    mode: 'box',
    layers: [
      { x: 0, y: 4, blur: 0, spread: 0, color: '#94a3b8', opacity: 100, inset: false },
      { x: 0, y: 8, blur: 0, spread: 0, color: '#111827', opacity: 12, inset: false },
    ],
  },
  {
    name: '弥散光',
    mode: 'box',
    layers: [{ x: 0, y: 20, blur: 60, spread: 0, color: '#8b5cf6', opacity: 30, inset: false }],
  },
  {
    name: '文字描影',
    mode: 'text',
    layers: [{ x: 0, y: 2, blur: 4, spread: 0, color: '#111827', opacity: 30, inset: false }],
  },
  {
    name: '文字发光',
    mode: 'text',
    layers: [
      { x: 0, y: 0, blur: 10, spread: 0, color: '#22d3ee', opacity: 80, inset: false },
      { x: 0, y: 0, blur: 24, spread: 0, color: '#3b82f6', opacity: 50, inset: false },
    ],
  },
]

function rgba(color: string, opacity: number) {
  const rgb = parseColor(color) ?? { r: 17, g: 24, b: 39 }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number((opacity / 100).toFixed(2))})`
}

function layerCss(l: Layer) {
  const inset = l.inset && mode.value === 'box' ? 'inset ' : ''
  const spread = mode.value === 'box' ? `${l.spread}px ` : ''
  return `${inset}${l.x}px ${l.y}px ${l.blur}px ${spread}${rgba(l.color, l.opacity)}`
}

const shadowValue = computed(() => layers.value.map(layerCss).join(', '))
const css = computed(() =>
  mode.value === 'box' ? `box-shadow: ${shadowValue.value};` : `text-shadow: ${shadowValue.value};`,
)
const tailwind = computed(() => `shadow-[${shadowValue.value.replace(/\s+/g, '_')}]`)

const previewStyle = computed(() =>
  mode.value === 'box' ? { boxShadow: shadowValue.value } : { textShadow: shadowValue.value },
)

function addLayer() {
  if (layers.value.length >= 6) return ElMessage.warning('最多 6 个阴影层')
  layers.value.push({ x: 0, y: 4, blur: 12, spread: 0, color: '#111827', opacity: 12, inset: false })
}

function removeLayer(i: number) {
  if (layers.value.length <= 1) return ElMessage.warning('至少保留一个阴影层')
  layers.value.splice(i, 1)
}

function reset() {
  mode.value = 'box'
  layers.value = [
    { x: 0, y: 8, blur: 24, spread: -4, color: '#111827', opacity: 16, inset: false },
    { x: 0, y: 2, blur: 6, spread: 0, color: '#111827', opacity: 8, inset: false },
  ]
}

function applyPreset(p: (typeof PRESETS)[number]) {
  mode.value = p.mode
  layers.value = p.layers.map((l) => ({ ...l }))
}

async function copy(value: string, key: string) {
  if (await copyText(value)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  }
}

const previewBgStyle = computed(() => {
  if (previewBg.value === 'dark') return { background: '#0f172a' }
  if (previewBg.value === 'grid') {
    return {
      backgroundColor: '#ffffff',
      backgroundImage:
        'linear-gradient(45deg, #f1f3f5 25%, transparent 25%), linear-gradient(-45deg, #f1f3f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f3f5 75%), linear-gradient(-45deg, transparent 75%, #f1f3f5 75%)',
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
    }
  }
  return { background: '#ffffff' }
})
</script>

<template>
  <ToolPage title="阴影生成" desc="可视化调节 box-shadow / text-shadow，支持多层叠加与常用预设" wide>
    <template #actions>
      <el-button size="small" @click="reset">重置</el-button>
      <el-button size="small" type="primary" @click="copy(css, 'css')">
        {{ copiedKey === 'css' ? '已复制' : '复制 CSS' }}
      </el-button>
    </template>

    <div class="grid flex-1 gap-3 lg:grid-cols-[400px_1fr]">
      <section class="app-panel p-3 space-y-3">
        <div class="flex items-center gap-2">
          <el-radio-group v-model="mode" size="small">
            <el-radio-button value="box">盒子阴影</el-radio-button>
            <el-radio-button value="text">文字阴影</el-radio-button>
          </el-radio-group>
          <el-button size="small" text class="ml-auto" @click="addLayer">+ 阴影层</el-button>
        </div>

        <div v-for="(l, i) in layers" :key="i" class="rounded-xl border border-[#eef0f3] bg-[#fcfcfd] p-2.5">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[11.5px] text-[#6b7280]">第 {{ i + 1 }} 层</span>
            <el-checkbox v-if="mode === 'box'" v-model="l.inset" size="small" class="ml-auto !mr-0">内阴影</el-checkbox>
            <button type="button" class="del-btn" title="删除该层" @click="removeLayer(i)">×</button>
          </div>

          <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <label class="row">
              <span>水平 X</span>
              <el-input-number v-model="l.x" :min="-100" :max="100" size="small" controls-position="right" />
            </label>
            <label class="row">
              <span>垂直 Y</span>
              <el-input-number v-model="l.y" :min="-100" :max="100" size="small" controls-position="right" />
            </label>
            <label class="row">
              <span>模糊</span>
              <el-input-number v-model="l.blur" :min="0" :max="150" size="small" controls-position="right" />
            </label>
            <label v-if="mode === 'box'" class="row">
              <span>扩散</span>
              <el-input-number v-model="l.spread" :min="-60" :max="100" size="small" controls-position="right" />
            </label>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <el-color-picker v-model="l.color" size="small" />
            <code class="w-[70px] shrink-0 text-[10.5px] text-[#9ca3af]">{{ l.color }}</code>
            <el-slider v-model="l.opacity" :min="0" :max="100" size="small" class="flex-1" />
            <span class="w-[38px] shrink-0 text-right font-mono text-[10.5px] text-[#6b7280]">{{ l.opacity }}%</span>
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-3">
        <section class="app-panel flex min-h-[240px] flex-1 flex-col p-3">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[12.5px] font-medium text-[#374151]">预览</span>
            <el-radio-group v-model="previewBg" size="small" class="ml-auto">
              <el-radio-button value="light">浅色</el-radio-button>
              <el-radio-button value="dark">深色</el-radio-button>
              <el-radio-button value="grid">网格</el-radio-button>
            </el-radio-group>
          </div>
          <div class="flex flex-1 items-center justify-center rounded-xl border border-[#eef0f3]" :style="previewBgStyle">
            <div v-if="mode === 'box'">
              <div
                class="flex h-[112px] w-[220px] items-center justify-center rounded-xl bg-white text-[13px] text-[#374151]"
                :style="previewStyle"
              >
                Shadow Preview
              </div>
            </div>
            <div
              v-else
              class="text-[30px] font-bold tracking-wide"
              :class="previewBg === 'dark' ? 'text-white' : 'text-[#1f2328]'"
              :style="previewStyle"
            >
              Shadow Text
            </div>
          </div>
        </section>

        <section class="app-panel p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-[12.5px] font-medium text-[#374151]">CSS</span>
            <button type="button" class="copy-btn ml-auto" @click="copy(css, 'css')">
              {{ copiedKey === 'css' ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-block">{{ css }}</pre>

          <div class="flex items-center gap-2 pt-1">
            <span class="text-[12.5px] font-medium text-[#374151]">{{ mode === 'box' ? 'Tailwind 任意值' : '等价 rgba 写法' }}</span>
            <button type="button" class="copy-btn ml-auto" @click="copy(tailwind, 'tw')">
              {{ copiedKey === 'tw' ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-block">{{ tailwind }}</pre>
        </section>

        <section class="app-panel p-3">
          <div class="pb-2 text-[12.5px] font-medium text-[#374151]">预设</div>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              type="button"
              class="flex h-[74px] flex-col items-center justify-center gap-2 rounded-lg border border-[#eef0f3] bg-white text-[11px] text-[#4b5563] transition hover:border-[#c7d7fb] hover:text-[#2563eb]"
              @click="applyPreset(p)"
            >
              <span
                class="h-8 w-12 rounded-md bg-white ring-1 ring-[#eef0f3]"
                :style="{ boxShadow: p.layers.map((l) => `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${rgba(l.color, l.opacity)}`).join(', ') }"
              />
              {{ p.name }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9ca3af;
}
.row > span {
  width: 44px;
  flex: none;
}
.row :deep(.el-input-number) {
  width: 100%;
}
.code-block {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #0b1623;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.copy-btn {
  padding: 1px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
}
.copy-btn:hover {
  background: #eef4ff;
  color: #2563eb;
}
.del-btn {
  flex: none;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #b0b7c3;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.del-btn:hover {
  background: #fdeeee;
  color: #dc2626;
}
</style>
