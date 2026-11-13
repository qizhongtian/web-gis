<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'
import {
  ZLM_RTC_EVENTS,
  buildZlmSdpUrl,
  isZlmRtcReady,
  loadZlmRtc,
  type ZlmRtcAnswerFail,
  type ZlmRtcEndpoint,
  type ZlmRtcTrackEvent,
} from '@/utils/video/zlmrtc'

/** 本机 ZLMediaKit 默认接口，需要先推一路 live/test 上去 */
const DEFAULT_SERVER = 'http://127.0.0.1:8080'
const DEFAULT_URL = buildZlmSdpUrl(DEFAULT_SERVER, 'live', 'test')

const PRESETS = [
  { label: '本机 ZLMediaKit（live/test）', url: DEFAULT_URL },
  { label: '自定义地址（换成自己的服务器）', url: '' },
]

const videoRef = ref<HTMLVideoElement>()

const form = reactive({
  url: DEFAULT_URL,
  preset: DEFAULT_URL,
  /** 快速拼接用：服务端根地址 / app / stream */
  server: DEFAULT_SERVER,
  app: 'live',
  stream: 'test',
  debug: false,
  muted: true,
  autoplay: true,
  /** 未收到远端流的超时秒数，超时按失败处理 */
  timeout: 10,
  volume: 60,
})

const status = ref<'loading' | 'ready' | 'error'>('ready')
const statusText = ref('等待连接')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const current = ref(0)
const buffered = ref(0)
/** Endpoint 是普通变量，模板里要用 ref 才能更新按钮状态 */
const hasPlayer = ref(false)

const stat = reactive({ width: 0, height: 0, fps: 0, kbps: 0, lost: 0, rtt: 0 })

let player: ZlmRtcEndpoint | null = null
let statTimer = 0
let watchdog = 0
let closing = false
let prevBytes = 0
let prevTs = 0

