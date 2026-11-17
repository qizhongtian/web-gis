<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import {
  contrastRatio,
  hslToRgb,
  mixColor,
  parseColor,
  randomHex,
  readableText,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  type RGB,
} from '@/utils/tools/color'
import { copyText } from '@/utils/tools/file'

const hex = ref('#2563eb')
const alpha = ref(100)
const copiedKey = ref('')
const recent = ref<string[]>(['#2563eb', '#111827', '#10b981', '#f59e0b'])

const rgb = computed<RGB>(() => parseColor(hex.value) ?? { r: 37, g: 99, b: 235 })
const rgbHex = computed(() => rgbToHex(rgb.value))
const hsl = computed(() => rgbToHsl(rgb.value))
const hsv = computed(() => rgbToHsv(rgb.value))
const cmyk = computed(() => rgbToCmyk(rgb.value))
const alphaValue = computed(() => alpha.value / 100)

const rgbaString = computed(
  () => `rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, ${Number(alphaValue.value.toFixed(2))})`,
)
const hexAlpha = computed(() => {
  const a = Math.round(alphaValue.value * 255)
    .toString(16)
    .padStart(2, '0')
  return `${rgbHex.value}${a}`
})
const values = computed(() => [
  { label: 'HEX', value: rgbHex.value, key: 'hex' },
  { label: 'HEX (含透明)', value: hexAlpha.value, key: 'hexa' },
  { label: 'RGB', value: `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})`, key: 'rgb' },
  { label: 'RGBA', value: rgbaString.value, key: 'rgba' },
  {
    label: 'HSL',
    value: `hsl(${hsl.value.h.toFixed(0)}, ${hsl.value.s.toFixed(1)}%, ${hsl.value.l.toFixed(1)}%)`,
    key: 'hsl',
  },
  {
    label: 'HSV',
    value: `hsv(${hsv.value.h.toFixed(0)}, ${hsv.value.s.toFixed(1)}%, ${hsv.value.v.toFixed(1)}%)`,
    key: 'hsv',
  },
  {
    label: 'CMYK',
    value: `cmyk(${cmyk.value.c.toFixed(0)}%, ${cmyk.value.m.toFixed(0)}%, ${cmyk.value.y.toFixed(0)}%, ${cmyk.value.k.toFixed(0)}%)`,
    key: 'cmyk',
  },
  { label: 'CSS 变量', value: `--color-primary: ${rgbHex.value};`, key: 'var' },
])

/** 与白色 / 黑色混色得到色阶 */
const tints = computed(() =>
  Array.from({ length: 10 }, (_, i) => rgbToHex(mixColor(rgb.value, { r: 255, g: 255, b: 255 }, (i + 1) / 11))),
)
const shades = computed(() =>
  Array.from({ length: 10 }, (_, i) => rgbToHex(mixColor(rgb.value, { r: 0, g: 0, b: 0 }, (i + 1) / 11))),
)

const whiteContrast = computed(() => contrastRatio(rgb.value, { r: 255, g: 255, b: 255 }))
const blackContrast = computed(() => contrastRatio(rgb.value, { r: 17, g: 24, b: 39 }))
const bestText = computed(() => readableText(rgb.value))

function wcag(ratio: number) {
  return {
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    large: ratio >= 3,
    value: ratio.toFixed(2),
  }
}

const contrastList = computed(() => [
  { name: '白色文字', color: '#ffffff', ...wcag(whiteContrast.value), ratio: whiteContrast.value },
  { name: '黑色文字', color: '#111827', ...wcag(blackContrast.value), ratio: blackContrast.value },
])

/** 色彩调和：互补 / 类似 / 三角 */
const harmonies = computed(() => {
  const base = hsl.value
  const build = (h: number) =>
    rgbToHex(hslToRgb({ h: (base.h + h + 360) % 360, s: base.s, l: base.l }))
  return [
    { name: '互补色', colors: [rgbHex.value, build(180)] },
    { name: '类似色', colors: [build(-30), rgbHex.value, build(30)] },
    { name: '三角配色', colors: [rgbHex.value, build(120), build(240)] },
    { name: '分裂互补', colors: [rgbHex.value, build(150), build(210)] },
  ]
})

watch(
  rgbHex,
  (v) => {
    if (!recent.value.includes(v)) recent.value = [v, ...recent.value].slice(0, 10)
  },
  { flush: 'post' },
)

function setColor(c: string) {
  hex.value = c
}

function random() {
  hex.value = randomHex()
}

async function copy(value: string, key: string) {
  if (await copyText(value)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  }
}

function copyAll() {
  const text = values.value.map((v) => `${v.label}: ${v.value}`).join('\n')
  copy(text, 'all')
}
</script>

