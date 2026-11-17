<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { copyText } from '@/utils/tools/file'

interface Check {
  name: string
  desc: string
  test: () => boolean
}

const has = (key: string) => key in window || key in navigator

const groups: { title: string; desc: string; items: Check[] }[] = [
  {
    title: '语言与运行时',
    desc: 'JS 引擎能力',
    items: [
      { name: 'Proxy', desc: '响应式系统的基石', test: () => typeof Proxy !== 'undefined' },
      { name: 'BigInt', desc: '大整数精确运算', test: () => typeof BigInt !== 'undefined' },
      { name: 'structuredClone', desc: '原生深拷贝', test: () => typeof structuredClone === 'function' },
      { name: 'Array.prototype.at', desc: '支持负数索引', test: () => typeof [].at === 'function' },
      { name: 'toSorted / toReversed', desc: '不可变数组方法', test: () => 'toSorted' in Array.prototype },
      { name: 'Object.groupBy', desc: '按条件分组', test: () => 'groupBy' in Object },
      { name: 'Intl.Segmenter', desc: '国际化分词', test: () => 'Segmenter' in Intl },
      { name: 'Intl.NumberFormat', desc: '千分位与货币格式化', test: () => 'NumberFormat' in Intl },
    ],
  },
  {
    title: '图形与计算',
    desc: '地图渲染相关',
    items: [
      { name: 'Canvas 2D', desc: '二维绘图基础', test: () => !!document.createElement('canvas').getContext('2d') },
      { name: 'WebGL 1', desc: 'Cesium / Three.js 依赖', test: () => !!document.createElement('canvas').getContext('webgl') },
      { name: 'WebGL 2', desc: '更高版本的着色能力', test: () => !!document.createElement('canvas').getContext('webgl2') },
      { name: 'OffscreenCanvas', desc: 'Worker 中绘制，主线程不卡', test: () => typeof OffscreenCanvas !== 'undefined' },
      { name: 'WebGPU', desc: '新一代图形 API', test: () => 'gpu' in navigator },
      { name: 'WebAssembly', desc: '高性能计算模块', test: () => typeof WebAssembly === 'object' },
      { name: 'Web Worker', desc: '后台线程', test: () => typeof Worker !== 'undefined' },
      { name: 'SharedArrayBuffer', desc: '多线程共享内存', test: () => typeof SharedArrayBuffer !== 'undefined' },
    ],
  },
  {
    title: '网络与存储',
    desc: '离线与实时',
    items: [
      { name: 'fetch', desc: '现代请求 API', test: () => typeof fetch === 'function' },
      { name: 'AbortSignal.timeout', desc: '原生超时控制', test: () => 'timeout' in AbortSignal },
      { name: 'WebSocket', desc: '长连接', test: () => typeof WebSocket !== 'undefined' },
      { name: 'XMLHttpRequest', desc: '兼容老浏览器兜底', test: () => typeof XMLHttpRequest !== 'undefined' },
      { name: 'Service Worker', desc: '可编程缓存与离线', test: () => 'serviceWorker' in navigator },
      { name: 'IndexedDB', desc: '大容量结构化存储', test: () => typeof indexedDB !== 'undefined' },
      { name: 'localStorage', desc: '本地持久存储', test: () => typeof localStorage !== 'undefined' },
      { name: 'Cache Storage', desc: '缓存请求与响应', test: () => 'caches' in window },
      { name: 'BroadcastChannel', desc: '同源多标签通信', test: () => typeof BroadcastChannel !== 'undefined' },
    ],
  },
  {
    title: '设备与交互',
    desc: '需要用户授权或 https',
    items: [
      { name: 'Clipboard', desc: '复制粘贴 API', test: () => !!navigator.clipboard },
      { name: 'Notification', desc: '桌面通知', test: () => 'Notification' in window },
      { name: 'Geolocation', desc: '定位，地图应用常见降级点', test: () => 'geolocation' in navigator },
      { name: 'getUserMedia', desc: '摄像头 / 麦克风', test: () => !!navigator.mediaDevices?.getUserMedia },
      { name: 'Vibration', desc: '移动端震动反馈', test: () => 'vibrate' in navigator },
      { name: 'Web Share', desc: '系统分享面板', test: () => 'share' in navigator },
      { name: 'Fullscreen', desc: '全屏 API', test: () => 'requestFullscreen' in document.documentElement },
      { name: 'Pointer Events', desc: '统一鼠标与触摸', test: () => 'PointerEvent' in window },
      { name: 'ResizeObserver', desc: '元素尺寸监听', test: () => typeof ResizeObserver !== 'undefined' },
      { name: 'IntersectionObserver', desc: '可见性监听', test: () => typeof IntersectionObserver !== 'undefined' },
      { name: 'Bluetooth / USB / Serial', desc: '硬件通信', test: () => has('bluetooth') || has('usb') || has('serial') },
    ],
  },
  {
    title: 'CSS 特性',
    desc: 'CSS.supports 检测',
    items: [
      { name: 'CSS Grid', desc: '二维布局', test: () => CSS.supports('display', 'grid') },
      { name: 'flex gap', desc: '弹性间距', test: () => CSS.supports('gap', '8px') },
      { name: 'aspect-ratio', desc: '固定宽高比', test: () => CSS.supports('aspect-ratio', '16 / 9') },
      { name: ':has()', desc: '父级选择器', test: () => CSS.supports('selector(:has(a))') },
      { name: 'container queries', desc: '容器查询', test: () => CSS.supports('container-type', 'inline-size') },
      { name: 'backdrop-filter', desc: '毛玻璃', test: () => CSS.supports('backdrop-filter', 'blur(4px)') },
      { name: 'dvh 单位', desc: '动态视口高度', test: () => CSS.supports('height', '100dvh') },
      { name: 'color-mix()', desc: 'CSS 混色', test: () => CSS.supports('color', 'color-mix(in srgb, red 50%, blue)') },
      { name: 'subgrid', desc: '网格继承', test: () => CSS.supports('grid-template-columns', 'subgrid') },
      { name: 'text-wrap: balance', desc: '均衡换行', test: () => CSS.supports('text-wrap', 'balance') },
    ],
  },
]

