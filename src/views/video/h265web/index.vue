<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'
import {
  H265WEB_CDN,
  H265WEB_CDN_BASE,
  H265WEB_LOCAL,
  H265WEB_LOCAL_BASE,
  H265WEB_WASM_BIN,
  H265WEB_WASM_JS,
  detectH265web,
  loadH265web,
  releasePlayer,
  type H265webPlayer,
} from '@/utils/video/h265web'

/** 容器 id 由 SDK 用 getElementById 查找，必须唯一且稳定 */
const HOST_ID = 'h265web-host'

const SDK_PRESETS = [
  { value: 'local', label: '本地 · public/h265web/', url: H265WEB_LOCAL, base: H265WEB_LOCAL_BASE },
  { value: 'cdn', label: 'CDN · jsDelivr', url: H265WEB_CDN, base: H265WEB_CDN_BASE },
]

const hostRef = ref<HTMLElement>()

const form = reactive({
  url: 'https://your-host/live/h265.flv',
  token: '',
  sdk: 'local' as 'cdn' | 'local' | 'custom',
  sdkUrl: H265WEB_LOCAL,
  baseUrl: H265WEB_LOCAL_BASE,
  ignoreAudio: false,
  volume: 60,
})

const status = ref<'loading' | 'ready' | 'error'>('ready')
const statusText = ref('等待起播')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const muted = ref(false)
const ready = ref(false)
const current = ref(0)
const size = reactive({ width: 0, height: 0 })

let player: H265webPlayer | null = null

const timeText = computed(() => {
  const total = Math.max(0, Math.floor(current.value))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
})

const statsText = computed(() =>
  [
    size.width ? `${size.width}x${size.height}` : '',
    'wasm 软解',
    form.ignoreAudio ? '忽略音频' : '含音频',
    detectH265web() === 'legacy' ? '旧版 SDK' : '',
  ]
    .filter(Boolean)
    .join(' · '),
)

function pushLog(type: string, text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const last = logs.value[0]
  if (last && last.type === type && last.text === text && last.time === time) return
  logs.value.unshift({ time, type, text })
  if (logs.value.length > 30) logs.value.pop()
}

function fail(msg: string) {
  status.value = 'error'
  statusText.value = '播放失败'
  errorMsg.value = msg
  pushLog('error', msg)
}

/** token 等鉴权参数挂在 query 上，避免改 SDK 内部请求逻辑 */
function buildUrl(): string {
  const raw = form.url.trim()
  if (!raw) return ''
  if (!form.token.trim()) return raw
  const sep = raw.includes('?') ? '&' : '?'
  return `${raw}${sep}token=${encodeURIComponent(form.token.trim())}`
}

/** base_url 末尾补斜杠，否则会拼出 h265webh265web_wasm.js */
function withSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

function applySdkPreset(value: string | number | boolean | undefined) {
  form.sdk = String(value) as typeof form.sdk
  const preset = SDK_PRESETS.find((p) => p.value === value)
  if (!preset) return
  form.sdkUrl = preset.url
  form.baseUrl = preset.base
}

function onSdkChange(value: string | number | boolean | undefined) {
  applySdkPreset(value)
  if (form.sdk === 'custom') {
    ElMessage.info('主脚本与 base_url 必须指向同一份 dist，否则 wasm 版本对不上')
  }
}

function bindCallbacks(p: H265webPlayer) {
  p.on_ready_show_done_callback = () => {
    ready.value = true
    status.value = 'ready'
    statusText.value = '播放中'
    playing.value = true
    // 首帧渲染完才能取到真实宽高
    const canvas = hostRef.value?.querySelector('canvas')
    if (canvas) {
      size.width = canvas.width
      size.height = canvas.height
    }
    pushLog('ready', `首帧渲染完成${size.width ? ` ${size.width}x${size.height}` : ''}`)
  }

  p.on_play_time = (seconds: number) => {
    current.value = Number(seconds) || 0
  }

  p.onPlayStart = () => {
    playing.value = true
    statusText.value = '播放中'
    pushLog('play', '开始播放')
  }

  p.onPlayPause = () => {
    playing.value = false
    statusText.value = '已暂停'
    pushLog('pause', '已暂停')
  }

  p.onPlayFinish = () => {
    playing.value = false
    statusText.value = '播放结束'
    pushLog('finish', '码流结束（点播播完，或直播断流）')
  }

  p.on_error_callback = (err: unknown) => {
    fail(
      `解封装/解码失败：${String(err)}。` +
        ' 常见原因是流不是 H.265、FLV 缺少 enhanced-RTMP 标记、或 base_url 下的 wasm 资源 404。',
    )
  }
}

