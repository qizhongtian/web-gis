<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText, readFileAsDataUrl } from '@/utils/tools/file'

const SAMPLE = `<h2>富文本编辑器</h2>
<p>这是一个基于 <strong>contenteditable</strong> 与 <code>document.execCommand</code> 的轻量富文本编辑器，可直接复制带格式内容粘贴到 Word、邮件或后台系统。</p>
<ul>
  <li>支持<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<s>删除线</s></li>
  <li>标题、引用、代码块、有序 / 无序列表</li>
  <li>文字颜色、背景色、对齐、链接、图片、分割线</li>
  <li>可切换 HTML 源码，方便二次加工</li>
</ul>
<blockquote>提示：工具栏按钮作用于当前选区；未选中内容时切换格式，对随后输入的文字生效。</blockquote>
<p>常用快捷键：Ctrl + B 加粗，Ctrl + I 斜体，Ctrl + U 下划线。</p>`

const editorRef = ref<HTMLElement>()
const fileRef = ref<HTMLInputElement>()
const fileRefUpload = ref<HTMLInputElement>()
const stats = ref({ text: 0, words: 0, images: 0 })
const copyLabel = ref('')
const mode = ref<'visual' | 'code'>('visual')
const source = ref('')
const activeMarks = ref<Record<string, boolean>>({})

const html = ref(SAMPLE)

