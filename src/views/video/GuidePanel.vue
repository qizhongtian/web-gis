<script setup lang="ts">
import { ref } from 'vue'
import CodePanel, { type CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from './guide-types'

const props = withDefaults(
  defineProps<{
    /** 使用说明里的代码块 */
    blocks: CodeBlock[]
    /** 注意事项条目 */
    notes: NoteItem[]
    /** 面板标题 */
    title?: string
    /** 代码块分组标题 */
    blocksTitle?: string
  }>(),
  {
    title: '集成说明',
    blocksTitle: '集成步骤',
  },
)

const tab = ref<'guide' | 'notes'>('guide')
const openNotes = ref<number[]>([0])

function isOpen(i: number) {
  return openNotes.value.includes(i)
}

function toggle(i: number) {
  openNotes.value = isOpen(i) ? openNotes.value.filter((n) => n !== i) : [...openNotes.value, i]
}

/** 用反引号切分正文，奇数段渲染成行内代码 */
function splitCode(text: string) {
  return text.split('`')
}
</script>

<template>
  <section class="guide-panel">
    <header class="panel-top">
      <i class="dot" />
      <span class="panel-title">{{ props.title }}</span>
      <div class="seg">
        <button type="button" :class="{ on: tab === 'guide' }" @click="tab = 'guide'">使用说明</button>
        <button type="button" :class="{ on: tab === 'notes' }" @click="tab = 'notes'">注意事项</button>
      </div>
    </header>

    <div class="panel-body">
      <CodePanel
        v-show="tab === 'guide'"
        class="guide-code"
        :blocks="props.blocks"
        :title="props.blocksTitle"
        :default-open="[0]"
      />

      <div v-show="tab === 'notes'" class="notes">
        <p class="notes-tip">
          以下为对接大华无插件播放器时的高频问题，按「先能播、再播好、再排错」的顺序整理。
        </p>
        <article v-for="(n, i) in props.notes" :key="n.title" class="note" :class="{ open: isOpen(i) }">
          <header class="note-head" @click="toggle(i)">
            <span class="idx">{{ i + 1 }}</span>
            <span class="note-title">{{ n.title }}</span>
            <svg class="chev" :class="{ open: isOpen(i) }" viewBox="0 0 12 12" width="12" height="12">
              <path
                d="M2.5 4.5 6 8l3.5-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </header>
          <p v-show="isOpen(i)" class="note-body">
            <template v-for="(seg, si) in splitCode(n.body)" :key="si">
              <code v-if="si % 2">{{ seg }}</code>
              <span v-else>{{ seg }}</span>
            </template>
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.guide-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
.panel-top {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.panel-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1f2328;
}
.seg {
  display: flex;
  flex: none;
  padding: 2px;
  border-radius: 7px;
  background: #f1f5f9;
}
.seg button {
  padding: 3px 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.seg button.on {
  background: #fff;
  color: #2563eb;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}
.panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 8px;
}
.guide-code {
  flex: 1;
  min-height: 0;
  border: 0;
  box-shadow: none;
  background: transparent;
}

.notes {
  flex: 1;
  min-height: 0;
  padding: 2px;
  overflow: auto;
}
.notes-tip {
  margin: 0 0 8px;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11.5px;
  line-height: 1.55;
}
.note {
  margin-bottom: 6px;
  border-radius: 9px;
  border: 1px solid #e9eef5;
  background: #fff;
  overflow: hidden;
}
.note.open {
  border-color: #dbe6f5;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.07);
}
.note-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}
.idx {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 600;
}
.note-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.chev {
  flex: none;
  color: #94a3b8;
  transition: transform 0.18s ease;
}
.chev.open {
  transform: rotate(180deg);
}
.note-body {
  margin: 0;
  padding: 0 10px 9px 35px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.62;
}
.note-body code {
  padding: 0 3px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #b45309;
  font-size: 11px;
  word-break: break-all;
}
</style>
