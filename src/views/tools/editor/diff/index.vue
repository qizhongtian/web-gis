<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { diffLines, diffStats, toSideBySide, toUnifiedPatch } from '@/utils/tools/diff'
import { copyText, downloadText, readFileAsText, withExt } from '@/utils/tools/file'

const SAMPLE_A = `import { ref } from 'vue'

interface User {
  id: number
  name: string
  role: string
}

const users = ref<User[]>([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'viewer' },
])

function findUser(id: number) {
  return users.value.find((u) => u.id === id)
}

function addUser(name: string) {
  users.value.push({ id: users.value.length + 1, name, role: 'viewer' })
}

export { users, findUser, addUser }`

const SAMPLE_B = `import { computed, ref } from 'vue'

interface User {
  id: number
  name: string
  role: 'admin' | 'viewer'
  active: boolean
}

const users = ref<User[]>([
  { id: 1, name: 'Alice', role: 'admin', active: true },
  { id: 2, name: 'Bob', role: 'viewer', active: false },
])

function findUser(id: number) {
  return users.value.find((u) => u.id === id)
}

function addUser(name: string) {
  users.value.push({ id: users.value.length + 1, name, role: 'viewer', active: true })
}

const activeUsers = computed(() => users.value.filter((u) => u.active))

export { users, findUser, addUser, activeUsers }`

const left = ref(SAMPLE_A)
const right = ref(SAMPLE_B)
const leftName = ref('a.ts')
const rightName = ref('b.ts')
const mode = ref<'side' | 'unified'>('side')
const onlyDiff = ref(false)
const wrap = ref(true)
const opts = reactive({ ignoreCase: false, ignoreWhitespace: false })
const leftFile = ref<HTMLInputElement>()
const rightFile = ref<HTMLInputElement>()

const ops = computed(() => diffLines(left.value, right.value, { ...opts }))
const stats = computed(() => diffStats(ops.value))
const sideRows = computed(() => toSideBySide(ops.value))

/** 仅显示差异时保留改动前后 2 行上下文 */
function keepContext<T>(list: T[], isChange: (row: T) => boolean, context = 2): T[] {
  const keep = new Set<number>()
  list.forEach((row, i) => {
    if (!isChange(row)) return
    for (let k = Math.max(0, i - context); k <= Math.min(list.length - 1, i + context); k++) keep.add(k)
  })
  return list.filter((_, i) => keep.has(i))
}

const visibleSideRows = computed(() =>
  onlyDiff.value ? keepContext(sideRows.value, (r) => r.kind !== 'equal') : sideRows.value,
)
const visibleOps = computed(() => (onlyDiff.value ? keepContext(ops.value, (o) => o.type !== 'equal') : ops.value))

const identical = computed(() => stats.value.added === 0 && stats.value.removed === 0)
const patch = computed(() => toUnifiedPatch(ops.value, leftName.value, rightName.value))

function swap() {
  const l = left.value
  const ln = leftName.value
  left.value = right.value
  right.value = l
  leftName.value = rightName.value
  rightName.value = ln
}

