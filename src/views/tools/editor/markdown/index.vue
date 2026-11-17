<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { renderMarkdown } from '@/utils/tools/markdown'
import { copyText, downloadText, readFileAsText } from '@/utils/tools/file'

const SAMPLE = `# Markdown 在线编辑器

一个纯前端的 Markdown 编辑 / 预览工具，支持 **粗体**、*斜体*、~~删除线~~、\`行内代码\` 与 [链接](https://www.markdownguide.org)。

## 功能点

- 左写右看，实时渲染
- 标题 / 列表 / 表格 / 引用 / 代码块
- 一键复制 HTML、导出 .md / .html
- 工具栏快捷插入常用语法

> 提示：预览区支持锚点跳转，点击下方目录即可定位。

### 代码块

\`\`\`ts
const message: string = 'Hello Markdown'
console.log(message)
\`\`\`

### 表格

| 语法 | 说明 | 快捷键 |
| --- | --- | --- |
| **粗体** | 强调内容 | Ctrl + B |
| *斜体* | 弱强调 | Ctrl + I |
| \`code\` | 行内代码 | - |

### 任务列表

- [x] 支持任务列表
- [ ] 支持导出 HTML
- [ ] 更多语法扩展

---

1. 有序列表第一项
2. 有序列表第二项
   - 嵌套无序项
`;

const text = ref(SAMPLE)
const view = ref<'split' | 'edit' | 'preview'>('split')
const editorRef = ref<HTMLTextAreaElement>()
const previewRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const copied = ref('')

const rendered = computed(() => renderMarkdown(text.value))
const lineCount = computed(() => text.value.split('\n').length)

function flash(msg: string, label: string) {
  ElMessage.success(msg)
  copied.value = label
  window.setTimeout(() => (copied.value = ''), 1500)
}

async function copyMd() {
  if (await copyText(text.value)) flash('Markdown 已复制', 'md')
  else ElMessage.error('复制失败，请手动选择文本')
}

async function copyHtml() {
  if (await copyText(rendered.value.html)) flash('HTML 已复制', 'html')
  else ElMessage.error('复制失败，请手动选择文本')
}

function exportMd() {
  downloadText(text.value, 'document.md', 'text/markdown;charset=utf-8')
}

