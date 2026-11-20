<script setup lang="ts">
/**
 * 原生 WebRTC 拉流示例：自己建 RTCPeerConnection，自己做 SDP 交换
 *
 * 和 ZLMRTCClient.js 页面的区别：这里不引入任何播放器库，
 * 直接用浏览器 API + fetch 走一遍 WHEP / ZLMediaKit 的协商流程，方便看清协议细节。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'
import {
  exchangeSdp,
  isWebRtcSupported,
  parseIceServers,
  stopStream,
  waitIceGathering,
  type SdpMode,
} from '@/utils/video/webrtc'

const DEFAULT_SERVER = 'http://127.0.0.1:8080'
const DEFAULT_ZLM_URL = `${DEFAULT_SERVER}/index/api/webrtc?app=live&stream=test&type=play`

const MODE_OPTIONS: { value: SdpMode; label: string }[] = [
  { value: 'whep', label: 'WHEP（标准）' },
  { value: 'zlm', label: 'ZLMediaKit' },
  { value: 'custom', label: '自定义 POST' },
]

const PRESETS: { label: string; mode: SdpMode; url: string }[] = [
  { label: 'ZLMediaKit · live/test', mode: 'zlm', url: DEFAULT_ZLM_URL },
  { label: 'WHEP · 自定义地址', mode: 'whep', url: '' },
  { label: '自定义 POST · 自建接口', mode: 'custom', url: '' },
]

const videoRef = ref<HTMLVideoElement>()

const form = reactive({
  mode: 'zlm' as SdpMode,
  url: DEFAULT_ZLM_URL,
  preset: DEFAULT_ZLM_URL,
  /** 快速拼接用：服务端根地址 / app / stream */
  server: DEFAULT_SERVER,
  app: 'live',
  stream: 'test',
  /** 查询串里追加的鉴权用 token，留空则不带 */
  token: '',
  /** 留空即走 host candidate，局域网内的 ZLM 不需要 STUN */
  iceServers: '',
  /** 收音频：只想看画面时关掉，少一条 m-line */
  recvAudio: true,
  muted: true,
  autoplay: true,
  /** SDP 交换整体超时 */
  timeout: 10,
  /** 等 ICE 收集的秒数，非 trickle 交换必须等 */
  iceWait: 1.5,
  volume: 60,
})

const status = ref<'loading' | 'ready' | 'error'>('ready')
const statusText = ref('等待连接')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const current = ref(0)
const buffered = ref(0)
const hasPc = ref(false)
const connState = ref('-')

const stat = reactive({ width: 0, height: 0, fps: 0, kbps: 0, lost: 0, rtt: 0, jitter: 0 })

let pc: RTCPeerConnection | null = null
let statTimer = 0
let watchdog = 0
let prevBytes = 0
let prevTs = 0