/** 中文按字、英文按词 */
function countWords(text: string) {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const latin = (text.match(/[A-Za-z0-9_'-]+/g) || []).length
  return cjk + latin
}

function sync() {
  const el = editorRef.value
  if (!el) return
  html.value = el.innerHTML
  const text = el.innerText || ''
  stats.value = {
    text: text.replace(/\s/g, '').length,
    words: countWords(text),
    images: el.querySelectorAll('img').length,
  }
  refreshActive()
}

/** 读取当前选区已应用的格式，用于按钮高亮 */
function refreshActive() {
  const marks: Record<string, boolean> = {}
  for (const cmd of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']) {
    try {
      marks[cmd] = document.queryCommandState(cmd)
    } catch {
      marks[cmd] = false
    }
  }
  for (const tag of ['h1', 'h2', 'h3', 'blockquote', 'pre']) {
    try {
      marks[tag] = document.queryCommandValue('formatBlock').toLowerCase() === (tag === 'pre' ? 'pre' : tag)
    } catch {
      marks[tag] = false
    }
  }
  activeMarks.value = marks
}

function exec(cmd: string, value?: string) {
  const el = editorRef.value
  if (!el) return
  el.focus()
  document.execCommand(cmd, false, value)
  sync()
}

function formatBlock(tag: string) {
  const current = activeMarks.value[tag]
  exec('formatBlock', current ? 'p' : tag)
}

async function insertLink() {
  const el = editorRef.value
  if (!el) return
  el.focus()
  const selected = window.getSelection()?.toString() || ''
  try {
    const { value } = await ElMessageBox.prompt('请输入链接地址', '插入链接', {
      inputValue: 'https://',
      confirmButtonText: '插入',
      cancelButtonText: '取消',
    })
    if (!value) return
    if (selected) document.execCommand('createLink', false, value)
    else document.execCommand('insertHTML', false, `<a href="${value}" target="_blank" rel="noopener">${value}</a>`)
    sync()
  } catch {
    // 取消
  }
}

function insertImageByUrl() {
  ElMessageBox.prompt('请输入图片地址（支持 http(s) 或 data:image）', '插入网络图片', {
    inputValue: 'https://',
    confirmButtonText: '插入',
    cancelButtonText: '取消',
  })
    .then(({ value }) => {
      if (!value) return
      editorRef.value?.focus()
      document.execCommand('insertImage', false, value)
      sync()
    })
    .catch(() => undefined)
}

async function insertImageFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  const dataUrl = await readFileAsDataUrl(file)
  editorRef.value?.focus()
  document.execCommand('insertImage', false, dataUrl)
  sync()
  ;(e.target as HTMLInputElement).value = ''
}

function setColor(cmd: 'foreColor' | 'hiliteColor', color: string | null) {
  if (!color) return
  exec(cmd, color)
}

function switchMode() {
  if (mode.value === 'visual') {
    source.value = editorRef.value?.innerHTML || html.value
    mode.value = 'code'
  } else {
    if (editorRef.value) editorRef.value.innerHTML = source.value
    mode.value = 'visual'
    nextTick(sync)
  }
}

function applySource() {
  if (editorRef.value) editorRef.value.innerHTML = source.value
  html.value = source.value
  mode.value = 'visual'
  nextTick(sync)
}

async function copyHtml() {
  if (await copyText(html.value)) {
    ElMessage.success('HTML 已复制到剪贴板')
    copyLabel.value = '已复制'
    window.setTimeout(() => (copyLabel.value = ''), 1500)
  } else {
    ElMessage.error('复制失败')
  }
}

function exportHtml() {
  const doc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8" /><title>富文本导出</title>
<style>body{max-width:820px;margin:40px auto;padding:0 20px;font:15px/1.8 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2328}
img{max-width:100%}blockquote{margin:1em 0;padding:8px 16px;border-left:3px solid #d0d7de;background:#f6f8fa;color:#57606a}
pre{background:#0b1623;color:#cbd5e1;padding:12px 16px;border-radius:10px;overflow:auto}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style>
</head><body>${html.value}</body></html>`
  downloadText(doc, 'richtext.html', 'text/html;charset=utf-8')
}

function importHtml(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result ?? '')
    if (editorRef.value) editorRef.value.innerHTML = content
    sync()
    ElMessage.success('已导入 HTML 内容')
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}

function reset() {
  if (!editorRef.value) return
  editorRef.value.innerHTML = SAMPLE
  sync()
}

function clearAll() {
  ElMessageBox.confirm('确定清空编辑器内容？', '提示', { type: 'warning' })
    .then(() => {
      if (editorRef.value) editorRef.value.innerHTML = ''
      sync()
    })
    .catch(() => undefined)
}

/** 粘贴时统一转为纯文本，避免带入外部样式 */
function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text/plain')
  if (text == null) return
  e.preventDefault()
  document.execCommand('insertText', false, text)
  sync()
}

onMounted(() => {
  if (editorRef.value) editorRef.value.innerHTML = SAMPLE
  sync()
})

const toolbar = computed(() => [
  { key: 'undo', label: '↶', title: '撤销', run: () => exec('undo') },
  { key: 'redo', label: '↷', title: '重做', run: () => exec('redo') },
])
</script>

<template>
  <ToolPage title="富文本编辑器" desc="所见即所得编辑，支持标题、列表、颜色、链接、图片与 HTML 源码切换" wide>
    <template #actions>
      <el-button size="small" @click="reset">示例</el-button>
      <el-button size="small" @click="fileRef?.click()">导入 HTML</el-button>
      <el-button size="small" @click="copyHtml">{{ copyLabel || '复制 HTML' }}</el-button>
      <el-button size="small" type="primary" @click="exportHtml">导出 HTML</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <input ref="fileRef" type="file" accept=".html,.htm,text/html" class="hidden" @change="importHtml" />
    </template>

    <section class="app-panel overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[#eef0f3]">
        <template v-if="mode === 'visual'">
          <button v-for="t in toolbar" :key="t.key" type="button" class="rt-tool" :title="t.title" @click="t.run">
            {{ t.label }}
          </button>
          <span class="rt-sep" />

          <button
            v-for="b in [
              { key: 'bold', label: 'B', title: '加粗', style: { fontWeight: 700 } },
              { key: 'italic', label: 'I', title: '斜体', style: { fontStyle: 'italic' } },
              { key: 'underline', label: 'U', title: '下划线', style: { textDecoration: 'underline' } },
              { key: 'strikeThrough', label: 'S', title: '删除线', style: { textDecoration: 'line-through' } },
            ]"
            :key="b.key"
            type="button"
            class="rt-tool"
            :class="{ active: activeMarks[b.key] }"
            :title="b.title"
            :style="b.style"
            @click="exec(b.key)"
          >
            {{ b.label }}
          </button>
          <span class="rt-sep" />

          <button
            v-for="h in [
              { tag: 'h1', label: 'H1' },
              { tag: 'h2', label: 'H2' },
              { tag: 'h3', label: 'H3' },
            ]"
            :key="h.tag"
            type="button"
            class="rt-tool"
            :class="{ active: activeMarks[h.tag] }"
            @click="formatBlock(h.tag)"
          >
            {{ h.label }}
          </button>
          <button type="button" class="rt-tool" :class="{ active: activeMarks.blockquote }" @click="formatBlock('blockquote')">引用</button>
          <button type="button" class="rt-tool" :class="{ active: activeMarks.pre }" @click="formatBlock('pre')">代码块</button>
          <span class="rt-sep" />

          <button type="button" class="rt-tool" :class="{ active: activeMarks.insertUnorderedList }" @click="exec('insertUnorderedList')">• 列表</button>
          <button type="button" class="rt-tool" :class="{ active: activeMarks.insertOrderedList }" @click="exec('insertOrderedList')">1. 列表</button>
          <span class="rt-sep" />

          <button type="button" class="rt-tool" title="左对齐" @click="exec('justifyLeft')">⬅</button>
          <button type="button" class="rt-tool" title="居中" @click="exec('justifyCenter')">↔</button>
          <button type="button" class="rt-tool" title="右对齐" @click="exec('justifyRight')">➡</button>
          <span class="rt-sep" />

          <el-color-picker
            size="small"
            :predefine="['#111827', '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#6b7280']"
            title="文字颜色"
            @change="(c: string | null) => setColor('foreColor', c)"
          >
            <template #default>
              <button type="button" class="rt-tool" title="文字颜色">A<span class="rt-color-bar" style="background: #dc2626" /></button>
            </template>
          </el-color-picker>
          <el-color-picker
            size="small"
            :predefine="['#fef2f2', '#eef4ff', '#ecfdf5', '#fffbeb', '#f5f3ff', '#fce7f3', '#f3f4f6', '#fde68a']"
            title="背景颜色"
            @change="(c: string | null) => setColor('hiliteColor', c)"
          >
            <template #default>
              <button type="button" class="rt-tool" title="背景颜色">
                <span class="rt-highlight">A</span>
              </button>
            </template>
          </el-color-picker>
          <span class="rt-sep" />

          <button type="button" class="rt-tool" title="插入链接" @click="insertLink">🔗</button>
          <button type="button" class="rt-tool" title="插入网络图片" @click="insertImageByUrl">🖼</button>
          <button type="button" class="rt-tool" title="上传本地图片" @click="fileRefUpload?.click()">上传图</button>
          <input ref="fileRefUpload" type="file" accept="image/*" class="hidden" @change="insertImageFile" />
          <button type="button" class="rt-tool" title="分割线" @click="exec('insertHorizontalRule')">─</button>
          <button type="button" class="rt-tool" title="清除格式" @click="exec('removeFormat')">清除格式</button>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-[11.5px] text-[#9ca3af]">
            {{ stats.words }} 词 · {{ stats.text }} 字符<span v-if="stats.images"> · {{ stats.images }} 张图片</span>
          </span>
          <el-button size="small" :type="mode === 'code' ? 'primary' : 'default'" @click="switchMode">
            {{ mode === 'visual' ? 'HTML 源码' : '返回编辑' }}
          </el-button>
        </div>
      </div>

      <div v-if="mode === 'code'" class="flex flex-col flex-1 min-h-0" style="min-height: 320px">
        <textarea v-model="source" class="rt-source" spellcheck="false" />
        <div class="flex items-center gap-2 px-3 py-2 border-t border-[#eef0f3] bg-[#fafbfc]">
          <span class="text-[11.5px] text-[#9ca3af]">直接编辑 HTML，应用后回到可视化模式</span>
          <el-button class="ml-auto" size="small" type="primary" @click="applySource">应用源码</el-button>
        </div>
      </div>

      <div
        v-else
        ref="editorRef"
        class="rt-body overflow-auto px-5 py-4 flex-1 min-h-0"
        style="min-height: 320px"
        contenteditable="true"
        spellcheck="false"
        @input="sync"
        @keyup="refreshActive"
        @mouseup="refreshActive"
        @paste="onPaste"
      />
    </section>
  </ToolPage>
</template>

<style scoped>
.rt-tool {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.rt-tool:hover {
  border-color: #dbe7ff;
  background: #eef4ff;
  color: #2563eb;
}
.rt-tool.active {
  border-color: #c7d7fb;
  background: #eef4ff;
  color: #2563eb;
}
.rt-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: #e6e8eb;
}
.rt-color-bar {
  width: 12px;
  height: 3px;
  border-radius: 2px;
}
.rt-highlight {
  padding: 0 2px;
  border-radius: 3px;
  background: #fde68a;
}
.rt-source {
  flex: 1;
  min-height: 0;
  padding: 14px 16px;
  border: 0;
  outline: none;
  resize: none;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
}
</style>

<style>
/* 编辑区排版（contenteditable 内容非 scoped） */
.rt-body {
  color: #1f2328;
  font-size: 14px;
  line-height: 1.8;
  outline: none;
}
.rt-body:empty::before {
  content: '在此输入内容…';
  color: #9ca3af;
  font-size: 13px;
}
.rt-body h1 {
  margin: 0.7em 0 0.4em;
  font-size: 1.7em;
  font-weight: 600;
}
.rt-body h2 {
  margin: 0.7em 0 0.4em;
  font-size: 1.35em;
  font-weight: 600;
}
.rt-body h3 {
  margin: 0.6em 0 0.35em;
  font-size: 1.15em;
  font-weight: 600;
}
.rt-body p {
  margin: 0.6em 0;
}
.rt-body blockquote {
  margin: 0.8em 0;
  padding: 8px 14px;
  border-left: 3px solid #d0d7de;
  border-radius: 0 8px 8px 0;
  background: #f6f8fa;
  color: #57606a;
}
.rt-body pre {
  margin: 0.8em 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0b1623;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  overflow: auto;
  white-space: pre-wrap;
}
.rt-body code {
  padding: 2px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #be185d;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.9em;
}
.rt-body pre code {
  padding: 0;
  background: none;
  color: inherit;
}
.rt-body img {
  max-width: 100%;
  border-radius: 8px;
}
.rt-body ul,
.rt-body ol {
  margin: 0.6em 0;
  padding-left: 1.6em;
}
.rt-body a {
  color: #2563eb;
}
.rt-body hr {
  margin: 1.2em 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}
</style>