const statsText = computed(() =>
  [
    stat.width ? `${stat.width}x${stat.height}` : '',
    stat.fps ? `${stat.fps}fps` : '',
    stat.kbps ? `${stat.kbps.toFixed(0)} kbps` : '',
    stat.rtt ? `RTT ${stat.rtt}ms` : '',
    stat.lost ? `丢包 ${stat.lost}` : '',
    `缓存 ${buffered.value.toFixed(1)}s`,
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

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function clearWatchdog() {
  window.clearTimeout(watchdog)
  watchdog = 0
}

function resetStats() {
  stat.width = 0
  stat.height = 0
  stat.fps = 0
  stat.kbps = 0
  stat.lost = 0
  stat.rtt = 0
  current.value = 0
  buffered.value = 0
  prevBytes = 0
  prevTs = 0
}

function fail(msg: string) {
  clearWatchdog()
  status.value = 'error'
  errorMsg.value = msg
  statusText.value = '连接失败'
  pushLog('error', msg)
}

function startWatchdog() {
  clearWatchdog()
  watchdog = window.setTimeout(() => {
    if (status.value !== 'loading') return
    fail(
      `等待 SDP 协商超时（${form.timeout}s）：先确认服务端在跑、地址里的 app/stream 已推流；` +
        '其次看 rtc.externIP 是否配成对外 IP，以及页面是否 https（http 内网地址可能被 WebRTC 限制）。',
    )
  }, form.timeout * 1000)
}

function applyTrackStat(settings: MediaTrackSettings | undefined) {
  if (!settings) return
  const width = Number(settings.width)
  const height = Number(settings.height)
  const frameRate = Number(settings.frameRate)
  if (width > 0) stat.width = width
  if (height > 0) stat.height = height
  if (Number.isFinite(frameRate) && frameRate > 0) stat.fps = Math.round(frameRate)
}

function bindEvents(endpoint: ZlmRtcEndpoint) {
  const E = ZLM_RTC_EVENTS

  // 这个版本派发的参数是 RTCTrackEvent（流在 event.streams[0]），
  // 而且库内部已经把 stream 挂到 element.srcObject，这里只补日志 / 统计 / 播放。
  endpoint.on(E.WEBRTC_ON_REMOTE_STREAMS, (data: ZlmRtcTrackEvent | MediaStream) => {
    const anyData = data as any
    const stream: MediaStream | null = anyData?.streams?.[0] ?? anyData ?? null
    clearWatchdog()
    status.value = 'ready'
    statusText.value = '已连接，等待首帧…'
    applyTrackStat(stream?.getVideoTracks?.()[0]?.getSettings?.())
    pushLog(
      'remote-stream',
      `${stream?.getVideoTracks().length ?? 0} 视频轨 / ${stream?.getAudioTracks().length ?? 0} 音频轨`,
    )
    void tryPlay()
  })

  endpoint.on(E.WEBRTC_NOT_SUPPORT, () => {
    fail('当前浏览器不支持 WebRTC：找不到可用的 RTCPeerConnection 实现')
  })

  endpoint.on(E.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, (ret: ZlmRtcAnswerFail) => {
    const detail = ret?.msg || '服务端未返回原因'
    fail(`SDP 交换失败（code=${ret?.code}）：${detail}。常见原因是该流不存在 / app 与 stream 不匹配 / 编码不是 H.264。`)
  })

  endpoint.on(E.WEBRTC_ICE_CANDIDATE_ERROR, (e: { errorCode?: number; errorText?: string }) => {
    pushLog('ice', `${e?.errorCode ?? '-'} ${e?.errorText || 'candidate 收集失败'}`)
  })

  // 该构建版没有 CONNECTION_STATE_CHANGE 事件，直接监听底层 pc（close 之后 pc 会被置 null）
  const pc = endpoint.pc
  if (pc) {
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      pushLog('state', state)
      if (state === 'connected') {
        clearWatchdog()
        status.value = 'ready'
        if (statusText.value === '等待连接' || statusText.value === '正在协商 SDP…' || statusText.value === '等待远端流…') {
          statusText.value = '已连接，等待首帧…'
        }
      }
      if (state === 'disconnected') statusText.value = '连接中断，等待恢复…'
      if (state === 'failed') {
        fail('ICE 协商失败：服务端 rtc.externIP 多半还是内网 IP，或 UDP/TCP 端口被防火墙拦了。')
      }
      if (state === 'closed' && !closing && status.value !== 'error') {
        statusText.value = '连接已关闭'
      }
    }
  }
}

async function pollStats() {
  const v = videoRef.value
  if (v) {
    current.value = v.currentTime || 0
    const b = v.buffered
    buffered.value = b.length ? Math.max(0, b.end(b.length - 1) - v.currentTime) : 0
    if (v.videoWidth) {
      stat.width = v.videoWidth
      stat.height = v.videoHeight
    }
  }

  const pc = player?.pc
  if (!pc || pc.connectionState === 'closed') return
  try {
    const report = await pc.getStats()
    report.forEach((r: any) => {
      if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
        if (r.frameWidth) stat.width = r.frameWidth
        if (r.frameHeight) stat.height = r.frameHeight
        if (r.framesPerSecond) stat.fps = Math.round(r.framesPerSecond)
        if (typeof r.packetsLost === 'number') stat.lost = r.packetsLost
        const bytes = Number(r.bytesReceived) || 0
        const ts = Number(r.timestamp) || performance.now()
        if (prevTs && ts > prevTs && bytes >= prevBytes) {
          // bits / ms 恰好等于 kbit/s
          stat.kbps = ((bytes - prevBytes) * 8) / (ts - prevTs)
        }
        prevBytes = bytes
        prevTs = ts
      }
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
        stat.rtt = Math.round(r.currentRoundTripTime * 1000)
      }
    })
  } catch {
    /* stats 在切换连接时会短暂拿不到，忽略 */
  }
}

function startStats() {
  window.clearInterval(statTimer)
  statTimer = window.setInterval(() => void pollStats(), 1000)
}

