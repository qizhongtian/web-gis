<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const battery = ref<{ level: number; charging: boolean } | null>(null)
const online = ref(navigator.onLine)
const scrollbarWidth = ref(0)

const nav = navigator as Navigator & {
  deviceMemory?: number
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
  userAgentData?: { platform?: string; mobile?: boolean; brands?: { brand: string; version: string }[] }
}

/** 从 UA 粗略识别浏览器与内核 */
const uaInfo = computed(() => {
  const ua = navigator.userAgent
  const test = (re: RegExp) => re.test(ua)
  let browser = '未知'
  if (test(/Edg\//)) browser = 'Edge'
  else if (test(/OPR\/|Opera/)) browser = 'Opera'
  else if (test(/Firefox\//)) browser = 'Firefox'
  else if (test(/Chrome\//)) browser = 'Chrome'
  else if (test(/Safari\//)) browser = 'Safari'

  let engine = '未知'
  if (test(/AppleWebKit/)) engine = 'WebKit'
  if (test(/Chrome\/|Edg\//)) engine = 'Blink'
  if (test(/Gecko\/|Firefox/)) engine = 'Gecko'

  let os = '未知'
  if (test(/Windows NT 10/)) os = 'Windows 10/11'
  else if (test(/Windows/)) os = 'Windows'
  else if (test(/Mac OS X/)) os = 'macOS'
  else if (test(/Android/)) os = 'Android'
  else if (test(/iPhone|iPad|iPod/)) os = 'iOS'
  else if (test(/Linux/)) os = 'Linux'

  return { browser, engine, os, mobile: /Mobi|Android|iPhone/.test(ua) }
})

const screenRows = computed(() => [
  { label: '屏幕分辨率', value: `${screen.width} × ${screen.height}` },
  { label: '可用区域', value: `${screen.availWidth} × ${screen.availHeight}` },
  { label: '视口尺寸', value: `${viewport.value.w} × ${viewport.value.h}` },
  { label: '设备像素比 DPR', value: String(window.devicePixelRatio || 1) },
  { label: '色深', value: `${screen.colorDepth} bit` },
  { label: '方向', value: screen.orientation?.type ?? '未知' },
  { label: '滚动条宽度', value: `${scrollbarWidth.value} px` },
])

const runtimeRows = computed(() => [
  { label: '语言', value: navigator.language },
  { label: '语言列表', value: (navigator.languages || []).join(', ') },
  { label: '时区', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: '时区偏移', value: `UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60}` },
  { label: 'CPU 逻辑核心', value: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} 核` : '不可读取' },
  { label: '设备内存', value: nav.deviceMemory ? `≈ ${nav.deviceMemory} GB` : '不可读取' },
  { label: '网络状态', value: online.value ? '在线' : '离线' },
  {
    label: '网络类型',
    value: nav.connection?.effectiveType
      ? `${nav.connection.effectiveType.toUpperCase()}${nav.connection.downlink ? ` · ${nav.connection.downlink} Mb/s` : ''}${
          typeof nav.connection.rtt === 'number' ? ` · RTT ${nav.connection.rtt}ms` : ''
        }`
      : '不可读取',
  },
  { label: '节流模式', value: nav.connection?.saveData ? '已开启' : '关闭' },
  { label: 'Cookie 可用', value: navigator.cookieEnabled ? '是' : '否' },
  { label: '触摸支持', value: 'ontouchstart' in window ? '是' : '否' },
  { label: '电池', value: battery.value ? `${Math.round(battery.value.level * 100)}% ${battery.value.charging ? '（充电中）' : ''}` : '不可读取' },
])

const platformRows = computed(() => {
  const rows: { label: string; value: string }[] = []
  if (nav.userAgentData?.platform) rows.push({ label: 'UA-CH 平台', value: nav.userAgentData.platform })
  if (nav.userAgentData?.brands?.length) {
    rows.push({
      label: '品牌版本',
      value: nav.userAgentData.brands.filter((b) => !/Not.?A.?Brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(' / '),
    })
  }
  rows.push({ label: '平台', value: navigator.platform || '未知' })
  rows.push({ label: '厂商', value: navigator.vendor || '未知' })
  rows.push({ label: 'User-Agent', value: navigator.userAgent })
  return rows
})

/** WebGL 渲染器信息（判断是否软件渲染 / 虚拟机） */
function readGpu() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return '不支持 WebGL'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return '已隐藏（浏览器隐私策略）'
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
  } catch {
    return '读取失败'
  }
}

const gpu = ref('')
const media = computed(() => [
  { label: '深色模式', value: matchMedia('(prefers-color-scheme: dark)').matches ? '偏好深色' : '偏好浅色' },
  { label: '减少动效', value: matchMedia('(prefers-reduced-motion: reduce)').matches ? '已开启' : '未开启' },
  { label: '触控主输入', value: matchMedia('(pointer: coarse)').matches ? '是（移动/触屏）' : '否（精确指针）' },
  { label: '悬停能力', value: matchMedia('(hover: hover)').matches ? '支持' : '不支持' },
])

const uaText = navigator.userAgent

const uaBlock = computed(() => JSON.stringify({
  浏览器: uaInfo.value.browser,
  内核: uaInfo.value.engine,
  操作系统: uaInfo.value.os,
  移动端: uaInfo.value.mobile,
  屏幕: `${screen.width}x${screen.height} @${window.devicePixelRatio}x`,
  UA: navigator.userAgent,
}, null, 2))

async function copy(value: string, label = '信息') {
  if (await copyText(value)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败')
}

function onResize() {
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
}
function onOnline() {
  online.value = navigator.onLine
}

onMounted(async () => {
  gpu.value = readGpu()
  const el = document.createElement('div')
  el.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px'
  document.body.appendChild(el)
  scrollbarWidth.value = el.offsetWidth - el.clientWidth
  el.remove()

  window.addEventListener('resize', onResize)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOnline)

  const anyNav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }
  if (anyNav.getBattery) {
    try {
      const b = await anyNav.getBattery()
      battery.value = { level: b.level, charging: b.charging }
    } catch {
      battery.value = null
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOnline)
})
</script>

<template>
  <ToolPage title="设备信息" desc="屏幕、硬件、网络、GPU 与偏好设置一览，便于定位兼容性问题" wide>
    <template #actions>
      <el-tag size="small" :type="online ? 'success' : 'danger'">{{ online ? '在线' : '离线' }}</el-tag>
      <el-tag size="small" type="info">{{ uaInfo.browser }} · {{ uaInfo.os }}</el-tag>
      <el-button size="small" @click="copy(uaBlock, '设备信息')">复制摘要</el-button>
    </template>

    <section class="app-panel flex flex-col gap-3 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-tag effect="plain" size="small">{{ uaInfo.browser }}</el-tag>
        <el-tag effect="plain" size="small" type="success">{{ uaInfo.engine }}</el-tag>
        <el-tag effect="plain" size="small" type="warning">{{ uaInfo.os }}</el-tag>
        <el-tag effect="plain" size="small" type="info">{{ uaInfo.mobile ? '移动端' : '桌面端' }}</el-tag>
        <span class="text-[11.5px] text-[#9ca3af]">视口 {{ viewport.w }} × {{ viewport.h }}</span>
      </div>

      <div class="grid gap-3 lg:grid-cols-3">
        <div class="tool-card">
          <div class="tool-card-head">显示</div>
          <div v-for="row in screenRows" :key="row.label" class="tool-kv">
            <span class="tool-kv-label">{{ row.label }}</span>
            <span class="tool-kv-value">{{ row.value }}</span>
          </div>
        </div>

        <div class="tool-card">
          <div class="tool-card-head">运行环境</div>
          <div v-for="row in runtimeRows" :key="row.label" class="tool-kv">
            <span class="tool-kv-label">{{ row.label }}</span>
            <span class="tool-kv-value">{{ row.value }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="tool-card">
            <div class="tool-card-head">用户偏好</div>
            <div v-for="row in media" :key="row.label" class="tool-kv">
              <span class="tool-kv-label">{{ row.label }}</span>
              <span class="tool-kv-value">{{ row.value }}</span>
            </div>
          </div>

          <div class="tool-card">
            <div class="tool-card-head">
              GPU
              <button type="button" class="tool-link-btn ml-auto" @click="copy(gpu, 'GPU')">复制</button>
            </div>
            <p class="m-0 break-all font-mono text-[11.5px] leading-relaxed text-[#374151]">{{ gpu || '读取中…' }}</p>
            <p class="tool-note mt-2 !py-1.5">显示 Software / SwiftShader 说明浏览器禁用了硬件加速，三维地图会明显掉帧。</p>
          </div>
        </div>
      </div>

      <div class="tool-card">
        <div class="tool-card-head">
          平台与 UA
          <button type="button" class="tool-link-btn ml-auto" @click="copy(uaText, 'User-Agent')">复制 UA</button>
        </div>
        <div v-for="row in platformRows" :key="row.label" class="tool-kv">
          <span class="tool-kv-label">{{ row.label }}</span>
          <span class="tool-kv-value" :class="{ 'text-[11px]': row.label === 'User-Agent' }">{{ row.value }}</span>
        </div>
      </div>

      <div class="tool-note">
        <p class="m-0">· 设备内存、网络类型、电池等 API 仅在部分浏览器可用，且需要 https 环境。</p>
        <p class="m-0">· 调试移动端样式时，重点看 DPR 与视口宽度，而不是屏幕物理分辨率。</p>
      </div>
    </section>
  </ToolPage>
</template>
