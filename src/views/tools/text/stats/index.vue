<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, formatBytes } from '@/utils/tools/file'

const SAMPLE = `Web GIS 把地图带进浏览器。Cesium 负责三维地球，OpenLayers 与 Leaflet 负责二维瓦片与矢量。

前端开发中最常被低估的是细节：一次多余的重排、一个未加防抖的 resize 监听，都会让 60fps 掉到 30fps。`

const text = ref(SAMPLE)

const bytes = computed(() => new TextEncoder().encode(text.value).length)

const stats = computed(() => {
  const raw = text.value
  const lines = raw ? raw.split(/\r\n|\r|\n/) : []
  const nonEmpty = lines.filter((l) => l.trim())
  const paragraphs = raw.split(/\n\s*\n/).filter((p) => p.trim())
  const cjk = (raw.match(/[\u4e00-\u9fa5]/g) || []).length
  const latinWords = (raw.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
  const digits = (raw.match(/\d/g) || []).length
  const punctuation = (raw.match(/[.,;:!?'"()[\]{}<>《》，。；：！？、""'']/g) || []).length
  const spaces = (raw.match(/\s/g) || []).length
  const sentences = (raw.match(/[.!?。！？]+/g) || []).length || (raw.trim() ? 1 : 0)
  // 中文按字计、英文按词计，业界常用的混合估算
  const words = cjk + latinWords
  const readingMinutes = Math.max(1, Math.round(words / 350))

  return [
    { label: '字符数（含空格）', value: raw.length },
    { label: '字符数（不含空格）', value: raw.replace(/\s/g, '').length },
    { label: '中文汉字', value: cjk },
    { label: '英文单词', value: latinWords },
    { label: '数字', value: digits },
    { label: '标点符号', value: punctuation },
    { label: '空白字符', value: spaces },
    { label: '行数 / 非空行', value: `${lines.length} / ${nonEmpty.length}` },
    { label: '段落数', value: paragraphs.length },
    { label: '句子数（估算）', value: sentences },
    { label: '词数（中英混合）', value: words },
    { label: '预计阅读时长', value: `${readingMinutes} 分钟` },
    { label: 'UTF-8 字节', value: formatBytes(bytes.value) },
  ]
})

/** 词频：中文按 2 字组合，英文按单词 */
const topWords = computed(() => {
  const map = new Map<string, number>()
  const add = (word: string) => {
    const key = word.toLowerCase()
    if (key.length < 2) return
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const latin = text.value.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []
  latin.forEach(add)
  const cjkRuns = text.value.match(/[\u4e00-\u9fa5]{2,}/g) || []
  cjkRuns.forEach((run) => {
    for (let i = 0; i < run.length - 1; i++) add(run.slice(i, i + 2))
  })
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }))
})

const maxCount = computed(() => topWords.value[0]?.count || 1)

async function copy(value: string, label: string) {
  if (await copyText(value)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function reportText() {
  return stats.value.map((s) => `${s.label}: ${s.value}`).join('\n')
}

const actions = [
  { label: '去首尾空格', run: () => (text.value = text.value.trim()) },
  { label: '合并连续空行', run: () => (text.value = text.value.replace(/\n{3,}/g, '\n\n')) },
  { label: '全角转半角', run: () => (text.value = text.value.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ')) },
  { label: '删除多余空格', run: () => (text.value = text.value.replace(/[ \t]{2,}/g, ' ')) },
  { label: '清空', run: () => (text.value = '') },
]
</script>

<template>
  <ToolPage title="文本统计" desc="字符 / 词 / 行 / 段落 / 阅读时长 / 字节数，并给出高频词" wide>
    <template #actions>
      <el-button size="small" @click="copy(reportText(), '统计报告')">复制报告</el-button>
      <el-button size="small" @click="text = SAMPLE">填充示例</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <button v-for="a in actions" :key="a.label" type="button" class="tool-chip" @click="a.run()">
          {{ a.label }}
        </button>
      </div>

      <div class="grid flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div class="flex min-h-[220px] flex-col">
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">文本</span>
            <span class="text-[11px] text-[#9ca3af]">{{ formatBytes(bytes) }}</span>
          </div>
          <textarea v-model="text" class="tool-io flex-1" spellcheck="false" placeholder="粘贴或输入文本…" />
        </div>

        <div class="flex flex-col gap-3">
          <div class="tool-card">
            <div class="tool-card-head">统计</div>
            <div v-for="s in stats" :key="s.label" class="tool-kv">
              <span class="tool-kv-label !w-[104px]">{{ s.label }}</span>
              <span class="tool-kv-value text-right text-[#2563eb]">{{ s.value }}</span>
            </div>
          </div>

          <div class="tool-card">
            <div class="tool-card-head">高频词 Top 12</div>
            <p v-if="!topWords.length" class="m-0 py-3 text-[12px] text-[#9ca3af]">文本太短，暂无统计</p>
            <div v-for="w in topWords" :key="w.word" class="flex items-center gap-2 py-1">
              <span class="w-[92px] shrink-0 truncate text-[12px] text-[#374151]" :title="w.word">{{ w.word }}</span>
              <div class="h-[6px] flex-1 overflow-hidden rounded-full bg-[#f1f3f5]">
                <div class="h-full rounded-full bg-[#2563eb]" :style="{ width: (w.count / maxCount) * 100 + '%' }" />
              </div>
              <span class="w-[22px] shrink-0 text-right font-mono text-[11px] text-[#9ca3af]">{{ w.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 词频中文按二元组切分、英文按单词统计，仅用于快速看内容重心，不是严格分词。</p>
        <p class="m-0">· 阅读时长按每分钟 350 词估算（中文约 300~400 字/分钟）。</p>
      </div>
    </section>
  </ToolPage>
</template>
