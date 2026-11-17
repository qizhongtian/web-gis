<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, formatBytes, downloadText } from '@/utils/tools/file'

type StoreKey = 'local' | 'session' | 'cookie'

interface Entry {
  key: string
  value: string
  size: number
}

const store = ref<StoreKey>('local')
const entries = ref<Entry[]>([])
const keyword = ref('')
const editKey = ref('')
const editValue = ref('')
const isEdit = ref(false)
const error = ref('')

const byteSize = (text: string) => new TextEncoder().encode(text).length

function readCookies(): Entry[] {
  return document.cookie
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=')
      const key = idx > -1 ? pair.slice(0, idx) : pair
      const raw = idx > -1 ? pair.slice(idx + 1) : ''
      let value = raw
      try {
        value = decodeURIComponent(raw)
      } catch {
        value = raw
      }
      return { key, value, size: byteSize(pair) }
    })
}

function refresh() {
  try {
    if (store.value === 'local') {
      const list: Entry[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!
        const value = localStorage.getItem(key) ?? ''
        list.push({ key, value, size: byteSize(key + value) })
      }
      entries.value = list.sort((a, b) => b.size - a.size)
    } else if (store.value === 'session') {
      const list: Entry[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)!
        const value = sessionStorage.getItem(key) ?? ''
        list.push({ key, value, size: byteSize(key + value) })
      }
      entries.value = list.sort((a, b) => b.size - a.size)
    } else {
      entries.value = readCookies().sort((a, b) => b.size - a.size)
    }
    error.value = ''
  } catch (e) {
    entries.value = []
    error.value = `读取失败：${(e as Error).message}`
  }
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return entries.value
  return entries.value.filter((e) => `${e.key} ${e.value}`.toLowerCase().includes(kw))
})

const totalSize = computed(() => entries.value.reduce((s, e) => s + e.size, 0))

/** localStorage 通常约 5MB，用总量粗略估计占比 */
const quota = computed(() => (store.value === 'cookie' ? 4096 : 5 * 1024 * 1024))
const usagePercent = computed(() => Math.min(100, (totalSize.value / quota.value) * 100))

const asJson = computed(() => {
  const obj: Record<string, string> = {}
  entries.value.forEach((e) => (obj[e.key] = e.value))
  return JSON.stringify(obj, null, 2)
})

