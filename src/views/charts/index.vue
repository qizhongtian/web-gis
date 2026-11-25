<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { chartExamplesByPath, chartItemsByLibrary } from '@/utils/charts/examples'
import { chartNotes } from '@/utils/charts/examples/notes'
import { chartLevelLabels, demoData, libraryMetas, type Pair } from '@/utils/charts/model'
import { mountChartPreview } from '@/utils/charts/runner'
import CodeEditor from './CodeEditor.vue'

const route = useRoute()
const { locale } = useI18n()
const en = computed(() => locale.value.startsWith('en'))
const label = (pair: Pair) => pair[en.value ? 1 : 0]
// Layout 会按 route.path 重建叶子组件；在 setup 中固定本实例的示例，避免离场动画时误跑下一个示例。
const example = chartExamplesByPath.get(route.path) ?? chartItemsByLibrary.echarts[0]
const library = libraryMetas[example.library]
const notes = chartNotes(example)
const code = ref(example.code)
const variant = ref(false)
const running = ref(false)
const error = ref('')
const feedback = ref('')
const stage = ref<HTMLElement>()
let disposeActive: (() => void) | undefined
let disposePending: (() => void) | undefined

function runCode() {
  if (!stage.value) return
  disposePending?.()
  const layer = document.createElement('div')
  layer.className = 'preview-layer is-pending'
  layer.setAttribute('inert', '')
  stage.value.appendChild(layer)
  running.value = true
  error.value = ''
  const dispose = mountChartPreview({
    host: layer,
    library: example.library,
    code: code.value,
    data: demoData(en.value, variant.value),
    en: en.value,
    title: label(example.title),
    onEvent(type, text) {
      if (type === 'feedback') {
        if (disposeActive === remove) feedback.value = text
        return
      }
      if (disposePending !== remove && disposeActive !== remove) return
      running.value = false
      if (type === 'error') {
        error.value = text
        if (disposePending === remove) {
          remove()
          disposePending = undefined
        }
        return
      }
      if (disposePending !== remove) return
      disposeActive?.()
      disposeActive = remove
      disposePending = undefined
      feedback.value = ''
      layer.classList.remove('is-pending')
      layer.removeAttribute('inert')
    },
  })
  const remove = () => { dispose(); layer.remove() }
  disposePending = remove
}

function resetCode() {
  code.value = example.code
  runCode()
}

watch([stage, en, variant], runCode, { flush: 'post' })
onBeforeUnmount(() => { disposePending?.(); disposeActive?.() })
</script>

<template>
  <div class="chart-page">
    <header class="example-header">
      <div>
        <div class="example-meta">
          <span>{{ library.name }} {{ library.version }}</span>
          <span class="level">{{ label(chartLevelLabels[example.level]) }}</span>
        </div>
        <h1>{{ label(example.title) }}</h1>
        <p>{{ label(example.hint) }}</p>
      </div>
      <a :href="library.docUrl" target="_blank" rel="noopener noreferrer">{{ label(['官方文档', 'Official docs']) }} ↗</a>
    </header>

    <div class="example-layout">
      <section class="preview-panel" aria-labelledby="preview-title">
        <header class="preview-toolbar">
          <h2 id="preview-title">{{ label(['图表预览', 'Chart preview']) }}</h2>
          <div class="preview-actions">
            <el-button size="small" @click="variant = !variant">{{ label(variant ? ['切换为数据 A', 'Switch to data A'] : ['切换为数据 B', 'Switch to data B']) }}</el-button>
            <el-button size="small" :disabled="running" @click="runCode">{{ label(['重置视图', 'Reset view']) }}</el-button>
          </div>
        </header>
        <div class="preview-viewport" :aria-busy="running">
          <div ref="stage" class="chart-stage" />
          <p v-if="running" class="preview-message" role="status">{{ label(['正在渲染…', 'Rendering…']) }}</p>
          <p v-else-if="error && !disposeActive" class="preview-message" role="status">{{ label(['预览未生成，请检查右侧报错。', 'No preview. Check the error in the editor.']) }}</p>
        </div>
        <footer class="preview-footer">
          <span>{{ label(['核心 API', 'Key API']) }} <code>{{ example.api }}</code></span>
          <span role="status">{{ feedback || label(variant ? ['示例数据 B', 'Sample data B'] : ['示例数据 A', 'Sample data A']) }}</span>
        </footer>
      </section>

      <CodeEditor v-model="code" :en="en" :running="running" :error="error" :notes="notes" @run="runCode" @reset="resetCode" />
    </div>
  </div>
</template>

<style scoped>
.chart-page { height: 100%; min-height: 0; min-width: 0; padding: clamp(12px, 2vw, 24px); overflow: auto; display: flex; flex-direction: column; gap: 18px; background: #fff; color: #1f2937; container-type: inline-size; }
.example-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 18px; flex-wrap: wrap; }
.example-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #526174; }
.level { color: #2053a6; background: #edf4ff; border: 1px solid #dae8ff; border-radius: 4px; padding: 1px 6px; }
h1 { margin: 5px 0; font-size: clamp(20px, 2vw, 26px); line-height: 1.3; }
.example-header p { margin: 0; font-size: 13px; color: #526174; line-height: 1.55; }
.example-header a { color: var(--app-primary, #2563eb); text-decoration: none; font-size: 13px; }
.example-header a:hover { text-decoration: underline; }
.example-layout { display: grid; flex: 1 0 auto; grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); grid-template-rows: minmax(430px, 1fr); min-height: 430px; gap: 14px; }
.preview-panel { display: flex; flex-direction: column; border: 1px solid #e0e6ee; border-radius: 8px; overflow: hidden; min-width: 0; min-height: 0; background: #fff; }
.preview-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e8edf3; }
.preview-toolbar h2 { margin: 0; font-size: 14px; }
.preview-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.preview-actions :deep(.el-button + .el-button) { margin-left: 0; }
.preview-viewport { flex: 1; position: relative; min-height: 250px; }
.chart-stage, .chart-stage :deep(.preview-layer), .chart-stage :deep(iframe) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.chart-stage :deep(.is-pending) { opacity: 0; pointer-events: none; }
.preview-message { position: absolute; bottom: 8px; left: 8px; margin: 0; padding: 4px 8px; border: 1px solid #e0e6ee; border-radius: 4px; background: #fff; color: #526174; font-size: 12px; pointer-events: none; }
.preview-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 10px; padding: 8px 12px; border-top: 1px solid #e8edf3; font-size: 12px; color: #526174; }
.preview-footer code { color: #2053a6; overflow-wrap: anywhere; }
@container (max-width: 760px) { .example-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: 395px 465px; } }
</style>
