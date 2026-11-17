<script lang="ts">
export interface CheatItem {
  name: string
  desc?: string
  code?: string
}

export interface CheatSection {
  title: string
  desc?: string
  items: CheatItem[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/tools/file'

const props = defineProps<{ sections: CheatSection[] }>()

const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.sections
  return props.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        `${item.name} ${item.desc ?? ''} ${item.code ?? ''}`.toLowerCase().includes(kw),
      ),
    }))
    .filter((section) => section.items.length > 0)
})

const total = computed(() => props.sections.reduce((sum, s) => sum + s.items.length, 0))
const matched = computed(() => filtered.value.reduce((sum, s) => sum + s.items.length, 0))

async function copyItem(item: CheatItem) {
  const text = item.code ?? item.name
  if (await copyText(text)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

const anchors = computed(() => props.sections.map((s) => s.title))

function scrollTo(title: string) {
  document.getElementById(`cheat-${title}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="search-row">
      <el-input v-model="keyword" placeholder="搜索 API / 属性 / 命令，如 flex、slice、rebase、409" clearable size="default">
        <template #prefix>
          <span class="text-[12px] text-[#9ca3af]">搜索</span>
        </template>
      </el-input>
      <span class="text-[11.5px] whitespace-nowrap text-[#9ca3af]">{{ matched }} / {{ total }} 条</span>
    </div>

    <div v-if="!keyword" class="flex flex-wrap gap-1.5">
      <button v-for="a in anchors" :key="a" type="button" class="tool-chip" @click="scrollTo(a)">{{ a }}</button>
    </div>

    <section
      v-for="section in filtered"
      :id="`cheat-${section.title}`"
      :key="section.title"
      class="app-panel scroll-mt-3 p-3"
    >
      <header class="mb-2 flex items-baseline gap-2">
        <h3 class="m-0 text-[13.5px] font-semibold text-[#1f2328]">{{ section.title }}</h3>
        <span v-if="section.desc" class="text-[11.5px] text-[#9ca3af]">{{ section.desc }}</span>
        <span class="ml-auto text-[11px] text-[#c0c4cc]">{{ section.items.length }} 条</span>
      </header>

      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="item in section.items" :key="item.name" class="cheat-item">
          <div class="flex items-start gap-2">
            <code class="cheat-name">{{ item.name }}</code>
            <button type="button" class="tool-link-btn ml-auto shrink-0" @click="copyItem(item)">复制</button>
          </div>
          <p v-if="item.desc" class="m-0 mt-1 text-[11.5px] leading-relaxed text-[#6b7280]">{{ item.desc }}</p>
          <pre v-if="item.code" class="cheat-code">{{ item.code }}</pre>
        </div>
      </div>
    </section>

    <div v-if="!filtered.length" class="empty">没有匹配「{{ keyword }}」的条目</div>
  </div>
</template>

<style scoped>
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cheat-item {
  border: 1px solid #eef0f3;
  border-radius: 9px;
  padding: 8px 10px;
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cheat-item:hover {
  border-color: #dbe5fb;
  box-shadow: 0 1px 6px rgba(37, 99, 235, 0.06);
}
.cheat-name {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  background: #f4f8ff;
  border-radius: 4px;
  padding: 1px 6px;
  word-break: break-word;
}
.cheat-code {
  margin: 6px 0 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fafbfc;
  color: #374151;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.empty {
  padding: 40px 0;
  border: 1px dashed #e6e8eb;
  border-radius: 10px;
  color: #9ca3af;
  font-size: 12.5px;
  text-align: center;
}
</style>