function pretty(value: string) {
  const trimmed = value.trim()
  if (!/^[[{]/.test(trimmed)) return value
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return value
  }
}

const preview = (value: string) => (value.length > 160 ? `${value.slice(0, 160)}…` : value)

function save() {
  const key = editKey.value.trim()
  if (!key) {
    error.value = '请填写 key'
    return
  }
  try {
    if (store.value === 'cookie') {
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(editValue.value)}; path=/; max-age=31536000`
    } else {
      const target = store.value === 'local' ? localStorage : sessionStorage
      target.setItem(key, editValue.value)
    }
    ElMessage.success(isEdit.value ? '已更新' : '已写入')
    editKey.value = ''
    editValue.value = ''
    isEdit.value = false
    refresh()
  } catch (e) {
    error.value = `写入失败：${(e as Error).message}（可能超出配额）`
  }
}

function startEdit(entry: Entry) {
  editKey.value = entry.key
  editValue.value = entry.value
  isEdit.value = true
}

function remove(key: string) {
  if (store.value === 'cookie') {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0`
  } else {
    const target = store.value === 'local' ? localStorage : sessionStorage
    target.removeItem(key)
  }
  ElMessage.success('已删除')
  refresh()
}

async function clearAll() {
  try {
    await ElMessageBox.confirm(
      `将清空 ${store.value === 'local' ? 'localStorage' : store.value === 'session' ? 'sessionStorage' : 'Cookie'} 的全部数据，且不可恢复，是否继续？`,
      '确认清空',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  if (store.value === 'cookie') {
    readCookies().forEach((c) => (document.cookie = `${encodeURIComponent(c.key)}=; path=/; max-age=0`))
  } else {
    const target = store.value === 'local' ? localStorage : sessionStorage
    target.clear()
  }
  ElMessage.success('已清空')
  refresh()
}

async function copyAll() {
  if (await copyText(asJson.value)) ElMessage.success('已复制全部数据')
  else ElMessage.error('复制失败')
}

function download() {
  downloadText(asJson.value, `${store.value}-storage.json`, 'application/json;charset=utf-8')
}

function switchStore(value: StoreKey) {
  store.value = value
  refresh()
}

onMounted(refresh)
</script>

<template>
  <ToolPage title="存储管理" desc="查看、编辑、清理 localStorage / sessionStorage / Cookie，并估算占用" wide>
    <template #actions>
      <el-button size="small" @click="refresh">刷新</el-button>
      <el-button size="small" @click="copyAll">复制全部</el-button>
      <el-button size="small" @click="download">导出 JSON</el-button>
      <el-button size="small" type="danger" plain @click="clearAll">清空</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-radio-group :model-value="store" size="small" @update:model-value="switchStore($event as StoreKey)">
          <el-radio-button value="local">localStorage</el-radio-button>
          <el-radio-button value="session">sessionStorage</el-radio-button>
          <el-radio-button value="cookie">Cookie</el-radio-button>
        </el-radio-group>
        <span class="text-[11.5px] text-[#6b7280]">
          {{ entries.length }} 项 · {{ formatBytes(totalSize) }}
        </span>
        <div class="min-w-[120px] max-w-[220px] flex-1">
          <el-progress
            :percentage="Number(usagePercent.toFixed(1))"
            :stroke-width="6"
            :show-text="false"
            :color="usagePercent > 80 ? '#dc2626' : '#2563eb'"
          />
        </div>
        <span class="text-[11px] text-[#9ca3af]">约 {{ usagePercent.toFixed(1) }}% of {{ formatBytes(quota) }}</span>
        <el-input v-model="keyword" size="small" placeholder="搜索 key / value" clearable style="width: 180px" class="ml-auto" />
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div class="min-w-0 overflow-auto rounded-lg border border-[#eef0f3]">
          <table class="tool-table">
            <thead>
              <tr>
                <th style="width: 26%">Key</th>
                <th>Value</th>
                <th style="width: 80px">大小</th>
                <th style="width: 110px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in filtered" :key="entry.key">
                <td class="font-mono text-[11.5px] break-all">{{ entry.key }}</td>
                <td>
                  <pre class="cell">{{ preview(pretty(entry.value)) }}</pre>
                </td>
                <td class="whitespace-nowrap text-[11px] text-[#9ca3af]">{{ formatBytes(entry.size) }}</td>
                <td>
                  <div class="flex gap-0.5">
                    <button type="button" class="tool-link-btn" @click="startEdit(entry)">编辑</button>
                    <button type="button" class="tool-link-btn" @click="copyText(entry.value)">复制</button>
                    <button type="button" class="tool-link-btn !text-[#dc2626]" @click="remove(entry.key)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="4" class="py-8 text-center text-[12px] text-[#9ca3af]">
                  {{ keyword ? '没有匹配的项' : '当前存储为空' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="tool-card flex flex-col gap-2">
          <div class="tool-card-head">
            {{ isEdit ? '编辑条目' : '新增条目' }}
            <el-button v-if="isEdit" size="small" text class="ml-auto" @click="isEdit = false; editKey = ''; editValue = ''">
              取消编辑
            </el-button>
          </div>
          <el-input v-model="editKey" placeholder="key，如 token" :disabled="isEdit && store !== 'cookie'" />
          <textarea v-model="editValue" class="tool-io !min-h-[120px]" placeholder="value，可粘贴 JSON" spellcheck="false" />
          <div class="flex items-center gap-2">
            <el-button size="small" type="primary" @click="save">{{ isEdit ? '保存修改' : '写入' }}</el-button>
            <el-button size="small" @click="editKey = ''; editValue = ''">清空表单</el-button>
          </div>
          <p class="tool-note m-0">
            · Cookie 写入默认 path=/、max-age=1 年，仅作调试演示；HttpOnly 的 Cookie 在此不可见。
          </p>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 表格按体积倒序，方便定位占用最大的缓存项；localStorage 上限通常为 5MB，超出会抛 QuotaExceededError。</p>
        <p class="m-0">· 修改别人的站点数据请先确认影响范围，清空操作不可撤销。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.cell {
  margin: 0;
  max-height: 66px;
  overflow: hidden;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #4b5563;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