const results = ref(groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, supported: safe(i.test) })) })))

function safe(fn: () => boolean) {
  try {
    return !!fn()
  } catch {
    return false
  }
}

const onlyUnsupported = ref(false)

const view = computed(() =>
  results.value.map((g) => ({
    ...g,
    items: onlyUnsupported.value ? g.items.filter((i) => !i.supported) : g.items,
  })).filter((g) => g.items.length > 0),
)

const total = computed(() => results.value.reduce((s, g) => s + g.items.length, 0))
const supported = computed(() => results.value.reduce((s, g) => s + g.items.filter((i) => i.supported).length, 0))

const secure = computed(() => window.isSecureContext)

async function copy() {
  const text = results.value
    .map((g) => `${g.title}\n${g.items.map((i) => `${i.supported ? '[√]' : '[×]'} ${i.name} - ${i.desc}`).join('\n')}`)
    .join('\n\n')
  if (await copyText(text)) ElMessage.success('检测结果已复制')
  else ElMessage.error('复制失败')
}

function refresh() {
  results.value = groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, supported: safe(i.test) })) }))
  ElMessage.success('已重新检测')
}
</script>

<template>
  <ToolPage title="能力探测" desc="一键检测当前浏览器支持的 Web API 与 CSS 特性，快速定位降级方案" wide>
    <template #actions>
      <el-tag size="small" :type="secure ? 'success' : 'warning'">{{ secure ? '安全上下文' : '非 https' }}</el-tag>
      <el-tag size="small" type="info">支持 {{ supported }} / {{ total }}</el-tag>
      <el-button size="small" @click="refresh">重新检测</el-button>
      <el-button size="small" @click="copy">复制报告</el-button>
    </template>

    <section class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="h-[6px] flex-1 overflow-hidden rounded-full bg-[#f1f3f5]">
          <div class="h-full rounded-full bg-[#2563eb] transition-all" :style="{ width: (supported / total) * 100 + '%' }" />
        </div>
        <el-checkbox v-model="onlyUnsupported" size="small">只看不支持</el-checkbox>
      </div>

      <el-alert
        v-if="!secure"
        title="当前页面不在安全上下文（https / localhost），剪切板、定位、摄像头、Service Worker 等能力会被浏览器禁用"
        type="warning"
        show-icon
        :closable="false"
        class="!py-1.5"
      />

      <section v-for="group in view" :key="group.title" class="app-panel p-3">
        <header class="mb-2 flex items-baseline gap-2">
          <h3 class="m-0 text-[13.5px] font-semibold text-[#1f2328]">{{ group.title }}</h3>
          <span class="text-[11.5px] text-[#9ca3af]">{{ group.desc }}</span>
          <span class="ml-auto text-[11px] text-[#c0c4cc]">
            {{ group.items.filter((i) => i.supported).length }} / {{ group.items.length }}
          </span>
        </header>

        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in group.items" :key="item.name" class="cap-item" :class="{ 'is-off': !item.supported }">
            <span class="cap-dot" :class="item.supported ? 'bg-[#16a34a]' : 'bg-[#dc2626]'" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-[12px] font-medium text-[#1f2328]">{{ item.name }}</p>
              <p class="m-0 mt-0.5 text-[11px] leading-snug text-[#9ca3af]">{{ item.desc }}</p>
            </div>
            <span class="shrink-0 text-[11px]" :class="item.supported ? 'text-[#16a34a]' : 'text-[#dc2626]'">
              {{ item.supported ? '支持' : '不支持' }}
            </span>
          </div>
        </div>
      </section>

      <div class="tool-note">
        <p class="m-0">· 检测结果按当前浏览器与运行环境实时计算，同款浏览器不同设备（如移动端）可能不同。</p>
        <p class="m-0">· 「支持」不代表无需降级授权：定位、摄像头、通知都需要用户显式同意。</p>
      </div>
    </section>
  </ToolPage>
</template>

<style scoped>
.cap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #eef0f3;
  border-radius: 9px;
  background: #fff;
}
.cap-item.is-off {
  background: #fdfcfc;
  border-color: #f6e7e7;
}
.cap-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}
</style>
