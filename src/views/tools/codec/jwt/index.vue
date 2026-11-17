<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

/** base64url 解码（补齐 padding + UTF-8 还原） */
function b64urlDecode(input: string): string {
  const raw = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = raw.length % 4 ? '='.repeat(4 - (raw.length % 4)) : ''
  const bin = atob(raw + pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** base64url 编码（用于生成演示 token） */
function b64urlEncode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const header = { alg: 'HS256', typ: 'JWT' }
const payload = {
  sub: '10086',
  name: 'web-gis',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 7200,
}

const token = ref(`${b64urlEncode(header)}.${b64urlEncode(payload)}.demo-signature-not-verifiable`)
const error = ref('')

const parts = computed(() => token.value.trim().split('.').filter(Boolean))

const headerJson = computed(() => parsePart(0))
const payloadJson = computed(() => parsePart(1))

function jsonBlock(index: number): string {
  try {
    const raw = parts.value[index]
    if (!raw) return ''
    return JSON.stringify(JSON.parse(b64urlDecode(raw)), null, 2)
  } catch {
    return ''
  }
}

function parsePart(index: number): Record<string, any> | null {
  try {
    const raw = parts.value[index]
    if (!raw) return null
    return JSON.parse(b64urlDecode(raw))
  } catch {
    return null
  }
}

/** 时间声明解析 */
const timeClaims = computed(() => {
  const p = payloadJson.value
  if (!p) return []
  const now = Math.floor(Date.now() / 1000)
  const rows: { key: string; label: string; value: string; status: string; type: 'success' | 'warning' | 'danger' | 'info' }[] = []
  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString()
  if (typeof p.iat === 'number') {
    rows.push({ key: 'iat', label: '签发时间 iat', value: fmt(p.iat), status: '信息', type: 'info' })
  }
  if (typeof p.nbf === 'number') {
    const ok = now >= p.nbf
    rows.push({
      key: 'nbf',
      label: '生效时间 nbf',
      value: fmt(p.nbf),
      status: ok ? '已生效' : '未生效',
      type: ok ? 'success' : 'warning',
    })
  }
  if (typeof p.exp === 'number') {
    const left = p.exp - now
    const expired = left <= 0
    rows.push({
      key: 'exp',
      label: '过期时间 exp',
      value: fmt(p.exp),
      status: expired ? '已过期' : `剩余 ${Math.floor(left / 60)} 分钟`,
      type: expired ? 'danger' : left < 300 ? 'warning' : 'success',
    })
  }
  return rows
})

const algTips = computed(() => {
  const alg = String(headerJson.value?.alg ?? '')
  if (!alg) return []
  const tips: string[] = []
  if (alg.toLowerCase() === 'none') tips.push('alg 为 none 表示无签名，生产环境必须拒绝这类 token。')
  if (alg.startsWith('HS')) tips.push('HS 系列使用对称密钥（同一密钥签名与验签），密钥不可下发给前端。')
  if (alg.startsWith('RS') || alg.startsWith('PS'))
    tips.push('RS / PS 使用非对称密钥，前端可用公钥（JWKS）验签。')
  if (alg.startsWith('ES')) tips.push('ES 系列为 ECDSA 签名，签名长度比 RSA 更短。')
  return tips
})

function loadSample() {
  const now = Math.floor(Date.now() / 1000)
  token.value = [
    b64urlEncode({ alg: 'HS256', typ: 'JWT' }),
    b64urlEncode({ sub: '10086', name: 'web-gis', role: 'admin', iat: now, exp: now + 7200 }),
    'demo-signature-not-verifiable',
  ].join('.')
  error.value = ''
}

function loadExpiredSample() {
  const now = Math.floor(Date.now() / 1000)
  token.value = [
    b64urlEncode({ alg: 'HS256', typ: 'JWT' }),
    b64urlEncode({ sub: '10010', name: 'guest', iat: now - 9000, exp: now - 60 }),
    'demo-signature-not-verifiable',
  ].join('.')
  error.value = ''
}

async function copy(value: string, label: string) {
  if (await copyText(value)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function clearAll() {
  token.value = ''
  error.value = ''
}
</script>

<template>
  <ToolPage title="JWT 解析" desc="解析 Header / Payload，校验 exp / nbf 时间声明（仅解码，不做签名验证）" wide>
    <template #actions>
      <el-button size="small" @click="loadSample">填充示例</el-button>
      <el-button size="small" @click="loadExpiredSample">过期示例</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[12.5px] font-medium text-[#374151]">Token</span>
          <span class="text-[11px] text-[#9ca3af]">
            共 {{ parts.length }} 段{{ parts.length !== 3 ? '（标准 JWT 应为 3 段）' : '' }}
          </span>
        </div>
        <textarea
          v-model="token"
          class="tool-io !min-h-[76px]"
          spellcheck="false"
          placeholder="粘贴 Authorization 里的 Bearer token…"
        />
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="!py-1.5" />

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="tool-card">
          <div class="tool-card-head">
            <span>Header</span>
            <el-tag v-if="headerJson?.alg" size="small" type="info">{{ headerJson.alg }}</el-tag>
            <button type="button" class="tool-link-btn ml-auto" @click="copy(jsonBlock(0), 'Header')">复制</button>
          </div>
          <pre class="tool-code">{{ jsonBlock(0) || '无法解析' }}</pre>
        </div>

        <div class="tool-card">
          <div class="tool-card-head">
            <span>Payload</span>
            <button type="button" class="tool-link-btn ml-auto" @click="copy(jsonBlock(1), 'Payload')">复制</button>
          </div>
          <pre class="tool-code">{{ jsonBlock(1) || '无法解析' }}</pre>
        </div>
      </div>

      <div v-if="timeClaims.length" class="tool-card">
        <div class="tool-card-head"><span>时间声明</span></div>
        <div class="divide-y divide-[#f3f4f6]">
          <div v-for="row in timeClaims" :key="row.key" class="flex items-center gap-3 py-1.5">
            <span class="w-[120px] shrink-0 text-[11.5px] text-[#9ca3af]">{{ row.label }}</span>
            <span class="flex-1 font-mono text-[12.5px] text-[#1f2328]">{{ row.value }}</span>
            <el-tag size="small" :type="row.type">{{ row.status }}</el-tag>
          </div>
        </div>
      </div>

      <div v-if="algTips.length" class="tool-note">
        <p v-for="tip in algTips" :key="tip" class="m-0">· {{ tip }}</p>
      </div>

      <el-alert
        title="签名段未被验证：解码任何人都能做，验签必须放到后端（或使用公钥 JWKS 在可信环境校验），前端永远不要存放 HS 密钥。"
        type="warning"
        show-icon
        :closable="false"
        class="!py-1.5"
      />
    </section>
  </ToolPage>
</template>

<style scoped>
</style>