async function destroyPlayer() {
  const p = player
  player = null
  playing.value = false
  ready.value = false
  if (p) await releasePlayer(p)
  if (hostRef.value) hostRef.value.innerHTML = ''
}

async function load() {
  const url = buildUrl()
  if (!url || url.startsWith('https://your-host')) {
    ElMessage.warning('请先填写真实的 H.265 拉流地址')
    return
  }

  const host = hostRef.value
  if (!host) return
  if (!host.clientWidth || !host.clientHeight) {
    fail('容器尺寸为 0，无法创建 canvas')
    return
  }

  await destroyPlayer()
  status.value = 'loading'
  statusText.value = '正在加载 SDK…'
  errorMsg.value = ''
  current.value = 0

  try {
    await loadH265web(form.sdkUrl)
  } catch (e: any) {
    fail(
      `SDK 加载失败：${e?.message || e}。` +
        ' 把 h265web.js 与同目录 wasm 资源整体放到 public/h265web/，再把「SDK 来源」切成本地，可绕开 CDN 与跨域问题。',
    )
    return
  }

  const kind = detectH265web()
  if (kind === 'legacy') {
    fail('检测到旧版 new265webjs：参数顺序在不同分支不一致，本页按 v2 的 build / load_media / play 调用，请更换 static/h265web.js')
    return
  }

  const factory = window.H265webjsPlayer
  if (!factory) {
    fail('window.H265webjsPlayer 不存在，请确认脚本地址指向 SDK 主文件而非 demo 页面')
    return
  }

  statusText.value = '正在初始化 wasm 解码器…'
  const width = host.clientWidth
  const height = host.clientHeight

  try {
    player = factory()
    bindCallbacks(player)
    const base = withSlash(form.baseUrl)
    const ok = player.build({
      player_id: HOST_ID,
      base_url: base,
      // SDK 没有默认 wasm 文件名，这两项必须给，否则起播时 wasm 404
      wasm_js_uri: `${base}${H265WEB_WASM_JS}`,
      wasm_wasm_uri: `${base}${H265WEB_WASM_BIN}`,
      width,
      height,
      // 由页面在 load_media 之后显式 play()，auto_play 容易和浏览器策略打架
      auto_play: false,
      ignore_audio: form.ignoreAudio,
    })
    if (ok === false) {
      fail('build 失败：容器 id 不存在，或 base_url 下的 wasm 资源不可访问')
      return
    }
    pushLog('build', `${width}x${height} · ${form.baseUrl}`)
    player.load_media(url)
    player.play()
    statusText.value = '正在拉流…'
    pushLog('load', url.length > 52 ? `${url.slice(0, 52)}…` : url)
  } catch (e: any) {
    fail(`初始化异常：${e?.message || e}`)
  }
}

function togglePlay() {
  if (!player || !ready.value) return load()
  if (playing.value) {
    player.pause()
    return
  }
  // 直播流恢复用 play()；点播播完后需要重新 load_media
  player.play()
}

async function stop() {
  await destroyPlayer()
  status.value = 'ready'
  statusText.value = '已停止'
  size.width = 0
  size.height = 0
  current.value = 0
  pushLog('stop', '已释放 wasm 与 canvas')
}

function setVolume(value: number | number[]) {
  const val = Number(Array.isArray(value) ? value[0] : value)
  form.volume = val
  const target = player
  if (!target) return
  // v2 按 0~1 传值；个别分支是 0~100，切换版本后要实测
  const fn = target.set_voice ?? target.setVoice
  fn?.call(target, val / 100)
  muted.value = val === 0
}

function toggleMute() {
  if (!player) return
  muted.value = !muted.value
  setVolume(muted.value ? 0 : 60)
}

/** 容器尺寸变了要重建：build 时的 width/height 决定 canvas 像素 */
async function fitSize() {
  if (!player || !form.url) return
  await load()
}

function snapshot() {
  if (!player) return ElMessage.warning('还没有实例可截图')
  if (typeof player.snapshot !== 'function') {
    return ElMessage.warning('当前 SDK 版本没有暴露 snapshot，可在 canvas 上自行 toDataURL')
  }
  try {
    player.snapshot()
    pushLog('snapshot', '已触发截图')
  } catch (e: any) {
    ElMessage.warning(e?.message || '截图失败')
  }
}

function toggleFullscreen() {
  const host = hostRef.value
  if (!host) return
  if (document.fullscreenElement) {
    document.exitFullscreen?.()
    return
  }
  host.requestFullscreen?.().catch(() => ElMessage.warning('浏览器拒绝了全屏请求'))
}

