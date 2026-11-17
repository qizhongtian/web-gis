<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText, downloadText } from '@/utils/tools/file'

type FieldKey =
  | 'id'
  | 'name'
  | 'phone'
  | 'email'
  | 'city'
  | 'address'
  | 'company'
  | 'job'
  | 'ip'
  | 'url'
  | 'uuid'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'

interface FieldDef {
  key: FieldKey
  label: string
  gen: (i: number) => string | number | boolean
}

const SURNAME = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许'
const GIVEN = '伟芳娜秀英敏静丽强磊洋艳勇军杰涛明超霞平刚桂兰'
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆']
const DISTRICTS = ['高新区', '开发区', '西湖区', '朝阳区', '江北区', '天府新区', '碑林区', '滨江区']
const STREETS = ['科技路', '建设大道', '人民路', '解放路', '文一西路', '天府大道', '中山路', '创业大街']
const COMPANIES = ['云图科技', '星河数据', '蓝海信息', '中科空间', '智联网络', '天穹软件', '辰光智能']
const JOBS = ['前端工程师', 'GIS 开发', '产品经理', 'UI 设计师', '数据分析师', '测试工程师', '架构师']
const TLDS = ['com', 'cn', 'net', 'io', 'dev']

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pad = (n: number, len = 2) => String(n).padStart(len, '0')

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function randomName() {
  const len = Math.random() > 0.4 ? 2 : 1
  let given = ''
  for (let i = 0; i < len; i++) given += pick(GIVEN.split(''))
  return pick(SURNAME.split('')) + given
}

const defs: FieldDef[] = [
  { key: 'id', label: 'ID', gen: (i) => i + 1 },
  { key: 'name', label: '姓名', gen: () => randomName() },
  { key: 'phone', label: '手机号', gen: () => `1${pick(['3', '5', '7', '8', '9'])}${pad(rand(0, 999999999), 9)}`.slice(0, 11) },
  { key: 'email', label: '邮箱', gen: () => `user${rand(100, 999)}@${pick(['example', 'test', 'mail'])}.${pick(TLDS)}` },
  { key: 'city', label: '城市', gen: () => pick(CITIES) },
  { key: 'address', label: '地址', gen: () => `${pick(CITIES)}市${pick(DISTRICTS)}${pick(STREETS)}${rand(1, 200)}号` },
  { key: 'company', label: '公司', gen: () => pick(COMPANIES) },
  { key: 'job', label: '职位', gen: () => pick(JOBS) },
  { key: 'ip', label: 'IP', gen: () => `${rand(1, 223)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}` },
  { key: 'url', label: '网址', gen: () => `https://${pick(['map', 'demo', 'docs', 'api'])}.${pick(TLDS)}/${pick(['v1', 'home', 'list', 'detail'])}` },
  { key: 'uuid', label: 'UUID', gen: () => uuid() },
  { key: 'number', label: '数字', gen: () => rand(1, 10000) },
  { key: 'bool', label: '布尔', gen: () => Math.random() > 0.5 },
  {
    key: 'date',
    label: '日期',
    gen: () => `${rand(2023, 2026)}-${pad(rand(1, 12))}-${pad(rand(1, 28))}`,
  },
  {
    key: 'datetime',
    label: '日期时间',
    gen: () =>
      `${rand(2023, 2026)}-${pad(rand(1, 12))}-${pad(rand(1, 28))} ${pad(rand(0, 23))}:${pad(rand(0, 59))}:${pad(rand(0, 59))}`,
  },
]

const enabled = ref<FieldKey[]>(['id', 'name', 'phone', 'email', 'city'])
const count = ref(10)
const format = ref<'json' | 'csv' | 'sql' | 'ts'>('json')
const tableName = ref('user_info')

const activeDefs = computed(() => defs.filter((d) => enabled.value.includes(d.key)))

/** 手动刷新用的版本号 */
const nonce = ref(0)

const rows = computed<Record<string, string | number | boolean>[]>(() => {
  void nonce.value
  const n = Math.max(1, Math.min(500, Number(count.value) || 1))
  const list = activeDefs.value
  return Array.from({ length: n }, (_, i) => {
    const row: Record<string, string | number | boolean> = {}
    list.forEach((d) => (row[d.key] = d.gen(i)))
    return row
  })
})

