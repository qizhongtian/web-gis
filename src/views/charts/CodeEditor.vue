<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { copyText } from '@/utils/tools/file'
import type { Pair } from '@/utils/charts/model'

const props = defineProps<{ modelValue: string; en: boolean; running: boolean; error: string; notes: Pair[] }>()
const emit = defineEmits<{ 'update:modelValue': [code: string]; run: []; reset: [] }>()
const label = (pair: Pair) => pair[props.en ? 1 : 0]
const autoRun = ref(true)
const editor = ref<HTMLTextAreaElement>()
const gutter = ref<HTMLDivElement>()
const copyStatus = ref<'idle' | 'done' | 'manual'>('idle')
const lineCount = computed(() => props.modelValue.split('\n').length)
let autoTimer = 0
let copyTimer = 0

function run() {
  window.clearTimeout(autoTimer)
  emit('run')
}
function reset() {
  window.clearTimeout(autoTimer)
  emit('reset')
}
function update(value: string) {
  emit('update:modelValue', value)
  if (autoRun.value) {
    window.clearTimeout(autoTimer)
    autoTimer = window.setTimeout(run, 550)
  }
}
watch(autoRun, enabled => { if (!enabled) window.clearTimeout(autoTimer) })

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    run()
  }
}

function syncScroll() {
  if (gutter.value && editor.value) gutter.value.scrollTop = editor.value.scrollTop
}

async function copy() {
  window.clearTimeout(copyTimer)
  if (await copyText(props.modelValue)) {
    copyStatus.value = 'done'
    copyTimer = window.setTimeout(() => { copyStatus.value = 'idle' }, 2000)
  } else if (editor.value) {
    copyStatus.value = 'manual'
    editor.value.focus({ preventScroll: true })
    editor.value.select()
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(autoTimer)
  window.clearTimeout(copyTimer)
})
</script>

<template>
  <section class="editor-panel" aria-labelledby="chart-code-title">
    <header class="editor-header">
      <div class="editor-heading">
        <h2 id="chart-code-title">{{ label(['示例代码', 'Example code']) }}</h2>
        <span>JavaScript</span>
      </div>
      <div class="editor-actions">
        <el-button size="small" @click="copy">{{ label(copyStatus === 'done' ? ['已复制', 'Copied'] : ['复制代码', 'Copy code']) }}</el-button>
        <el-button size="small" @click="reset">{{ label(['还原代码', 'Restore code']) }}</el-button>
        <el-button size="small" type="primary" :disabled="running" @click="run">{{ label(['运行', 'Run']) }}</el-button>
      </div>
    </header>
    <div class="editor-controls">
      <label><input v-model="autoRun" type="checkbox"> {{ label(['实时预览', 'Live preview']) }}</label>
      <span v-if="copyStatus === 'done'" class="copy-ok" role="status">{{ label(['代码已复制到剪贴板', 'Code copied to clipboard']) }}</span>
      <span v-else-if="copyStatus === 'manual'" role="status">{{ label(['已选中代码，请按 Ctrl/Cmd + C 复制', 'Code selected. Press Ctrl/Cmd + C to copy.']) }}</span>
      <kbd v-else>Ctrl / Cmd + Enter</kbd>
    </div>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    <div class="editor-body">
      <div ref="gutter" class="line-gutter" aria-hidden="true"><span v-for="n in lineCount" :key="n">{{ n }}</span></div>
      <textarea
        ref="editor"
        class="code-textarea"
        :aria-label="label(['可编辑的示例代码', 'Editable example code'])"
        :value="modelValue"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        wrap="off"
        @input="update(($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
        @scroll="syncScroll"
      />
    </div>
    <details class="editor-notes" open>
      <summary>{{ label(['常见坑点', 'Common pitfalls']) }}</summary>
      <ul><li v-for="note in notes" :key="note[0]">{{ label(note) }}</li></ul>
      <p>{{ label(['复制的是当前编辑内容。移到项目中使用时，请自行提供容器、图表库和示例数据；页面预览已注入这些参数。', 'Copy includes your edits. In your own project, supply the container, library, and sample data that the preview injects.']) }}</p>
    </details>
  </section>
</template>

<style scoped>
.editor-panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: #fff; border: 1px solid #e0e6ee; border-radius: 8px; color: #1f2937; }
.editor-header, .editor-controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 10px 12px; }
.editor-header { border-bottom: 1px solid #e8edf3; }
.editor-heading, .editor-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.editor-heading h2 { margin: 0; font-size: 14px; }
.editor-heading span { padding: 1px 4px; font: 11px/1.4 Consolas, monospace; color: #526174; }
.editor-actions :deep(.el-button + .el-button) { margin-left: 0; }
.editor-controls { padding-block: 6px; font-size: 12px; color: #526174; }
.editor-controls label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.editor-controls input { accent-color: var(--app-primary, #2563eb); }
kbd { font-size: 11px; }
.copy-ok { color: #08765f; }
.editor-error { margin: 0; max-height: 72px; overflow: auto; padding: 6px 12px; background: #fff4f3; color: #a32921; font-size: 12px; overflow-wrap: anywhere; }
.editor-body { display: flex; flex: 1; min-height: 125px; overflow: hidden; border-block: 1px solid #e8edf3; }
.line-gutter, .code-textarea { font: 12px/21px Consolas, 'Courier New', monospace; padding: 9px 10px; }
.line-gutter { flex: none; min-width: 39px; padding-bottom: 32px; overflow: hidden; text-align: right; background: #f6f8fb; color: #526174; border-right: 1px solid #e8edf3; user-select: none; }
.line-gutter span { display: block; }
.code-textarea { flex: 1; min-height: 0; min-width: 0; resize: none; border: 0; color: #24344a; background: #fff; white-space: pre; overflow: auto; tab-size: 2; }
.code-textarea:focus-visible { outline: 2px solid #91b8fb; outline-offset: -2px; }
.editor-notes { padding: 9px 12px; max-height: 160px; overflow: auto; font-size: 12px; line-height: 1.55; color: #526174; }
.editor-notes summary { color: #79501a; font-weight: 600; cursor: pointer; }
.editor-notes ul { padding-left: 17px; margin: 5px 0; }
.editor-notes p { margin: 3px 0 0; overflow-wrap: anywhere; }
</style>