const statsText = computed(() =>
  [
    stat.width ? `${stat.width}x${stat.height}` : '',
    stat.fps ? `${stat.fps}fps` : '',
    stat.kbps ? `${stat.kbps.toFixed(0)} kbps` : '',
    stat.rtt ? `RTT ${stat.rtt}ms` : '',
    stat.lost ? `丢包 ${stat.lost}` : '',
    stat.jitter ? `抖动 ${stat.jitter}ms` : '',
    connState.value === '-' ? '' : connState.value,
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
  stat.jitter = 0
  current.value = 0
  buffered.value = 0
  connState.value = '-'
  prevBytes = 0
  prevTs = 0
}

function fail(msg: string) {
  clearWatchdog()
  status.value = 'error'
  statusText.value = '连接失败'
  errorMsg.value = msg
  pushLog('error', msg)
}

/** token 只是拼查询串，服务端怎么校验由后端约定 */
function withToken(raw: string) {
  const token = form.token.trim()
  if (!token) return raw
  const sep = raw.includes('?') ? '&' : '?'
  return `${raw}${sep}token=${encodeURIComponent(token)}`
}

function startWatchdog() {
  clearWatchdog()
  watchdog = window.setTimeout(() => {
    if (status.value !== 'loading') return
    fail(
      `等待协商超时（${form.timeout}s）：先确认服务端在跑、地址里的 app/stream 已推流；` +
        '再看 CORS 是否放行、页面是否 https（https 页面不能 POST http 接口），' +
        '以及 rtc.externIP / UDP 端口是否可从浏览器侧访问。',
    )
  }, form.timeout * 1000)
}

function explain(e: unknown): string {
  const err = e as any
  if (err?.name === 'AbortError') {
    return `SDP 交换超时（${form.timeout}s）：服务端没有响应。确认接口地址可达、CORS 放行、流已推上去。`
  }
  if (err instanceof TypeError) {
    return `SDP 交换请求失败（${err.message}）：多为地址不可达或没有 CORS 响应头；https 页面不能请求 http 接口。`
  }
  return err?.message || String(err)
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

async function tryPlay() {
  const v = videoRef.value
  if (!v) return
  v.muted = form.muted
  try {
    await v.play()
    playing.value = true
  } catch {
    // 自动播放被拦：保留画面静音提示，等用户点一下画面
    playing.value = false
    statusText.value = '已连接，点击画面播放（可能被自动播放策略拦截）'
  }
}

function bindPc(connection: RTCPeerConnection) {
  connection.ontrack = (event) => {
    const v = videoRef.value
    if (!v) return
    const stream = event.streams[0] ?? new MediaStream([event.track])
    if (v.srcObject !== stream) v.srcObject = stream
    clearWatchdog()
    status.value = 'ready'
    statusText.value = '已接收远端流，等待首帧…'
    applyTrackStat(event.track.getSettings?.())
    pushLog(
      'track',
      `${event.track.kind} · 流内 ${stream.getVideoTracks().length} 视频 / ${stream.getAudioTracks().length} 音频`,
    )
    void tryPlay()
  }

  connection.onconnectionstatechange = () => {
    const state = connection.connectionState
    connState.value = state
    pushLog('pc', state)
    if (state === 'connected') {
      clearWatchdog()
      status.value = 'ready'
      // 已经起播就别把「播放中」覆盖掉
      if (statusText.value !== '播放中') statusText.value = '已连接，等待首帧…'
    }
    if (state === 'disconnected') statusText.value = '连接中断，等待恢复…'
    if (state === 'failed') {
      fail('ICE 连接失败：服务端 rtc.externIP 多半还是内网地址，或 UDP/TCP 端口被防火墙拦了。')
    }
    if (state === 'closed' && status.value !== 'error') statusText.value = '连接已关闭'
  }

  connection.oniceconnectionstatechange = () => {
    pushLog('ice', connection.iceConnectionState)
    if (connection.iceConnectionState === 'failed') {
      fail('ICE 协商失败：检查 rtc.externIP、UDP/TCP 端口与 ICE 服务器配置。')
    }
  }

  connection.onicecandidateerror = (e) => {
    pushLog('candidate', `${(e as RTCPeerConnectionIceErrorEvent).errorCode ?? '-'} ${e.errorText || '收集失败'}`)
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

  if (!pc || pc.connectionState === 'closed') return
  connState.value = pc.connectionState
  try {
    const report = await pc.getStats()
    report.forEach((r: any) => {
      if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
        if (r.frameWidth) stat.width = r.frameWidth
        if (r.frameHeight) stat.height = r.frameHeight
        if (r.framesPerSecond) stat.fps = Math.round(r.framesPerSecond)
        if (typeof r.packetsLost === 'number') stat.lost = r.packetsLost
        if (typeof r.jitter === 'number') stat.jitter = Math.round(r.jitter * 1000)
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
    /* 切换连接时 getStats 会短暂失败，忽略 */
  }
}

function startStats() {
  window.clearInterval(statTimer)
  statTimer = window.setInterval(() => void pollStats(), 1000)
}

function disconnect(silent = true) {
  clearWatchdog()
  window.clearInterval(statTimer)
  statTimer = 0

  const connection = pc
  pc = null
  hasPc.value = false

  if (connection) {
    connection.ontrack = null
    connection.onconnectionstatechange = null
    connection.oniceconnectionstatechange = null
    connection.onicecandidateerror = null
    try {
      connection.close()
    } catch {
      /* 已关闭的 pc 重复 close 会抛错 */
    }
  }

  const v = videoRef.value
  if (v) {
    v.pause()
    stopStream(v.srcObject as MediaStream | null)
    v.srcObject = null
  }

  playing.value = false
  resetStats()
  if (!silent) return

  status.value = 'ready'
  statusText.value = '已断开'
  pushLog('close', '已关闭 RTCPeerConnection 并停止接收')
}

async function connect() {
  const url = withToken(form.url.trim())
  if (!url) {
    ElMessage.warning('请先填写 SDP 交换地址')
    return
  }
  if (!isWebRtcSupported()) {
    fail('当前浏览器不支持 WebRTC：没有可用的 RTCPeerConnection（http 页面或浏览器过旧）')
    return
  }

  disconnect(false)
  resetStats()
  status.value = 'loading'
  errorMsg.value = ''
  statusText.value = '正在创建 RTCPeerConnection…'

  const connection = new RTCPeerConnection({
    iceServers: parseIceServers(form.iceServers),
    bundlePolicy: 'max-bundle',
  })
  pc = connection
  hasPc.value = true

  // 只收不发：没有这条 recvonly 的 m-line，createOffer 出来是空的，服务端无从下发
  connection.addTransceiver('video', { direction: 'recvonly' })
  if (form.recvAudio) connection.addTransceiver('audio', { direction: 'recvonly' })

  bindPc(connection)
  startWatchdog()
  startStats()
  pushLog('open', `${form.mode} · recvonly${form.recvAudio ? ' +audio' : ''}`)

  try {
    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    pushLog('sdp', `offer ${offer.sdp?.length ?? 0}B，等待 ICE 收集…`)

    // WHEP 与 ZLM 都是非 trickle：offer 里必须自带 candidate
    await waitIceGathering(connection, form.iceWait * 1000)
    const local = connection.localDescription?.sdp || offer.sdp || ''
    if (!local) throw new Error('createOffer 没有产出 SDP')

    statusText.value = '正在交换 SDP…'
    const answer = await exchangeSdp({
      mode: form.mode,
      url,
      offer: local,
      timeout: form.timeout * 1000,
    })

    if (!answer.sdp) {
      const hint =
        form.mode === 'zlm'
          ? 'ZLMediaKit 的 code != 0，读 msg 看是流不存在还是 app/stream 不匹配'
          : '服务端响应里没有 SDP（v=0 开头），确认接口与 Content-Type 是否匹配'
      throw new Error(`${hint}：${answer.raw.slice(0, 160) || '空响应'}`)
    }

    pushLog(
      'sdp',
      `answer ${answer.sdp.length}B（HTTP ${answer.status}${answer.location ? ` · Location ${answer.location}` : ''}）`,
    )
    await connection.setRemoteDescription({ type: 'answer', sdp: answer.sdp })
    statusText.value = '已交换 SDP，等待远端流…'
  } catch (e) {
    disconnect(false)
    fail(explain(e))
  }
}

function choosePreset(value: string | number | boolean | undefined) {
  const item = PRESETS.find((p) => p.url === value || p.label === value)
  if (!item) return
  form.preset = item.url || item.label
  form.mode = item.mode
  if (!item.url) {
    ElMessage.info('把地址改成自己的 SDP 交换接口（WHEP 或自建 POST 接口）后再点「连接」')
    return
  }
  form.url = item.url
  void connect()
}

/** 按当前模式把「服务器 + app + stream」拼成接口地址 */
function composeUrl() {
  const server = form.server.trim().replace(/\/+$/, '')
  const app = form.app.trim()
  const stream = form.stream.trim()
  if (!server || !app || !stream) {
    ElMessage.warning('服务器、app、stream 都要填')
    return
  }
  if (form.mode === 'zlm') {
    form.url = `${server}/index/api/webrtc?app=${encodeURIComponent(app)}&stream=${encodeURIComponent(stream)}&type=play`
  } else if (form.mode === 'whep') {
    // WHEP 的路径由服务端约定：MediaMTX 是 /<path>/whep，这里的 path 就是 stream
    form.url = `${server}/${encodeURIComponent(stream)}/whep`
  } else {
    form.url = server
  }
  form.preset = ''
  void connect()
}

function togglePlay() {
  const v = videoRef.value
  if (!v) return
  if (!hasPc.value || !v.srcObject) return void connect()
  if (v.paused) void tryPlay()
  else {
    // WebRTC 没有暂停拉流：这里只停渲染，连接与传输还在
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
  a.download = `webrtc-${Date.now()}.png`
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

onBeforeUnmount(() => disconnect(false))
</script>

<template>
  <PlayerShell
    :status="status"
    :status-text="statusText"
    :error-msg="errorMsg"
    :logs="logs"
    :blocks="guideBlocks"
    :notes="notes"
    notes-tip="以下是原生 WebRTC 拉流的协议细节与高频问题，按「建连接 → 换 SDP → 排错」的顺序整理。"
    error-tip="先确认服务端在跑且已往 `app/stream` 推流；再看接口是否放行 `CORS`、页面是否 https、`rtc.externIP` 与 UDP/TCP 端口是否可达。"
    @retry="connect"
    @clear="logs = []"
  >
    <template #hint>
      原生 WebRTC 示例：不引入任何播放器库，直接用 <code class="inline-code">RTCPeerConnection</code> +
      <code class="inline-code">fetch</code> 完成 SDP 交换（WHEP / ZLMediaKit / 自定义接口），端到端延迟通常
      200ms 以内。
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
          <span class="label">SDP 交换地址</span>
          <el-input
            v-model="form.url"
            size="small"
            placeholder="http://host:8080/index/api/webrtc?app=live&stream=test&type=play"
            @keyup.enter="connect"
          />
        </label>
        <label class="field mode">
          <span class="label">交换方式</span>
          <el-select v-model="form.mode" size="small">
            <el-option v-for="m in MODE_OPTIONS" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </label>
        <label class="field tiny">
          <span class="label">token</span>
          <el-input v-model="form.token" size="small" placeholder="可选" />
        </label>
        <el-button type="primary" size="small" @click="connect">连接</el-button>
        <el-button size="small" @click="disconnect()">断开</el-button>
      </div>

      <div class="field-row">
        <label class="field">
          <span class="label">示例</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in PRESETS" :key="p.label" :label="p.label" :value="p.url || p.label" />
          </el-select>
        </label>
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
        <el-button size="small" :disabled="!hasPc" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
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
        <span class="label">接收音频</span>
        <el-switch v-model="form.recvAudio" size="small" :disabled="status === 'loading'" />
        <span class="divider" />
        <label class="field ice">
          <span class="label">ICE 服务器（留空 = 仅 host candidate）</span>
          <el-input v-model="form.iceServers" size="small" placeholder="stun:stun.l.google.com:19302" />
        </label>
        <span class="divider" />
        <span class="label">超时</span>
        <el-select v-model="form.timeout" size="small" class="narrow" :disabled="status === 'loading'">
          <el-option :value="5" label="5s" />
          <el-option :value="10" label="10s" />
          <el-option :value="20" label="20s" />
        </el-select>
      </div>

      <div class="progress-row">
        <span class="time">{{ fmtTime(current) }}</span>
        <el-slider class="progress" :model-value="0" :max="1" disabled :show-tooltip="false" />
        <span class="time">LIVE</span>
      </div>

      <div class="stats">{{ statsText }}</div>
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
  flex: 0 1 170px;
  min-width: 150px;
  flex-direction: column;
  gap: 3px;
}
.field.grow {
  flex: 1 1 340px;
  min-width: 240px;
}
.field.mode {
  flex: 0 0 130px;
  min-width: 130px;
}
.field.server {
  flex: 1 1 220px;
  min-width: 180px;
}
.field.tiny {
  flex: 0 0 92px;
  min-width: 92px;
}
.field.ice {
  flex: 1 1 220px;
  min-width: 180px;
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
.narrow {
  width: 78px;
}
.stats {
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
