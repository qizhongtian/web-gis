<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

/** 允许 2 ~ 36 进制，字符集 0-9a-z */
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

const input = ref('255')
const fromBase = ref(10)
const bits = ref(32)

const bases = [
  { value: 2, label: '二进制 (2)' },
  { value: 8, label: '八进制 (8)' },
  { value: 10, label: '十进制 (10)' },
  { value: 16, label: '十六进制 (16)' },
  { value: 32, label: '32 进制 (32)' },
  { value: 36, label: '36 进制 (36)' },
]

const error = ref('')

/** 统一转成 BigInt：整数精确，小数退化为 Number 近似 */
const parsed = computed<{ big: bigint; negative: boolean; isInt: boolean } | null>(() => {
  error.value = ''
  const raw = input.value.trim().replace(/[\s_]/g, '')
  if (!raw) return null
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  const base = fromBase.value
  if (base < 2 || base > 36) {
    error.value = '进制需在 2 ~ 36 之间'
    return null
  }

  const dot = body.indexOf('.')
  if (dot > -1) {
    const intPart = body.slice(0, dot) || '0'
    const fracPart = body.slice(dot + 1)
    const intValue = parseIntSafe(intPart, base)
    if (intValue === null) return null
    let frac = 0
    for (let i = 0; i < fracPart.length; i++) {
      const d = DIGITS.indexOf(fracPart[i].toLowerCase())
      if (d < 0 || d >= base) {
        error.value = `字符「${fracPart[i]}」不属于 ${base} 进制`
        return null
      }
      frac += d / Math.pow(base, i + 1)
    }
    return { big: intValue, negative, isInt: false }
  }

  const big = parseIntSafe(body, base)
  if (big === null) return null
  return { big, negative, isInt: true }
})

// 构建目标是 es2015，不能出现 BigInt 字面量（0n / 1n），统一用 BigInt() 构造
const ZERO = BigInt(0)
const ONE = BigInt(1)

function parseIntSafe(text: string, base: number): bigint | null {
  if (!text) return null
  let value = ZERO
  const b = BigInt(base)
  for (const ch of text.toLowerCase()) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) {
      error.value = `字符「${ch}」不属于 ${base} 进制`
      return null
    }
    value = value * b + BigInt(d)
  }
  return value
}

function toBase(value: bigint, base: number): string {
  if (value === ZERO) return '0'
  let v = value
  const b = BigInt(base)
  let out = ''
  while (v > ZERO) {
    out = DIGITS[Number(v % b)] + out
    v /= b
  }
  return out
}

/** 位视图：按所选位宽展示补码 */
const bitView = computed(() => {
  const p = parsed.value
  if (!p || !p.isInt) return ''
  const width = BigInt(bits.value)
  const mod = ONE << width
  let v = p.big % mod
  if (p.negative) v = (mod - v) % mod
  const bin = v.toString(2).padStart(bits.value, '0')
  return bin.replace(/(.{4})(?=.)/g, '$1 ')
})

const results = computed(() => {
  const p = parsed.value
  if (!p) return []
  const sign = p.negative ? '-' : ''
  const list = [
    { label: '二进制', base: 2, value: sign + toBase(p.big, 2) },
    { label: '八进制', base: 8, value: sign + toBase(p.big, 8) },
    { label: '十进制', base: 10, value: sign + toBase(p.big, 10) },
    { label: '十六进制', base: 16, value: sign + toBase(p.big, 16) },
    { label: '32 进制', base: 32, value: sign + toBase(p.big, 32) },
    { label: '36 进制', base: 36, value: sign + toBase(p.big, 36) },
  ]
  return list
})

const decimalInfo = computed(() => {
  const p = parsed.value
  if (!p || !p.isInt) return []
  const v = p.negative ? -p.big : p.big
  return [
    { label: '十进制值', value: v.toString() },
    { label: '位数（二进制）', value: (p.big === ZERO ? 1 : p.big.toString(2).length).toString() },
    { label: '是否安全整数', value: v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? '是' : '否（超出 2^53）' },
    { label: 'Number 表示', value: Number(v).toString() },
  ]
})

async function copy(value: string, label: string) {
  if (await copyText(value)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function setInput(value: string, base: number) {
  input.value = value
  fromBase.value = base
}

function loadSample() {
  input.value = '255'
  fromBase.value = 10
}
</script>

<template>
  <ToolPage title="进制转换" desc="2 ~ 36 进制互转，整数用 BigInt 精确计算，附位宽补码视图" wide>
    <template #actions>
      <el-button size="small" @click="loadSample">填充示例</el-button>
      <el-button size="small" @click="input = ''">清空</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[220px]">
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">数值</div>
          <el-input v-model="input" placeholder="例如 255 / ff / 11111111" clearable class="font-mono" />
        </div>
        <div class="w-[150px]">
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">当前进制</div>
          <el-select v-model="fromBase" style="width: 100%">
            <el-option v-for="b in bases" :key="b.value" :label="b.label" :value="b.value" />
          </el-select>
        </div>
        <div class="w-[170px]">
          <div class="pb-1.5 text-[11.5px] text-[#9ca3af]">位宽视图</div>
          <el-select v-model="bits" style="width: 100%">
            <el-option :value="8" label="8 bit" />
            <el-option :value="16" label="16 bit" />
            <el-option :value="32" label="32 bit" />
            <el-option :value="64" label="64 bit" />
          </el-select>
        </div>
        <el-button @click="setInput('0', 10)">归零</el-button>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid gap-3 md:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">各进制结果</div>
          <div v-for="row in results" :key="row.label" class="tool-kv">
            <span class="tool-kv-label">{{ row.label }}</span>
            <span class="tool-kv-value">{{ row.value }}</span>
            <button type="button" class="tool-link-btn" @click="copy(row.value, row.label)">复制</button>
            <button type="button" class="tool-link-btn" @click="setInput(row.value, row.base)">设为输入</button>
          </div>
          <p v-if="!results.length" class="m-0 py-4 text-center text-[12px] text-[#9ca3af]">输入数值后显示结果</p>
        </div>

        <div class="flex flex-col gap-3">
          <div class="tool-card">
            <div class="tool-card-head">
              补码位视图
              <span class="text-[11px] font-normal text-[#9ca3af]">{{ bits }} 位 · 每 4 位分组</span>
              <button type="button" class="tool-link-btn ml-auto" :disabled="!bitView" @click="copy(bitView, '位视图')">复制</button>
            </div>
            <p class="bit-view">{{ bitView || '请输入整数' }}</p>
          </div>

          <div class="tool-card">
            <div class="tool-card-head">数值信息</div>
            <div v-for="row in decimalInfo" :key="row.label" class="tool-kv">
              <span class="tool-kv-label">{{ row.label }}</span>
              <span class="tool-kv-value">{{ row.value }}</span>
            </div>
            <p v-if="!decimalInfo.length" class="m-0 py-3 text-[12px] text-[#9ca3af]">小数或空输入不展示数值信息</p>
          </div>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 前端二进制运算使用 32 位有符号整数：`1 &lt;&lt; 31` 会溢出为负数，此时用 BigInt。</p>
        <p class="m-0">· 颜色值常用 0xRRGGBB，权限位常用 1 &lt;&lt; n 组合，可在这里直接核对位模式。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.bit-view {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  background: #fafbfc;
  color: #2563eb;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.9;
  letter-spacing: 0.5px;
  word-break: break-all;
}
</style>
