<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

interface MatchItem {
  index: number
  value: string
  groups: { label: string; value: string }[]
}

const PRESETS = [
  {
    name: '手机号（中国大陆）',
    pattern: '1[3-9]\\d{9}',
    flags: 'g',
    sample: '客服电话 13812345678，备用 15900001111，无效 12345。',
  },
  {
    name: '邮箱地址',
    pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
    flags: 'g',
    sample: '联系 alice@example.com 或 bob.smith@corp.cn 获取资料。',
  },
  {
    name: 'URL 链接',
    pattern: 'https?://[\\w.-]+(?:/[\\w\\-./?%&=#]*)?',
    flags: 'g',
    sample: '访问 https://www.example.com/docs?id=1 查看文档，或 http://test.cn 。',
  },
  {
    name: 'IPv4 地址',
    pattern: '\\b(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)){3}\\b',
    flags: 'g',
    sample: '内网 192.168.1.1 与 10.0.0.255，非法 999.1.1.1。',
  },
  {
    name: '中文字符',
    pattern: '[\\u4e00-\\u9fa5]+',
    flags: 'g',
    sample: 'Hello 世界，Web GIS 在线工具 2026。',
  },
  {
    name: '日期 YYYY-MM-DD',
    pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])',
    flags: 'g',
    sample: '开始日期 2026-11-16，结束日期 2026-12-31。',
  },
  {
    name: 'HTML 标签',
    pattern: '</?([a-z][a-z0-9]*)\\b[^>]*>',
    flags: 'gi',
    sample: '<div class="box"><span>内容</span></div>',
  },
  {
    name: '密码强度（8-20 位含大小写数字）',
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,20}$',
    flags: '',
    sample: 'Abc12345',
  },
  {
    name: '身份证号（18 位）',
    pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
    flags: 'g',
    sample: '身份证 110101199003071234，另一个 44030519881212002X。',
  },
  {
    name: '重复空白行',
    pattern: '^\\s*$\\n?',
    flags: 'gm',
    sample: '第一段\n\n\n\n第二段\n   \n第三段',
  },
]

const pattern = ref('1[3-9]\\d{9}')
const text = ref('客服电话 13812345678，备用 15900001111，无效 12345。\n公司邮箱 service@example.com。')
const replacement = ref('[$&]')
const flags = ref<Record<string, boolean>>({ g: true, i: false, m: false, s: false, u: false, y: false })
const showReplace = ref(false)
const copiedKey = ref('')

const flagList = ['g', 'i', 'm', 's', 'u', 'y'] as const
const flagText = computed(() => flagList.filter((f) => flags.value[f]).join(''))

