<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const fg = ref('#4b5563')
const bg = ref('#ffffff')

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const num = parseInt(full.slice(0, 6) || '000000', 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

/** WCAG 相对亮度：先做 sRGB 反伽马 */
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastOf(a: string, b: string) {
  const la = luminance(a)
  const lb = luminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

const ratio = computed(() => contrastOf(fg.value, bg.value))
const ratioText = computed(() => `${ratio.value.toFixed(2)}:1`)

const grades = computed(() => {
  const r = ratio.value
  return [
    { label: '正文 AA（≥4.5）', pass: r >= 4.5 },
    { label: '正文 AAA（≥7）', pass: r >= 7 },
    { label: '大字 AA（≥3）', pass: r >= 3 },
    { label: '大字 AAA（≥4.5）', pass: r >= 4.5 },
    { label: '非文本 UI（≥3）', pass: r >= 3 },
  ]
})

const levelText = computed(() => {
  const r = ratio.value
  if (r >= 7) return { text: 'AAA 通过', type: 'success' as const }
  if (r >= 4.5) return { text: 'AA 通过', type: 'success' as const }
  if (r >= 3) return { text: '仅大字/图形可用', type: 'warning' as const }
  return { text: '不达标', type: 'danger' as const }
})

/** 二分调整前景色亮度，直到达到目标对比度 */
function fixForeground(target = 4.5): string | null {
  const bgLum = luminance(bg.value)
  const [r, g, b] = hexToRgb(fg.value)
  const darker = bgLum > 0.5
  let best: string | null = null
  for (let step = 0; step <= 100; step++) {
    const factor = 1 - step / 100
    const next: [number, number, number] = darker
      ? [r * factor, g * factor, b * factor]
      : [r + (255 - r) * (step / 100), g + (255 - g) * (step / 100), b + (255 - b) * (step / 100)]
    const hex = rgbToHex(next)
    if (contrastOf(hex, bg.value) >= target) {
      best = hex
      break
    }
  }
  return best
}

const suggestions = computed(() => {
  if (ratio.value >= 4.5) return []
  const list: { label: string; color: string; ratio: string }[] = []
  const s45 = fixForeground(4.5)
  const s7 = fixForeground(7)
  if (s45) list.push({ label: '满足 AA', color: s45, ratio: `${contrastOf(s45, bg.value).toFixed(2)}:1` })
  if (s7) list.push({ label: '满足 AAA', color: s7, ratio: `${contrastOf(s7, bg.value).toFixed(2)}:1` })
  return list
})

async function copy(text: string, label: string) {
  if (await copyText(text)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function swap() {
  const tmp = fg.value
  fg.value = bg.value
  bg.value = tmp
}

const presets = [
  { fg: '#111827', bg: '#ffffff' },
  { fg: '#6b7280', bg: '#f9fafb' },
  { fg: '#ffffff', bg: '#2563eb' },
  { fg: '#b91c1c', bg: '#fef2f2' },
  { fg: '#ffffff', bg: '#111827' },
]
</script>

<template>
  <ToolPage title="颜色对比度" desc="按 WCAG 2.1 计算对比度，判断 AA / AAA 是否达标并给出可读色建议" wide>
    <template #actions>
      <el-tag :type="levelText.type" size="small">{{ levelText.text }} · {{ ratioText }}</el-tag>
      <el-button size="small" @click="swap">交换前景/背景</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">文字颜色</div>
          <div class="flex items-center gap-3">
            <el-color-picker v-model="fg" />
            <el-input v-model="fg" class="font-mono" />
            <button type="button" class="tool-link-btn" @click="copy(fg, '前景色')">复制</button>
          </div>
        </div>
        <div class="tool-card">
          <div class="tool-card-head">背景颜色</div>
          <div class="flex items-center gap-3">
            <el-color-picker v-model="bg" />
            <el-input v-model="bg" class="font-mono" />
            <button type="button" class="tool-link-btn" @click="copy(bg, '背景色')">复制</button>
          </div>
        </div>
      </div>

      <div class="preview" :style="{ background: bg }">
        <p class="m-0 text-[24px] font-semibold leading-tight" :style="{ color: fg }">大字号标题 Aa</p>
        <p class="m-0 mt-2 text-[14px] leading-relaxed" :style="{ color: fg }">
          正文示例：地图缩放级别 12，中心点 116.397°E / 39.908°N。这是一段用于检验可读性的说明文字。
        </p>
        <p class="m-0 mt-2 text-[12px]" :style="{ color: fg }">辅助文字 12px：更新时间 2026-11-17 10:24</p>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">
            对比度 <span class="font-mono text-[16px] text-[#2563eb]">{{ ratioText }}</span>
          </div>
          <div v-for="g in grades" :key="g.label" class="tool-kv">
            <span class="tool-kv-value text-[12px]">{{ g.label }}</span>
            <el-tag size="small" :type="g.pass ? 'success' : 'danger'">{{ g.pass ? '通过' : '不通过' }}</el-tag>
          </div>
        </div>

        <div class="tool-card">
          <div class="tool-card-head">推荐色</div>
          <p v-if="!suggestions.length" class="m-0 py-3 text-[12px] text-[#6b7280]">当前配色已满足正文 AA，无需调整。</p>
          <div v-for="s in suggestions" :key="s.label" class="tool-kv">
            <span class="swatch" :style="{ background: s.color }" />
            <span class="tool-kv-value">{{ s.color }}</span>
            <span class="text-[11.5px] text-[#9ca3af]">{{ s.label }} · {{ s.ratio }}</span>
            <button type="button" class="tool-link-btn" @click="fg = s.color">应用</button>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#f1f3f5] pt-2">
            <span class="text-[11px] text-[#9ca3af]">常用配色</span>
            <button
              v-for="(p, i) in presets"
              :key="i"
              type="button"
              class="tool-chip"
              :style="{ background: p.bg, color: p.fg }"
              @click="fg = p.fg; bg = p.bg"
            >
              Aa
            </button>
          </div>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 计算依据 WCAG 2.1 相对亮度公式，与 Chrome DevTools 的对比度数值一致。</p>
        <p class="m-0">· 「大字」指 ≥18.66px 粗体或 ≥24px 普通文本；AA 要求 3:1，正文仍要求 4.5:1。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.preview {
  border-radius: 12px;
  border: 1px solid #eef0f3;
  padding: 18px 20px;
}
.swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid #e6e8eb;
  flex: none;
}
</style>