onBeforeUnmount(() => {
  destroyPlayer()
})
</script>

<template>
  <PlayerShell
    :status="status"
    :status-text="statusText"
    :error-msg="errorMsg"
    :logs="logs"
    :blocks="guideBlocks"
    :notes="notes"
    notes-tip="h265web.js 的坑集中在「wasm 资源路径」「容器 id 复用」「服务端是不是真的 HEVC over FLV」三处。"
    error-tip="确认地址可直连、流是 H.265，并把 h265web.js 与 wasm 资源放同一目录（`base_url`）；CDN 取源时若报 wasm 实例化失败，先切本地 `public/h265web/`。"
    @retry="load"
    @clear="logs = []"
  >
    <template #hint>
      h265web.js 示例：wasm 软解播放浏览器原生不支持的 <b>H.265</b>，支持 http-flv / ws-flv / HLS / MP4；页面演示 build → load_media → play 的调用链与回调日志，右侧为接入要点。
    </template>

    <template #stage>
      <div :id="HOST_ID" ref="hostRef" class="player-host" />
      <div v-if="!ready" class="sdk-hint">
        <p class="sdk-title">{{ status === 'loading' ? '正在初始化解码器…' : '等待起播' }}</p>
        <p class="sdk-desc">
          已默认使用本地 <code>public/h265web/</code>（<code>h265web.js</code> +
          <code>h265web_wasm.js</code> + <code>h265web_wasm.wasm</code>，共约 4.7 MB）。若本地文件缺失，
          可在下方「SDK 来源」切到 jsDelivr 兜底。
        </p>
      </div>
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">流地址（H.265：http-flv / ws-flv / hls / mp4）</span>
          <el-input v-model="form.url" size="small" placeholder="https://host/live/h265.flv" @keyup.enter="load" />
        </label>
        <label class="field">
          <span class="label">token</span>
          <el-input v-model="form.token" size="small" placeholder="可选，拼到 query" />
        </label>
        <el-button type="primary" size="small" :loading="status === 'loading'" @click="load">加载播放</el-button>
        <el-button size="small" @click="stop">停止</el-button>
      </div>

      <div class="btn-row">
        <el-button size="small" :disabled="status === 'error'" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
        <span class="divider" />
        <span class="label">音量</span>
        <el-slider class="vol" :model-value="form.volume" size="small" :show-tooltip="false" @update:model-value="setVolume" />
        <el-button size="small" @click="toggleMute">{{ muted ? '取消静音' : '静音' }}</el-button>
        <span class="divider" />
        <el-button size="small" @click="snapshot">截图</el-button>
        <el-button size="small" @click="fitSize">适配尺寸</el-button>
        <el-button size="small" @click="toggleFullscreen">全屏</el-button>
      </div>

      <div class="btn-row">
        <span class="label">SDK 来源</span>
        <el-select :model-value="form.sdk" size="small" class="sdk" @update:model-value="onSdkChange">
          <el-option v-for="p in SDK_PRESETS" :key="p.value" :label="p.label" :value="p.value" />
          <el-option label="自定义地址" value="custom" />
        </el-select>
        <el-input v-model="form.baseUrl" size="small" class="base-url" placeholder="wasm 资源根目录 base_url" />
        <span class="divider" />
        <span class="label">忽略音频</span>
        <el-switch v-model="form.ignoreAudio" size="small" />
      </div>

      <div class="btn-row">
        <span class="label">已播</span>
        <span class="clock">{{ timeText }}</span>
        <span class="divider" />
        <span class="stats">{{ statsText }}</span>
      </div>
    </template>
  </PlayerShell>
</template>

<style scoped>
.player-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #000;
}
.sdk-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
  pointer-events: none;
}
.sdk-title {
  margin: 0;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 600;
}
.sdk-desc {
  margin: 0;
  max-width: 580px;
  color: #7c8ea3;
  font-size: 11.5px;
  line-height: 1.7;
}
.sdk-desc code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}
.field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
.field {
  display: flex;
  flex: 0 1 180px;
  min-width: 150px;
  flex-direction: column;
  gap: 3px;
}
.field.grow {
  flex: 1 1 320px;
  min-width: 240px;
}
.label {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.btn-row .divider {
  width: 1px;
  height: 16px;
  background: #e2e8f0;
}
.vol {
  width: 90px;
}
.sdk {
  width: 150px;
}
.base-url {
  flex: 1 1 240px;
  min-width: 200px;
}
.clock {
  color: #334155;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.stats {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