async function importFile(side: 'left' | 'right', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const content = await readFileAsText(file)
    if (side === 'left') {
      left.value = content
      leftName.value = file.name
    } else {
      right.value = content
      rightName.value = file.name
    }
  } catch {
    ElMessage.error('文件读取失败')
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function copyPatch() {
  if (!patch.value) return ElMessage.info('两份内容没有差异')
  if (await copyText(patch.value)) ElMessage.success('补丁已复制')
  else ElMessage.error('复制失败')
}

function downloadPatch() {
  if (!patch.value) return ElMessage.info('两份内容没有差异')
  downloadText(patch.value, withExt(`${leftName.value}.diff`, 'diff'), 'text/plain;charset=utf-8')
}

function reset() {
  left.value = SAMPLE_A
  right.value = SAMPLE_B
  leftName.value = 'a.ts'
  rightName.value = 'b.ts'
}

function clearAll() {
  left.value = ''
  right.value = ''
}
</script>

<template>
  <ToolPage title="代码比对" desc="逐行比对两份文本，支持忽略大小写 / 空白、并排与统一视图、导出 unified diff" wide>
    <template #actions>
      <el-button size="small" @click="reset">示例</el-button>
      <el-button size="small" @click="swap">交换左右</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-button size="small" @click="copyPatch">复制补丁</el-button>
      <el-button size="small" type="primary" @click="downloadPatch">下载 .diff</el-button>
    </template>

    <div class="grid gap-3 lg:grid-cols-2">
      <section class="app-panel overflow-hidden">
        <div class="flex items-center gap-2 px-3 py-2 border-b border-[#eef0f3]">
          <span class="inline-block h-2 w-2 rounded-full bg-[#f87171]" />
          <span class="text-[12.5px] font-medium text-[#374151] truncate">{{ leftName }}</span>
          <span class="ml-auto text-[11px] text-[#9ca3af]">{{ left.split('\n').length }} 行</span>
          <el-button size="small" text @click="leftFile?.click()">载入文件</el-button>
          <input ref="leftFile" type="file" class="hidden" @change="importFile('left', $event)" />
        </div>
        <textarea v-model="left" class="diff-input" spellcheck="false" placeholder="粘贴原始文本…" />
      </section>

      <section class="app-panel overflow-hidden">
        <div class="flex items-center gap-2 px-3 py-2 border-b border-[#eef0f3]">
          <span class="inline-block h-2 w-2 rounded-full bg-[#34d399]" />
          <span class="text-[12.5px] font-medium text-[#374151] truncate">{{ rightName }}</span>
          <span class="ml-auto text-[11px] text-[#9ca3af]">{{ right.split('\n').length }} 行</span>
          <el-button size="small" text @click="rightFile?.click()">载入文件</el-button>
          <input ref="rightFile" type="file" class="hidden" @change="importFile('right', $event)" />
        </div>
        <textarea v-model="right" class="diff-input" spellcheck="false" placeholder="粘贴对比文本…" />
      </section>
    </div>

    <section class="app-panel overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#eef0f3] bg-[#fafbfc]">
        <el-checkbox v-model="opts.ignoreWhitespace" size="small">忽略空白</el-checkbox>
        <el-checkbox v-model="opts.ignoreCase" size="small">忽略大小写</el-checkbox>
        <el-checkbox v-model="onlyDiff" size="small">仅显示差异</el-checkbox>
        <el-checkbox v-model="wrap" size="small">自动换行</el-checkbox>
        <span class="mx-1 h-4 w-px bg-[#e6e8eb]" />
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="side">并排视图</el-radio-button>
          <el-radio-button value="unified">统一视图</el-radio-button>
        </el-radio-group>
        <div class="ml-auto flex items-center gap-3 text-[11.5px]">
          <span class="text-[#059669]">+{{ stats.added }}</span>
          <span class="text-[#dc2626]">-{{ stats.removed }}</span>
          <span class="text-[#9ca3af]">相同 {{ stats.unchanged }}</span>
        </div>
      </div>

      <div v-if="identical" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div class="text-[28px]">✓</div>
        <p class="mt-2 text-[13px] font-medium text-[#059669]">两份内容完全一致</p>
        <p class="mt-1 text-[12px] text-[#9ca3af]">共 {{ stats.unchanged }} 行</p>
      </div>

      <div v-else class="flex-1 min-h-0 overflow-auto" style="min-height: 240px">
        <!-- 并排视图 -->
        <table v-if="mode === 'side'" class="diff-table" :class="{ 'no-wrap': !wrap }">
          <tbody>
            <tr v-for="(row, i) in visibleSideRows" :key="`s-${i}`" :class="`row-${row.kind}`">
              <td class="ln">{{ row.leftNo ?? '' }}</td>
              <td class="sign">{{ row.kind === 'replace' || row.kind === 'del' ? '-' : '' }}</td>
              <td class="code left-code">{{ row.leftText ?? '' }}</td>
              <td class="divider" />
              <td class="ln">{{ row.rightNo ?? '' }}</td>
              <td class="sign">{{ row.kind === 'replace' || row.kind === 'add' ? '+' : '' }}</td>
              <td class="code right-code">{{ row.rightText ?? '' }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 统一视图 -->
        <table v-else class="diff-table" :class="{ 'no-wrap': !wrap }">
          <tbody>
            <tr v-for="(op, i) in visibleOps" :key="`u-${i}`" :class="`row-${op.type === 'equal' ? 'equal' : op.type}`">
              <td class="ln">{{ op.aNo ?? '' }}</td>
              <td class="ln">{{ op.bNo ?? '' }}</td>
              <td class="sign">{{ op.type === 'add' ? '+' : op.type === 'del' ? '-' : ' ' }}</td>
              <td class="code">{{ op.text }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!identical" class="flex items-center gap-3 px-3 py-1.5 border-t border-[#eef0f3] text-[11px] text-[#9ca3af]">
        <span>左：{{ leftName }}</span>
        <span>右：{{ rightName }}</span>
        <span class="ml-auto">补丁预览：{{ patch ? patch.split('\n').length : 0 }} 行</span>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.diff-input {
  display: block;
  width: 100%;
  height: 170px;
  padding: 10px 12px;
  border: 0;
  outline: none;
  resize: vertical;
  background: #fcfcfd;
  color: #1f2328;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.65;
  tab-size: 2;
}
.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  table-layout: fixed;
}
.diff-table td {
  padding: 0 8px;
  vertical-align: top;
}
.diff-table .ln {
  width: 44px;
  text-align: right;
  color: #b0b7c3;
  background: #fafbfc;
  user-select: none;
  border-right: 1px solid #f1f3f5;
}
.diff-table .sign {
  width: 16px;
  text-align: center;
  color: #9ca3af;
  user-select: none;
}
.diff-table .divider {
  width: 1px;
  padding: 0;
  background: #e6e8eb;
}
.diff-table .code {
  white-space: pre-wrap;
  word-break: break-all;
  color: #1f2328;
}
.diff-table.no-wrap .code {
  white-space: pre;
  word-break: normal;
}
.row-equal .code {
  color: #4b5563;
}
.row-add td {
  background: #eafaf1;
}
.row-add .code {
  background: #eafaf1;
}
.row-del td {
  background: #fdeeee;
}
.row-del .code {
  background: #fdeeee;
}
.row-replace td.left-code,
.row-replace td:nth-child(-n + 3) {
  background: #fdeeee;
}
.row-replace td.right-code,
.row-replace td:nth-child(n + 5) {
  background: #eafaf1;
}
.row-replace .divider {
  background: #e6e8eb;
}
</style>