<template>
  <ToolPage title="颜色工具" desc="HEX / RGB / HSL / HSV / CMYK 互转，色阶、对比度检测与配色建议" wide>
    <template #actions>
      <el-button size="small" @click="random">随机颜色</el-button>
      <el-button size="small" type="primary" @click="copyAll">{{ copiedKey === 'all' ? '已复制' : '复制全部' }}</el-button>
    </template>

    <div class="grid flex-1 gap-3 lg:grid-cols-[380px_1fr]">
      <!-- 左侧：选择与转换 -->
      <section class="app-panel flex flex-col gap-3 p-3">
        <div class="flex items-center gap-2">
          <el-color-picker v-model="hex" size="large" />
          <el-input v-model="hex" class="font-mono" placeholder="#2563eb" />
        </div>

        <div>
          <div class="flex items-center justify-between pb-1 text-[11.5px] text-[#6b7280]">
            <span>不透明度</span>
            <span class="font-mono">{{ alpha }}%</span>
          </div>
          <el-slider v-model="alpha" :min="0" :max="100" size="small" />
        </div>

        <div
          class="relative flex min-h-[80px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#eef0f3]"
          style="background-image: linear-gradient(45deg, #f1f3f5 25%, transparent 25%), linear-gradient(-45deg, #f1f3f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f3f5 75%), linear-gradient(-45deg, transparent 75%, #f1f3f5 75%); background-size: 14px 14px; background-position: 0 0, 0 7px, 7px -7px, -7px 0;"
        >
          <div class="absolute inset-0" :style="{ background: rgbaString }" />
          <span class="relative rounded-md px-2 py-1 text-[12px] font-medium" :style="{ color: bestText }">
            {{ rgbHex }}
          </span>
        </div>

        <div class="divide-y divide-[#f3f4f6]">
          <div v-for="v in values" :key="v.key" class="flex items-center gap-2 py-1.5">
            <span class="w-[86px] shrink-0 text-[11.5px] text-[#9ca3af]">{{ v.label }}</span>
            <code class="min-w-0 flex-1 truncate text-[12px] text-[#1f2328]">{{ v.value }}</code>
            <button type="button" class="copy-btn" @click="copy(v.value, v.key)">
              {{ copiedKey === v.key ? '已复制' : '复制' }}
            </button>
          </div>
        </div>

        <div>
          <div class="pb-1.5 text-[11.5px] text-[#6b7280]">最近使用</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="c in recent"
              :key="c"
              type="button"
              class="h-6 w-6 rounded-md border border-black/5 transition hover:scale-110"
              :style="{ background: c }"
              :title="c"
              @click="setColor(c)"
            />
          </div>
        </div>
      </section>

      <!-- 右侧：色阶 / 对比度 / 配色 -->
      <div class="space-y-3">
        <section class="app-panel p-3">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[12.5px] font-medium text-[#374151]">色阶（点击取色）</span>
            <span class="ml-auto text-[11px] text-[#9ca3af]">与白色 / 黑色混合</span>
          </div>
          <div class="space-y-1.5">
            <div class="grid grid-cols-10 gap-1.5">
              <button
                v-for="c in tints"
                :key="`t-${c}`"
                type="button"
                class="tone"
                :style="{ background: c }"
                :title="c"
                @click="setColor(c)"
              />
            </div>
            <div class="grid grid-cols-10 gap-1.5">
              <button
                v-for="c in shades"
                :key="`s-${c}`"
                type="button"
                class="tone"
                :style="{ background: c }"
                :title="c"
                @click="setColor(c)"
              />
            </div>
          </div>
        </section>

        <section class="app-panel p-3">
          <div class="pb-2 text-[12.5px] font-medium text-[#374151]">对比度检测（WCAG）</div>
          <div class="space-y-2">
            <div
              v-for="item in contrastList"
              :key="item.name"
              class="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5"
              :style="{ background: item.color, color: item.color === '#ffffff' ? '#111827' : '#ffffff' }"
            >
              <span class="text-[12.5px] font-medium">{{ item.name }}</span>
              <span class="font-mono text-[13px] font-semibold">{{ item.ratio.toFixed(2) }} : 1</span>
              <span class="ml-auto flex items-center gap-1.5 text-[11px]">
                <span class="badge" :class="item.aa ? 'pass' : 'fail'">AA {{ item.aa ? '通过' : '不通过' }}</span>
                <span class="badge" :class="item.aaa ? 'pass' : 'fail'">AAA {{ item.aaa ? '通过' : '不通过' }}</span>
                <span class="badge" :class="item.large ? 'pass' : 'fail'">大字 {{ item.large ? '通过' : '不通过' }}</span>
              </span>
            </div>
          </div>
          <p class="mt-2 text-[11px] text-[#9ca3af]">普通文字 AA ≥ 4.5:1，AAA ≥ 7:1；18pt 以上大字 AA ≥ 3:1。</p>
        </section>

        <section class="app-panel p-3">
          <div class="pb-2 text-[12.5px] font-medium text-[#374151]">配色建议</div>
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="h in harmonies" :key="h.name" class="rounded-lg border border-[#eef0f3] p-2">
              <div class="pb-1.5 text-[11.5px] text-[#6b7280]">{{ h.name }}</div>
              <div class="flex overflow-hidden rounded-md">
                <button
                  v-for="c in h.colors"
                  :key="c"
                  type="button"
                  class="group relative h-12 flex-1"
                  :style="{ background: c }"
                  :title="`${c}（点击复制）`"
                  @click="copy(c, `h-${c}`)"
                >
                  <span class="absolute inset-x-0 bottom-0 bg-black/35 py-0.5 text-[9.5px] text-white opacity-0 transition group-hover:opacity-100">
                    {{ c }}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <p class="mt-2 text-[11px] text-[#9ca3af]">点击色块即可复制对应色值。</p>
        </section>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.copy-btn {
  flex: none;
  padding: 1px 6px;
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
.tone {
  height: 34px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.tone:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgb(0 0 0 / 12%);
}
.badge {
  padding: 0.5px 5px;
  border-radius: 4px;
  background: rgb(127 127 127 / 22%);
  font-size: 10px;
}
.badge.fail {
  background: rgb(220 38 38 / 25%);
}
</style>