async function tryPlay() {
  const v = videoRef.value
  if (!v) return
  v.muted = form.muted
  try {
    await v.play()
    playing.value = true
  } catch {
    // 自动播放被拦：保留静音提示，等用户点画面
    playing.value = false
    statusText.value = '已连接，点击画面播放（可能被自动播放策略拦截）'
  }
}

function disconnect(silent = true) {
  closing = true
  clearWatchdog()
  window.clearInterval(statTimer)
  statTimer = 0

  if (player) {
    try {
      player.offAll()
      player.close()
    } catch {
      /* close 会置空内部 options，重复调用可能报错 */
    }
    player = null
  }
  hasPlayer.value = false

  const v = videoRef.value
  if (v) {
    v.pause()
    v.srcObject = null
  }

  playing.value = false
  resetStats()
  closing = false
  if (!silent) return

  status.value = 'ready'
  statusText.value = '已断开'
  pushLog('close', '已关闭 RTCPeerConnection 并停止所有 track')
}

async function connect() {
  const url = form.url.trim()
  if (!url) {
    ElMessage.warning('请填写 ZLMediaKit 的 webrtc 地址')
    return
  }

  disconnect(false)
  status.value = 'loading'
  errorMsg.value = ''
  resetStats()

  if (!isZlmRtcReady()) {
    statusText.value = '正在加载 ZLMRTCClient.js…'
    try {
      await loadZlmRtc()
    } catch (e: any) {
      fail(e?.message || String(e))
      return
    }
  }

  const Ctor = window.ZLMRTCClient
  const el = videoRef.value
  if (!Ctor || typeof Ctor.Endpoint !== 'function' || !el) {
    fail('播放器未就绪：window.ZLMRTCClient 不存在，检查 public/zlmrtc/ZLMRTCClient.js 是否发布成功')
    return
  }

  statusText.value = '正在协商 SDP…'
  try {
    const endpoint = new Ctor.Endpoint({
      element: el,
      zlmsdpUrl: url,
      // 拉流：只收不发、不碰摄像头（该版本 receive() 固定收发流两路，audio/video 开关对拉流无效）
      recvOnly: true,
      useCamera: false,
      debug: form.debug,
    })
    player = endpoint
    hasPlayer.value = true
    bindEvents(endpoint)
    startWatchdog()
    startStats()
    statusText.value = '等待远端流…'
    pushLog('connect', `recvOnly · ${url.length > 60 ? `${url.slice(0, 60)}…` : url}`)
  } catch (e: any) {
    fail(e?.message || String(e))
  }
}

/** 库内日志开关只在构造时生效，改了必须重连 */
function reconnect() {
  if (player || status.value === 'error') connect()
}

function choosePreset(value: string | number | boolean | undefined) {
  const item = PRESETS.find((p) => p.url === value || p.label === value)
  if (!item) return
  form.preset = item.url || item.label
  if (!item.url) {
    ElMessage.info('把地址换成自己的 ZLMediaKit 地址（含 host、app、stream）后再点「连接」')
    return
  }
  form.url = item.url
  connect()
}

/** 用「服务器 + app + stream」快速拼出 SDP 交换地址 */
function composeUrl() {
  if (!form.server.trim() || !form.app.trim() || !form.stream.trim()) {
    ElMessage.warning('服务器、app、stream 都要填')
    return
  }
  form.url = buildZlmSdpUrl(form.server, form.app, form.stream)
  form.preset = ''
  connect()
}

function togglePlay() {
  const v = videoRef.value
  if (!v) return
  if (!player || !v.srcObject) return connect()
  if (v.paused) void tryPlay()
  else {
    // WebRTC 没有暂停拉流：这里只是停止渲染，连接与传输仍在
    v.pause()
    playing.value = false
    statusText.value = '已暂停渲染（连接仍在）'
    pushLog('pause', '暂停渲染，RTC 连接未关闭')
  }
}

function toggleMute() {
  const v = videoRef.value
  if (!v) return
  v.muted = !v.muted
  form.muted = v.muted
  pushLog('mute', v.muted ? '已静音' : '取消静音')
}

