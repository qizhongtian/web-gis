<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const corners = ref({ tl: 12, tr: 12, br: 12, bl: 12 })
const linked = ref(true)
const unit = ref<'px' | '%' | 'rem'>('px')
const boxSize = ref(200)
const bg = ref('#2563eb')
const fill = ref('#eef4ff')
const borderWidth = ref(0)
const borderColor = ref('#c7d7fb')

const presets = [
  { label: '卡片', value: { tl: 12, tr: 12, br: 12, bl: 12 }, unit: 'px' as const },
  { label: '胶囊', value: { tl: 999, tr: 999, br: 999, bl: 999 }, unit: 'px' as const },
  { label: '圆', value: { tl: 50, tr: 50, br: 50, bl: 50 }, unit: '%' as const },
  { label: '对话气泡', value: { tl: 14, tr: 14, br: 14, bl: 0 }, unit: 'px' as const },
  { label: '叶子', value: { tl: 40, tr: 4, br: 40, bl: 4 }, unit: 'px' as const },
  { label: '斜角卡片', value: { tl: 0, tr: 24, br: 0, bl: 24 }, unit: 'px' as const },
]

/** 联动时四角同步 */
function onCornerChange(key: keyof typeof corners.value, value: number) {
  if (!linked.value) return
  corners.value = { tl: value, tr: value, br: value, bl: value }
  void key
}

const radiusText = computed(() => {
  const { tl, tr, br, bl } = corners.value
  const u = unit.value
  if (tl === tr && tr === br && br === bl) return `${tl}${u}`
  if (tl === br && tr === bl) return `${tl}${u} ${tr}${u}`
  return `${tl}${u} ${tr}${u} ${br}${u} ${bl}${u}`
})

const cssCode = computed(() => {
  const lines = [`border-radius: ${radiusText.value};`]
  if (borderWidth.value > 0) {
    lines.push(`border: ${borderWidth.value}px solid ${borderColor.value};`)
  }
  return lines.join('\n')
})

const previewStyle = computed(() => ({
  width: `${boxSize.value}px`,
  height: `${Math.round(boxSize.value * 0.62)}px`,
  borderRadius: radiusText.value,
  background: bg.value,
  border: borderWidth.value > 0 ? `${borderWidth.value}px solid ${borderColor.value}` : 'none',
}))

const innerStyle = computed(() => ({
  borderRadius: radiusText.value,
  background: fill.value,
}))

async function copy(value: string, label = 'CSS') {
  if (await copyText(value)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function applyPreset(p: (typeof presets)[number]) {
  corners.value = { ...p.value }
  unit.value = p.unit
}
</script>

<template>
  <ToolPage title="圆角生成" desc="四角独立调节，实时预览并复制 border-radius 声明" wide>
    <template #actions>
      <el-button size="small" @click="copy(cssCode)">复制 CSS</el-button>
      <el-button size="small" @click="applyPreset(presets[0])">重置</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-button-group size="small">
          <el-button :type="unit === 'px' ? 'primary' : ''" @click="unit = 'px'">px</el-button>
          <el-button :type="unit === '%' ? 'primary' : ''" @click="unit = '%'">%</el-button>
          <el-button :type="unit === 'rem' ? 'primary' : ''" @click="unit = 'rem'">rem</el-button>
        </el-button-group>
        <el-checkbox v-model="linked" size="small">四角联动</el-checkbox>
        <span class="mx-1 h-4 w-px bg-[#e6e8eb]" />
        <span class="text-[12px] text-[#6b7280]">预设</span>
        <button v-for="p in presets" :key="p.label" type="button" class="tool-chip" @click="applyPreset(p)">
          {{ p.label }}
        </button>
      </div>

      <div class="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div class="tool-card flex flex-col gap-3">
          <div>
            <div class="pb-1 text-[12px] text-[#6b7280]">左上 {{ corners.tl }}{{ unit }}</div>
            <el-slider
              v-model="corners.tl"
              :max="unit === '%' ? 50 : 200"
              size="small"
              @input="onCornerChange('tl', $event as number)"
            />
          </div>
          <div>
            <div class="pb-1 text-[12px] text-[#6b7280]">右上 {{ corners.tr }}{{ unit }}</div>
            <el-slider v-model="corners.tr" :max="unit === '%' ? 50 : 200" size="small" />
          </div>
          <div>
            <div class="pb-1 text-[12px] text-[#6b7280]">右下 {{ corners.br }}{{ unit }}</div>
            <el-slider v-model="corners.br" :max="unit === '%' ? 50 : 200" size="small" />
          </div>
          <div>
            <div class="pb-1 text-[12px] text-[#6b7280]">左下 {{ corners.bl }}{{ unit }}</div>
            <el-slider v-model="corners.bl" :max="unit === '%' ? 50 : 200" size="small" />
          </div>

          <div class="flex flex-col gap-2 border-t border-[#f1f3f5] pt-2">
            <div class="flex items-center gap-2 text-[12px] text-[#6b7280]">
              <span class="w-[64px]">填充色</span>
              <el-color-picker v-model="bg" size="small" />
              <span class="w-[64px]">内层色</span>
              <el-color-picker v-model="fill" size="small" />
            </div>
            <div class="flex items-center gap-2 text-[12px] text-[#6b7280]">
              <span class="w-[64px]">边框</span>
              <el-input-number v-model="borderWidth" :min="0" :max="20" size="small" controls-position="right" style="width: 88px" />
              <el-color-picker v-model="borderColor" size="small" />
            </div>
            <div class="flex items-center gap-2 text-[12px] text-[#6b7280]">
              <span class="w-[64px]">预览尺寸</span>
              <el-slider v-model="boxSize" :min="100" :max="320" size="small" />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="preview-area">
            <div :style="previewStyle" class="preview-box">
              <div :style="innerStyle" class="preview-inner">
                <span class="text-[12px] font-medium text-[#2563eb]">border-radius: {{ radiusText }}</span>
              </div>
            </div>
          </div>

          <div class="tool-card">
            <div class="tool-card-head">
              CSS
              <button type="button" class="tool-link-btn ml-auto" @click="copy(cssCode)">复制</button>
            </div>
            <pre class="tool-code">{{ cssCode }}</pre>
          </div>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 简写规则：`a` 四角一致；`a b` 左上右下 / 右上左下；`a b c` 左上 / 右上左下 / 右下；`a b c d` 顺时针。</p>
        <p class="m-0">· 斜杠语法 `10px / 20px` 可做椭圆角（水平半径 / 垂直半径）。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.preview-area {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border-radius: 12px;
  background-color: #fafbfc;
  background-image: linear-gradient(45deg, #f1f3f5 25%, transparent 25%),
    linear-gradient(-45deg, #f1f3f5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f1f3f5 75%),
    linear-gradient(-45deg, transparent 75%, #f1f3f5 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.preview-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78%;
  height: 58%;
}
</style>
