<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const value = ref(16)
const fromUnit = ref<'px' | 'rem' | 'em' | 'vw' | 'vh' | 'pt'>('px')
const rootSize = ref(16)
const designWidth = ref(1920)
const designHeight = ref(1080)

const units = ['px', 'rem', 'em', 'vw', 'vh', 'pt'] as const

/** 统一换算成 px（em 与 rem 在这里按同一基准，仅作对照） */
const pxValue = computed(() => {
  const v = Number(value.value) || 0
  switch (fromUnit.value) {
    case 'rem':
    case 'em':
      return v * rootSize.value
    case 'vw':
      return (v / 100) * designWidth.value
    case 'vh':
      return (v / 100) * designHeight.value
    case 'pt':
      return (v * 96) / 72
    default:
      return v
  }
})

function fmt(n: number, digits = 3) {
  if (!Number.isFinite(n)) return '0'
  const rounded = Number(n.toFixed(digits))
  return String(rounded)
}

const rows = computed(() =>
  units.map((u) => {
    const px = pxValue.value
    let converted = 0
    switch (u) {
      case 'rem':
      case 'em':
        converted = rootSize.value ? px / rootSize.value : 0
        break
      case 'vw':
        converted = designWidth.value ? (px / designWidth.value) * 100 : 0
        break
      case 'vh':
        converted = designHeight.value ? (px / designHeight.value) * 100 : 0
        break
      case 'pt':
        converted = (px * 72) / 96
        break
      default:
        converted = px
    }
    return { unit: u, text: `${fmt(converted)}${u}`, raw: `${fmt(converted)}${u}` }
  }),
)

const cssVar = computed(() => {
  const base = pxValue.value / rootSize.value
  return `html {\n  font-size: ${fmt(rootSize.value, 0)}px;\n}\n\n/* 设计稿 ${value.value}${fromUnit.value} → ${fmt(base, 3)}rem */`
})

async function copy(text: string, label: string) {
  if (await copyText(text)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

const quickRefs = [
  { px: 12, rem: 0.75, note: '辅助文字' },
  { px: 14, rem: 0.875, note: '正文（小）' },
  { px: 16, rem: 1, note: '正文（基准）' },
  { px: 18, rem: 1.125, note: '小标题' },
  { px: 20, rem: 1.25, note: '标题' },
  { px: 24, rem: 1.5, note: '大标题' },
  { px: 32, rem: 2, note: '展示标题' },
  { px: 48, rem: 3, note: 'Hero' },
]
</script>

<template>
  <ToolPage title="单位换算" desc="px / rem / em / vw / vh / pt 互转，支持自定义根字号与设计稿尺寸" wide>
    <template #actions>
      <el-button size="small" @click="copy(cssVar, 'CSS')">复制根字号 CSS</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">数值</div>
          <el-input v-model.number="value" type="number" placeholder="16" />
        </div>
        <div>
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">输入单位</div>
          <el-select v-model="fromUnit" style="width: 100%">
            <el-option v-for="u in units" :key="u" :label="u" :value="u" />
          </el-select>
        </div>
        <div>
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">根字号 (root font-size)</div>
          <el-input v-model.number="rootSize" type="number" placeholder="16">
            <template #append>px</template>
          </el-input>
        </div>
        <div>
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">视口宽 / 高</div>
          <div class="flex gap-2">
            <el-input v-model.number="designWidth" type="number" />
            <el-input v-model.number="designHeight" type="number" />
          </div>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">
            换算结果
            <span class="text-[11px] font-normal text-[#9ca3af]">基准 {{ fmt(pxValue) }}px</span>
          </div>
          <div v-for="row in rows" :key="row.unit" class="tool-kv">
            <span class="w-[46px] shrink-0 font-mono text-[12px] text-[#6b7280]">{{ row.unit }}</span>
            <span class="tool-kv-value text-[#2563eb]">{{ row.text }}</span>
            <button type="button" class="tool-link-btn" @click="copy(row.raw, row.unit)">复制</button>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="tool-card">
            <div class="tool-card-head">可视化</div>
            <div class="flex items-end gap-3 pt-1">
              <div class="flex flex-col items-center gap-1">
                <div class="scale-bar" :style="{ height: Math.min(pxValue, 120) + 'px' }" />
                <span class="text-[10.5px] text-[#9ca3af]">{{ fmt(pxValue) }}px</span>
              </div>
              <div class="flex-1 text-[12px] leading-relaxed text-[#6b7280]">
                <p class="m-0">1rem = {{ rootSize }}px，因此 {{ fmt(pxValue) }}px ≈ {{ fmt(pxValue / rootSize) }}rem。</p>
                <p class="m-0 mt-1">移动端常用：以 375 设计稿为例，1vw = 3.75px，100vw = 视口宽度。</p>
              </div>
            </div>
          </div>

          <div class="tool-card">
            <div class="tool-card-head">
              CSS
              <button type="button" class="tool-link-btn ml-auto" @click="copy(cssVar, 'CSS')">复制</button>
            </div>
            <pre class="tool-code">{{ cssVar }}</pre>
          </div>
        </div>
      </div>

      <div class="tool-card">
        <div class="tool-card-head">常用字号对照（root = 16px）</div>
        <table class="tool-table">
          <thead>
            <tr>
              <th>px</th>
              <th>rem</th>
              <th>用途</th>
              <th>预览</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in quickRefs" :key="item.px">
              <td class="font-mono">{{ item.px }}</td>
              <td class="font-mono">{{ item.rem }}</td>
              <td class="text-[#6b7280]">{{ item.note }}</td>
              <td><span :style="{ fontSize: item.px + 'px' }">前端 Web GIS</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tool-note">
        <p class="m-0">· rem 相对根元素，em 相对当前元素父级字号——嵌套时 em 会逐层放大，容易踩坑。</p>
        <p class="m-0">· vw/vh 适合整屏布局；注意移动端 100vh 会包含地址栏，建议用 `100dvh`。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.scale-bar {
  width: 18px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #93b4f7, #2563eb);
}
</style>