function setVolume(value: number | number[]) {
  const v = videoRef.value
  const val = Number(Array.isArray(value) ? value[0] : value)
  form.volume = val
  if (v) {
    v.volume = val / 100
    v.muted = val === 0
  }
  form.muted = val === 0
}

function snapshot() {
  const v = videoRef.value
  if (!v || !v.videoWidth) return ElMessage.warning('还没有画面可截图')
  const canvas = document.createElement('canvas')
  canvas.width = v.videoWidth
  canvas.height = v.videoHeight
  canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `zlm-webrtc-${Date.now()}.png`
  a.click()
  pushLog('snapshot', `${canvas.width}x${canvas.height}`)
}

async function toggleFullscreen() {
  const el = videoRef.value?.parentElement
  if (!el) return
  if (document.fullscreenElement) await document.exitFullscreen()
  else await el.requestFullscreen?.()
}

async function togglePip() {
  const v = videoRef.value
  if (!v) return
  if (!document.pictureInPictureEnabled) return ElMessage.warning('当前浏览器不支持画中画')
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else await v.requestPictureInPicture()
  } catch (e: any) {
    ElMessage.warning(e?.message || '画中画启动失败')
  }
}

function onVideoEvent(name: string) {
  if (name === 'playing') {
    playing.value = true
    status.value = 'ready'
    statusText.value = '播放中'
  }
  if (name === 'pause') playing.value = false
  if (name === 'waiting') pushLog('waiting', '画面卡顿，等待关键帧…')
  if (name === 'error') pushLog('error', 'video 元素报错')
}

/**
 * axios POST 失败时库内部没有 catch，只会产生未处理的 Promise 拒绝。
 * 这里按 URL 过滤出 SDP 交换请求，转成可读错误（CORS / 地址不可达最常见）。
 *
 * 另有库自身的坑：receive() 先执行 `ret.sdp.replace(...)` 才判断 `ret.code != 0`，
 * 流不存在时 ret.sdp 为 undefined，直接抛 TypeError 且不派发 EXCHANGE_FAILED，
 * 所以这里把这类 TypeError 也翻译成「流不存在」提示，免得只能等超时。
 */
function onUnhandledRejection(e: PromiseRejectionEvent) {
  const reason: any = e.reason
  const url = reason?.config?.url

  if (typeof url === 'string' && url.includes('/index/api/webrtc')) {
    e.preventDefault()
    if (status.value === 'error') return
    const msg = reason?.message || 'Network Error'
    fail(
      `SDP 交换请求失败：${msg}。检查地址是否可达、服务端是否放行 CORS、页面与接口协议是否一致（https 页面不能 POST http）。`,
    )
    return
  }

  if (status.value === 'loading' && reason instanceof TypeError && /replace|sdp/i.test(reason.message)) {
    e.preventDefault()
    fail(
      `SDP 交换返回的 JSON 里没有 sdp 字段，通常是服务端返回 code != 0（该流不存在 / app 与 stream 不匹配）。` +
        '先确认已往该 app/stream 推流，再试一次。',
    )
  }
}

onMounted(() => {
  window.addEventListener('unhandledrejection', onUnhandledRejection)
})