/** 导出带样式的独立 HTML 文件 */
function exportHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Markdown 导出</title>
<style>
  body { max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1f2328;
    font: 15px/1.75 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  h1, h2, h3, h4 { line-height: 1.35; margin: 1.4em 0 0.6em; }
  h1 { font-size: 1.9em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  h2 { font-size: 1.45em; border-bottom: 1px solid #eaecef; padding-bottom: 0.25em; }
  a { color: #2563eb; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 5px; font-size: 0.92em; }
  pre { background: #0b1623; color: #cbd5e1; padding: 14px 16px; border-radius: 10px; overflow: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote { margin: 1em 0; padding: 8px 16px; border-left: 3px solid #d0d7de; color: #57606a; background: #f6f8fa; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #f9fafb; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.6em 0; }
  img { max-width: 100%; }
</style>
</head>
<body>
${rendered.value.html}
</body>
</html>`
  downloadText(html, 'document.html', 'text/html;charset=utf-8')
}

async function importFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    text.value = await readFileAsText(file)
    ElMessage.success(`已导入 ${file.name}`)
  } catch {
    ElMessage.error('文件读取失败')
  }
  ;(e.target as HTMLInputElement).value = ''
}

/** 在光标处包裹 / 插入语法 */
function wrap(before: string, after = '', placeholder = '') {
  const el = editorRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = text.value.slice(start, end) || placeholder
  text.value = text.value.slice(0, start) + before + selected + after + text.value.slice(end)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

/** 行首插入前缀 */
function prefixLine(prefix: string) {
  const el = editorRef.value
  if (!el) return
  const start = el.selectionStart
  const lineStart = text.value.lastIndexOf('\n', start - 1) + 1
  text.value = text.value.slice(0, lineStart) + prefix + text.value.slice(lineStart)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(start + prefix.length, start + prefix.length)
  })
}

function heading(level: number) {
  prefixLine(`${'#'.repeat(level)} `)
}

const tools = [
  { label: 'H1', title: '一级标题', run: () => heading(1) },
  { label: 'H2', title: '二级标题', run: () => heading(2) },
  { label: 'H3', title: '三级标题', run: () => heading(3) },
  { label: 'B', title: '粗体', run: () => wrap('**', '**', '粗体') },
  { label: 'I', title: '斜体', run: () => wrap('*', '*', '斜体') },
  { label: 'S', title: '删除线', run: () => wrap('~~', '~~', '删除线') },
  { label: '</>', title: '行内代码', run: () => wrap('`', '`', 'code') },
  { label: '🔗', title: '链接', run: () => wrap('[', '](https://)', '链接文本') },
  { label: '🖼', title: '图片', run: () => wrap('![', '](https://)', '图片描述') },
  { label: '❝', title: '引用', run: () => prefixLine('> ') },
  { label: '•', title: '无序列表', run: () => prefixLine('- ') },
  { label: '1.', title: '有序列表', run: () => prefixLine('1. ') },
  { label: '☑', title: '任务列表', run: () => prefixLine('- [ ] ') },
  { label: '▦', title: '表格', run: () => wrap('\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n', '', '') },
  { label: '⸻', title: '分割线', run: () => prefixLine('---\n') },
  { label: '```', title: '代码块', run: () => wrap('\n```ts\n', '\n```\n', '// code') },
]

function jumpTo(id: string) {
  const el = previewRef.value?.querySelector(`#${id}`) as HTMLElement | null
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function reset() {
  text.value = SAMPLE
}
</script>

<template>
  <ToolPage
    title="Markdown 编辑器"
    desc="实时预览、语法工具栏、导出 Markdown / HTML，纯前端渲染"
    wide
  >
    <template #actions>
      <el-button size="small" @click="reset">示例</el-button>
      <el-button size="small" @click="fileInputRef?.click()">导入 .md</el-button>
      <el-button size="small" @click="copyMd">{{ copied === 'md' ? '已复制' : '复制 MD' }}</el-button>
      <el-button size="small" type="primary" @click="copyHtml">
        {{ copied === 'html' ? '已复制' : '复制 HTML' }}
      </el-button>
      <el-button size="small" @click="exportMd">导出 .md</el-button>
      <el-button size="small" @click="exportHtml">导出 .html</el-button>
      <input ref="fileInputRef" type="file" accept=".md,.markdown,.txt,text/markdown" class="hidden" @change="importFile" />
    </template>

    <section class="app-panel overflow-hidden flex flex-col flex-1 min-h-0">
      <!-- 工具栏 -->
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[#eef0f3] flex-wrap">
        <button
          v-for="t in tools"
          :key="t.label"
          type="button"
          class="md-tool"
          :title="t.title"
          @click="t.run"
        >
          {{ t.label }}
        </button>
        <span class="mx-2 h-4 w-px bg-[#e6e8eb]" />
        <span class="text-[11.5px] text-[#9ca3af]">支持标准 Markdown 语法</span>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-[11.5px] text-[#9ca3af]">
            {{ rendered.words }} 词 · {{ rendered.chars }} 字符 · {{ lineCount }} 行 · {{ rendered.headings.length }} 个标题
          </span>
          <el-radio-group v-model="view" size="small">
            <el-radio-button value="split">分栏</el-radio-button>
            <el-radio-button value="edit">编辑</el-radio-button>
            <el-radio-button value="preview">预览</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div v-if="rendered.headings.length" class="flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 border-b border-[#f1f3f5] bg-[#fafbfc]">
        <span class="shrink-0 text-[11px] text-[#9ca3af]">目录</span>
        <button
          v-for="h in rendered.headings"
          :key="h.id"
          type="button"
          class="toc-btn"
          :style="{ paddingLeft: `${(h.level - 1) * 8 + 6}px` }"
          @click="jumpTo(h.id)"
        >
          {{ h.text || '未命名标题' }}
        </button>
      </div>

      <div class="grid min-h-0 flex-1" :class="view === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'" style="min-height: 320px">
        <textarea
          v-if="view !== 'preview'"
          ref="editorRef"
          v-model="text"
          class="editor md-editor"
          spellcheck="false"
          placeholder="在此输入 Markdown…"
        />
        <div
          v-if="view !== 'edit'"
          ref="previewRef"
          class="markdown-body overflow-auto px-5 py-4 md:border-l md:border-[#eef0f3]"
          v-html="rendered.html || '<p class=\'empty-tip\'>预览区为空</p>'"
        />
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.md-tool {
  min-width: 28px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.md-tool:hover {
  border-color: #dbe7ff;
  background: #eef4ff;
  color: #2563eb;
}
.editor {
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  border: 0;
  outline: none;
  resize: none;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.75;
  tab-size: 2;
}
.toc-btn {
  flex: none;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #6b7280;
  font-size: 11.5px;
  cursor: pointer;
}
.toc-btn:hover {
  background: #eef4ff;
  color: #2563eb;
}
</style>

<style>
/* 预览区排版（非 scoped，作用于 v-html） */
.markdown-body {
  color: #1f2328;
  font-size: 13.5px;
  line-height: 1.75;
  word-break: break-word;
}
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin: 1.2em 0 0.6em;
  font-weight: 600;
  line-height: 1.35;
  scroll-margin-top: 12px;
}
.markdown-body h1 {
  font-size: 1.7em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #eaecef;
}
.markdown-body h2 {
  font-size: 1.35em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid #eaecef;
}
.markdown-body h3 {
  font-size: 1.15em;
}
.markdown-body p {
  margin: 0.7em 0;
}
.markdown-body a {
  color: #2563eb;
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}
.markdown-body ul,
.markdown-body ol {
  margin: 0.6em 0;
  padding-left: 1.5em;
}
.markdown-body li {
  margin: 0.25em 0;
}
.markdown-body blockquote {
  margin: 0.9em 0;
  padding: 8px 14px;
  border-left: 3px solid #d0d7de;
  border-radius: 0 8px 8px 0;
  background: #f6f8fa;
  color: #57606a;
}
.markdown-body blockquote p {
  margin: 0.3em 0;
}
.markdown-body code {
  padding: 2px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #be185d;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.9em;
}
.markdown-body .md-code {
  margin: 0.9em 0;
  border-radius: 10px;
  overflow: hidden;
  background: #0b1623;
}
.markdown-body .md-code-bar {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #64748b;
  font-size: 10.5px;
  letter-spacing: 0.04em;
}
.markdown-body .md-code pre {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
}
.markdown-body .md-code code {
  padding: 0;
  background: none;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.7;
}
.markdown-body table {
  width: 100%;
  margin: 0.9em 0;
  border-collapse: collapse;
  font-size: 12.5px;
}
.markdown-body th,
.markdown-body td {
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
}
.markdown-body th {
  background: #f9fafb;
  font-weight: 500;
}
.markdown-body .md-table {
  overflow-x: auto;
}
.markdown-body hr {
  margin: 1.4em 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}
.markdown-body img {
  max-width: 100%;
  border-radius: 8px;
}
.markdown-body .md-task {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.markdown-body .empty-tip {
  color: #9ca3af;
  font-size: 12.5px;
}
</style>