const output = computed(() => {
  const list = activeDefs.value
  if (!list.length) return '请至少选择一个字段'
  const data = rows.value
  if (format.value === 'json') return JSON.stringify(data, null, 2)
  if (format.value === 'csv') {
    const head = list.map((d) => d.key).join(',')
    const body = data
      .map((row) =>
        list
          .map((d) => {
            const v = String(row[d.key])
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
          })
          .join(','),
      )
      .join('\n')
    return `${head}\n${body}`
  }
  if (format.value === 'sql') {
    const cols = list.map((d) => d.key).join(', ')
    const values = data
      .map(
        (row) =>
          `(${list
            .map((d) => {
              const v = row[d.key]
              return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : `'${String(v).replace(/'/g, "''")}'`
            })
            .join(', ')})`,
      )
      .join(',\n')
    return `INSERT INTO ${tableName.value} (${cols}) VALUES\n${values};`
  }
  // TS 接口：按值的类型推断
  const sample = data[0]
  const lines = list.map((d) => {
    const v = sample[d.key]
    const type = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string'
    return `  ${d.key}: ${type}`
  })
  return `export interface ${toPascal(tableName.value)} {\n${lines.join('\n')}\n}`
})

function toPascal(raw: string) {
  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

function toggle(key: FieldKey) {
  const idx = enabled.value.indexOf(key)
  if (idx > -1) enabled.value.splice(idx, 1)
  else enabled.value.push(key)
}

function selectAll() {
  enabled.value = defs.map((d) => d.key)
}

function clearAll() {
  enabled.value = []
}

async function copy() {
  if (await copyText(output.value)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

function download() {
  const ext = format.value === 'json' ? 'json' : format.value === 'csv' ? 'csv' : format.value === 'sql' ? 'sql' : 'ts'
  downloadText(output.value, `mock-data.${ext}`)
}

function regenerate() {
  nonce.value += 1
  ElMessage.success('已重新生成')
}
</script>

<template>
  <ToolPage title="假数据生成" desc="按字段生成姓名 / 手机 / 邮箱 / 地址等测试数据，可导出 JSON / CSV / SQL / TS" wide>
    <template #actions>
      <el-button size="small" @click="regenerate">重新生成</el-button>
      <el-button size="small" @click="copy">复制</el-button>
      <el-button size="small" @click="download">下载</el-button>
    </template>

    <section class="app-panel flex flex-1 flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[12px] text-[#6b7280]">字段</span>
        <button
          v-for="d in defs"
          :key="d.key"
          type="button"
          class="field-chip"
          :class="{ 'is-on': enabled.includes(d.key) }"
          @click="toggle(d.key)"
        >
          {{ d.label }}
        </button>
        <div class="ml-auto flex items-center gap-2">
          <el-button size="small" text @click="selectAll">全选</el-button>
          <el-button size="small" text @click="clearAll">清空</el-button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[12px] text-[#6b7280]">条数</span>
        <el-input-number v-model="count" :min="1" :max="500" size="small" controls-position="right" style="width: 96px" />
        <span class="text-[12px] text-[#6b7280]">格式</span>
        <el-radio-group v-model="format" size="small">
          <el-radio-button value="json">JSON</el-radio-button>
          <el-radio-button value="csv">CSV</el-radio-button>
          <el-radio-button value="sql">SQL</el-radio-button>
          <el-radio-button value="ts">TS 接口</el-radio-button>
        </el-radio-group>
        <template v-if="format === 'sql' || format === 'ts'">
          <span class="text-[12px] text-[#6b7280]">表名</span>
          <el-input v-model="tableName" size="small" style="width: 140px" />
        </template>
        <span class="ml-auto text-[11px] text-[#9ca3af]">{{ activeDefs.length }} 个字段 · {{ rows.length }} 条</span>
      </div>

      <div class="flex-1 min-h-[280px]">
        <pre class="tool-code gen-output">{{ output }}</pre>
      </div>

      <div class="tool-note">
        <p class="m-0">· 数据全部在浏览器内随机生成，可放心用于表单联调、表格分页、接口 Mock。</p>
        <p class="m-0">· SQL 输出为 INSERT 语句，TS 输出会按首行值推断类型，实际使用可再补可空与联合类型。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.field-chip {
  padding: 3px 10px;
  border: 1px solid #e6e8eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.field-chip:hover {
  border-color: #c7d7fb;
  color: #2563eb;
}
.field-chip.is-on {
  border-color: #bfd4fb;
  background: #eef4ff;
  color: #2563eb;
  font-weight: 500;
}
.gen-output {
  max-height: none;
  height: 100%;
  overflow: auto;
  font-size: 12px;
}
</style>