const compiled = computed<{ re?: RegExp; error?: string }>(() => {
  const p = pattern.value
  if (!p) return { error: '请输入正则表达式' }
  try {
    return { re: new RegExp(p, flagText.value) }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

const matches = computed<MatchItem[]>(() => {
  const re = compiled.value.re
  if (!re) return []
  const list: MatchItem[] = []
  const useGlobal = re.global
  re.lastIndex = 0
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = re.exec(text.value)) && guard++ < 1000) {
    const groups: { label: string; value: string }[] = []
    for (let i = 1; i < m.length; i++) groups.push({ label: `$${i}`, value: m[i] ?? '' })
    if (m.groups) {
      Object.entries(m.groups).forEach(([k, v]) => groups.push({ label: k, value: v ?? '' }))
    }
    list.push({ index: m.index, value: m[0], groups })
    if (!useGlobal) break
    if (m[0] === '') re.lastIndex++
  }
  return list
})

const highlighted = computed(() => {
  const re = compiled.value.re
  const source = text.value
  if (!re || !source) return escapeHtml(source)
  const list = matches.value
  if (!list.length) return escapeHtml(source)
  let html = ''
  let cursor = 0
  for (const m of list) {
    html += escapeHtml(source.slice(cursor, m.index))
    html += `<mark class="rx-mark">${escapeHtml(m.value) || '∅'}</mark>`
    cursor = m.index + m.value.length
  }
  html += escapeHtml(source.slice(cursor))
  return html
})

const replaced = computed(() => {
  if (!showReplace.value) return ''
  const re = compiled.value.re
  if (!re) return ''
  try {
    return text.value.replace(re, replacement.value)
  } catch (e) {
    return `替换失败：${(e as Error).message}`
  }
})

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function applyPreset(p: (typeof PRESETS)[number]) {
  pattern.value = p.pattern
  text.value = p.sample
  flags.value = { g: false, i: false, m: false, s: false, u: false, y: false }
  p.flags.split('').forEach((f) => {
    if (f in flags.value) flags.value[f] = true
  })
}

async function copyContent(content: string, key: string) {
  if (!content) return
  if (await copyText(content)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  } else ElMessage.error('复制失败')
}

async function copyAllMatches() {
  copyContent(matches.value.map((m) => m.value).join('\n'), 'all')
}
</script>

<template>
  <ToolPage title="正则测试" desc="实时匹配、分组提取、高亮预览与替换测试，内置常用正则模板" wide>
    <template #actions>
      <el-button size="small" @click="pattern = ''; text = ''; showReplace = false">清空</el-button>
      <el-button size="small" :type="showReplace ? 'primary' : 'default'" @click="showReplace = !showReplace">
        替换模式
      </el-button>
      <el-button size="small" @click="copyAllMatches">复制全部匹配</el-button>
    </template>

    <section class="app-panel p-3 space-y-3">
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-[280px] flex-1">
          <div class="flex items-center gap-1 pb-1 text-[12px] text-[#6b7280]">
            <span>正则表达式</span>
            <span class="ml-auto font-mono text-[11px] text-[#9ca3af]">/{{ flagText }}</span>
          </div>
          <el-input v-model="pattern" placeholder="输入正则，例如 1[3-9]\d{9}" class="font-mono" clearable>
            <template #prepend>/</template>
          </el-input>
        </div>
        <div class="flex items-center gap-2 pb-1">
          <el-checkbox v-for="f in flagList" :key="f" v-model="flags[f]" size="small" class="!mr-0">
            <span class="font-mono">{{ f }}</span>
          </el-checkbox>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[12px] text-[#6b7280]">常用模板</span>
        <button v-for="p in PRESETS" :key="p.name" type="button" class="preset" @click="applyPreset(p)">
          {{ p.name }}
        </button>
      </div>

      <el-alert v-if="compiled.error" :title="`正则语法错误：${compiled.error}`" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid gap-3 lg:grid-cols-2">
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">测试文本</span>
            <span class="text-[11px] text-[#9ca3af]">{{ text.length }} 字符</span>
          </div>
          <textarea v-model="text" class="io-box" spellcheck="false" placeholder="粘贴待匹配文本…" />
        </div>
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">高亮预览</span>
            <span class="text-[11px] text-[#9ca3af]">{{ matches.length }} 处匹配</span>
          </div>
          <div class="preview-box" v-html="highlighted || '<span class=empty>暂无内容</span>'" />
        </div>
      </div>

      <div v-if="showReplace" class="grid gap-3 lg:grid-cols-2">
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">替换为</span>
            <span class="text-[11px] text-[#9ca3af]">支持 $1 / $& 与命名分组 $&lt;name&gt;</span>
          </div>
          <textarea v-model="replacement" class="io-box short" spellcheck="false" placeholder="$1" />
        </div>
        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[12.5px] font-medium text-[#374151]">替换结果</span>
            <el-button size="small" text class="ml-auto" @click="copyContent(replaced, 'rep')">
              {{ copiedKey === 'rep' ? '已复制' : '复制' }}
            </el-button>
          </div>
          <div class="preview-box">{{ replaced }}</div>
        </div>
      </div>

      <div>
        <div class="flex items-center gap-2 pb-1.5">
          <span class="text-[12.5px] font-medium text-[#374151]">匹配结果</span>
          <span class="text-[11px] text-[#9ca3af]">最多展示 1000 条</span>
          <el-button size="small" text class="ml-auto" @click="copyContent(matches.map((m) => m.value).join('\n'), 'all')">
            {{ copiedKey === 'all' ? '已复制' : '复制全部' }}
          </el-button>
        </div>
        <div class="match-list">
          <div v-if="!matches.length" class="match-empty">暂无匹配</div>
          <div v-for="(m, i) in matches" :key="i" class="match-item">
            <div class="flex items-center gap-2">
              <span class="match-index">#{{ i + 1 }}</span>
              <span class="match-pos">位置 {{ m.index }}</span>
              <code class="match-value">{{ m.value || '空匹配' }}</code>
              <el-button size="small" text class="ml-auto" @click="copyContent(m.value, `m-${i}`)">
                {{ copiedKey === `m-${i}` ? '已复制' : '复制' }}
              </el-button>
            </div>
            <div v-if="m.groups.length" class="mt-1 flex flex-wrap gap-1.5 pl-1">
              <span v-for="g in m.groups" :key="g.label" class="group-chip">
                <b>{{ g.label }}</b>
                <span>{{ g.value || '(空)' }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.io-box {
  display: block;
  width: 100%;
  height: calc(100vh - 500px);
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  outline: none;
  resize: vertical;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.7;
}
.io-box.short {
  height: 90px;
  min-height: 90px;
}
.io-box:focus {
  border-color: #bfd4fb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
  background: #fff;
}
.preview-box {
  height: calc(100vh - 500px);
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  overflow: auto;
  background: #fff;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.preset {
  padding: 2px 8px;
  border: 1px solid #e6e8eb;
  border-radius: 999px;
  background: #fff;
  color: #4b5563;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.preset:hover {
  border-color: #c7d7fb;
  background: #eef4ff;
  color: #2563eb;
}
.match-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
}
.match-item {
  padding: 7px 10px;
  border-bottom: 1px solid #f3f4f6;
}
.match-item:last-child {
  border-bottom: 0;
}
.match-empty {
  padding: 18px;
  text-align: center;
  color: #9ca3af;
  font-size: 12.5px;
}
.match-index {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  color: #9ca3af;
}
.match-pos {
  font-size: 11px;
  color: #b0b7c3;
}
.match-value {
  padding: 1px 6px;
  border-radius: 4px;
  background: #eef4ff;
  color: #1d4ed8;
  font-size: 12px;
  word-break: break-all;
}
.group-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 11px;
}
.group-chip b {
  color: #7c3aed;
  font-weight: 500;
}
</style>

<style>
.rx-mark {
  padding: 1px 2px;
  border-radius: 3px;
  background: #fde68a;
  color: #92400e;
  box-shadow: inset 0 -1px 0 #f59e0b;
}
.preview-box .empty {
  color: #9ca3af;
}
</style>