onBeforeUnmount(() => {
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
  disconnect(false)
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
    notes-tip="以下为 ZLMediaKit WebRTC（ZLMRTCClient.js）的高频问题，按「先能连、再连稳、再排错」的顺序整理。"
    error-tip="先确认 ZLMediaKit 在跑且已往 `app/stream` 推流；再看 `rtc.externIP`、CORS、页面协议（https）与 UDP/TCP 端口。"
    @retry="connect"
    @clear="logs = []"
  >
    <template #hint>
      ZLMRTCClient.js 示例：通过 ZLMediaKit 的 <code class="inline-code">/index/api/webrtc</code> 接口做 SDP 交换，
      直接播放 WebRTC 流，端到端延迟通常 200~500ms；右侧为集成步骤与排错要点。
    </template>

    <template #stage>
      <video
        ref="videoRef"
        class="stage-video"
        :autoplay="form.autoplay"
        :muted="form.muted"
        playsinline
        @click="togglePlay"
        @playing="onVideoEvent('playing')"
        @pause="onVideoEvent('pause')"
        @waiting="onVideoEvent('waiting')"
        @resize="onVideoEvent('resize')"
        @error="onVideoEvent('error')"
      />
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">webrtc 地址（ZLMediaKit SDP 交换接口）</span>
          <el-input
            v-model="form.url"
            size="small"
            placeholder="http://host:8080/index/api/webrtc?app=live&stream=test&type=play"
            @keyup.enter="connect"
          />
        </label>
        <label class="field">
          <span class="label">示例</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in PRESETS" :key="p.label" :label="p.label" :value="p.url || p.label" />
          </el-select>
        </label>
        <el-button type="primary" size="small" @click="connect">连接</el-button>
        <el-button size="small" @click="disconnect()">断开</el-button>
      </div>

      <div class="field-row">
        <label class="field server">
          <span class="label">服务器</span>
          <el-input v-model="form.server" size="small" placeholder="http://127.0.0.1:8080" />
        </label>
        <label class="field tiny">
          <span class="label">app</span>
          <el-input v-model="form.app" size="small" placeholder="live" />
        </label>
        <label class="field tiny">
          <span class="label">stream</span>
          <el-input v-model="form.stream" size="small" placeholder="test" />
        </label>
        <el-button size="small" @click="composeUrl">拼接地址并连接</el-button>
      </div>

      <div class="btn-row">
        <el-button size="small" :disabled="!hasPlayer" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
        <span class="divider" />
        <span class="label">音量</span>
        <el-slider
          class="vol"
          :model-value="form.volume"
          size="small"
          :show-tooltip="false"
          @update:model-value="setVolume"
        />
        <el-button size="small" @click="toggleMute">{{ form.muted ? '取消静音' : '静音' }}</el-button>
        <span class="divider" />
        <el-button size="small" @click="snapshot">截图</el-button>
        <el-button size="small" @click="toggleFullscreen">全屏</el-button>
        <el-button size="small" @click="togglePip">画中画</el-button>
      </div>

      <div class="btn-row">
        <span class="label">库内日志</span>
        <el-switch v-model="form.debug" size="small" @change="reconnect" />
        <span class="label muted-note">拉流固定收 audio + video 两路，无 DataChannel</span>
        <span class="divider" />
        <span class="label">超时</span>
        <el-select v-model="form.timeout" size="small" class="narrow" :disabled="status === 'loading'">
          <el-option :value="5" label="5s" />
          <el-option :value="10" label="10s" />
          <el-option :value="20" label="20s" />
        </el-select>
        <span class="divider" />
        <span class="stats">{{ statsText }}</span>
      </div>

      <div class="progress-row">
        <span class="time">{{ fmtTime(current) }}</span>
        <el-slider class="progress" :model-value="0" :max="1" disabled :show-tooltip="false" />
        <span class="time">LIVE</span>
      </div>
    </template>
  </PlayerShell>
</template>

<style scoped>
.stage-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
  cursor: pointer;
}
.inline-code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.1);
  font-size: 11px;
}
.field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
.field {
  display: flex;
  flex: 0 1 190px;
  min-width: 160px;
  flex-direction: column;
  gap: 3px;
}
.field.grow {
  flex: 1 1 320px;
  min-width: 240px;
}
.field.server {
  flex: 1 1 220px;
  min-width: 180px;
}
.field.tiny {
  flex: 0 0 96px;
  min-width: 96px;
}
.label {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}
.muted-note {
  color: #cbd5e1;
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
.narrow {
  width: 78px;
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
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -2px;
}
.progress-row .time {
  flex: none;
  width: 44px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11px;
}
.progress-row .time:last-child {
  text-align: right;
}
.progress {
  flex: 1;
  min-width: 0;
}
</style>
