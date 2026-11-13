<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Hls, { type ErrorData } from 'hls.js'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'

/** 公网可用的公开测试流（Mux / Apple，均已放行 CORS） */
const PRESETS = [
  {
    label: 'Mux · 多码率点播（推荐）',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    label: 'Mux · 单码率测试流',
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
  },
  {
    label: 'Apple · BipBop fMP4',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  },
]

interface LevelItem {
  index: number
  label: string
  bitrate: number
  height: number
}

const videoRef = ref<HTMLVideoElement>()

const form = reactive({
  url: PRESETS[0].url,
  preset: PRESETS[0].url,
  enableWorker: true,
  lowLatency: false,
  maxBuffer: 30,
  loop: false,
  rate: 1,
})

const status = ref<'loading' | 'ready' | 'error'>('loading')
const statusText = ref('等待加载')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const muted = ref(false)
const volume = ref(60)
const current = ref(0)
const duration = ref(0)
const isLive = ref(false)

const levels = ref<LevelItem[]>([])
const level = ref(-1)
const videoInfo = reactive({ width: 0, height: 0, fps: 0 })

const stat = reactive({ bitrate: 0, bw: 0, latency: 0, buffer: 0, dropped: 0 })

let hls: Hls | null = null
let statTimer = 0

const statsText = computed(() =>
  [
    `${videoInfo.width}x${videoInfo.height}`,
    stat.bitrate ? `${Math.round(stat.bitrate / 1000)} kbps` : '',
    stat.bw ? `带宽 ${(stat.bw / 1e6).toFixed(1)} Mbps` : '',
    `缓存 ${stat.buffer.toFixed(1)}s`,
    stat.latency ? `延迟 ${stat.latency.toFixed(1)}s` : '',
    `丢帧 ${stat.dropped}`,
  ]
    .filter(Boolean)
    .join(' · '),
)

function pushLog(type: string, text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.unshift({ time, type, text })
  if (logs.value.length > 30) logs.value.pop()
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function onManifestParsed(_: unknown, data: { levels: any[] }) {
  levels.value = data.levels.map((l, i) => ({
    index: i,
    label: `${l.height ? `${l.height}p` : `档位 ${i + 1}`}${l.bitrate ? ` · ${Math.round(l.bitrate / 1000)}kbps` : ''}`,
    bitrate: l.bitrate || 0,
    height: l.height || 0,
  }))
  pushLog('MANIFEST_PARSED', `${levels.value.length} 个码率档位`)
  status.value = 'ready'
  statusText.value = '播放列表已解析'
}

function onError(_: unknown, data: ErrorData) {
  const detail = `${data.type}/${data.details}`
  if (!data.fatal) {
    pushLog('ERROR(非致命)', detail)
    return
  }
  pushLog('ERROR(fatal)', detail)
  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
    statusText.value = '网络错误，正在重试…'
    hls?.startLoad()
    return
  }
  if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    statusText.value = '解码错误，正在恢复…'
    hls?.recoverMediaError()
    return
  }
  status.value = 'error'
  errorMsg.value = detail
}

function bindEvents(instance: Hls) {
  instance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed)
  instance.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
    const info = instance.levels[data.level]
    stat.bitrate = info?.bitrate || 0
    pushLog('LEVEL_SWITCHED', `${info?.height ?? '?'}p · ${Math.round((info?.bitrate || 0) / 1000)}kbps`)
  })
  instance.on(Hls.Events.LEVEL_LOADED, (_, data) => {
    isLive.value = !!data.details.live
  })
  instance.on(Hls.Events.ERROR, onError)
}

function destroyHls() {
  if (hls) {
    try {
      hls.stopLoad()
      hls.detachMedia()
      hls.destroy()
    } catch {
      /* 忽略销毁阶段异常 */
    }
    hls = null
  }
  playing.value = false
}

function startStats() {
  window.clearInterval(statTimer)
  statTimer = window.setInterval(() => {
    const v = videoRef.value
    if (!v || !hls) return
    duration.value = Number.isFinite(v.duration) ? v.duration : 0
    current.value = v.currentTime
    videoInfo.width = v.videoWidth
    videoInfo.height = v.videoHeight
    stat.bw = hls.bandwidthEstimate || 0
    stat.latency = Number.isFinite(hls.latency) ? hls.latency : 0
    const b = v.buffered
    stat.buffer = b.length ? Math.max(0, b.end(b.length - 1) - v.currentTime) : 0
    const quality = v.getVideoPlaybackQuality?.()
    stat.dropped = quality?.droppedVideoFrames ?? 0
  }, 1000)
}

function load(autoPlay = true) {
  const url = form.url.trim()
  if (!url) return ElMessage.warning('请填写 m3u8 地址')

  destroyHls()
  levels.value = []
  level.value = -1
  status.value = 'loading'
  errorMsg.value = ''
  statusText.value = '正在加载播放列表…'

  const video = videoRef.value!
  try {
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: form.enableWorker,
        lowLatencyMode: form.lowLatency,
        maxBufferLength: Number(form.maxBuffer),
        backBufferLength: 30,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
      })
      bindEvents(hls)
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (autoPlay) video.play().catch(() => undefined)
      })
      pushLog('load', `hls.js · ${url.length > 46 ? `${url.slice(0, 46)}…` : url}`)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari：走原生 HLS
      video.src = url
      if (autoPlay) video.play().catch(() => undefined)
      status.value = 'ready'
      statusText.value = '原生 HLS 播放'
      pushLog('load', 'Safari 原生播放（无码率档位控制）')
    } else {
      status.value = 'error'
      errorMsg.value = '当前浏览器既不支持 MSE，也不支持原生 HLS'
      return
    }
    startStats()
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message || String(e)
    pushLog('error', errorMsg.value)
  }
}

function recreate() {
  if (hls) load(!videoRef.value?.paused)
}

function choosePreset(value: string | number | boolean | undefined) {
  const item = PRESETS.find((p) => p.url === value)
  if (!item) return
  form.url = item.url
  load(true)
}

function togglePlay() {
  const v = videoRef.value
  if (!v) return
  if (!hls && !v.src) return load()
  if (v.paused) v.play().catch(() => undefined)
  else v.pause()
}

function stop() {
  destroyHls()
  const v = videoRef.value
  if (v) {
    v.pause()
    v.removeAttribute('src')
    v.load()
  }
  status.value = 'ready'
  statusText.value = '已停止'
  current.value = 0
  stat.buffer = 0
  levels.value = []
  pushLog('stop', '已销毁 Hls 实例')
}

function switchLevel(value: string | number | boolean | undefined) {
  const idx = Number(value)
  level.value = idx
  if (!hls) return
  hls.currentLevel = idx
  pushLog('currentLevel', idx < 0 ? '自动（按带宽自适应）' : levels.value.find((l) => l.index === idx)?.label || String(idx))
}

function seek(value: number | number[]) {
  const v = videoRef.value
  if (!v || !duration.value) return
  v.currentTime = Number(Array.isArray(value) ? value[0] : value)
}

function setVolume(value: number | number[]) {
  const v = videoRef.value
  const val = Number(Array.isArray(value) ? value[0] : value)
  volume.value = val
  if (v) {
    v.volume = val / 100
    v.muted = val === 0
  }
  muted.value = val === 0
}

function toggleMute() {
  const v = videoRef.value
  if (!v) return
  v.muted = !v.muted
  muted.value = v.muted
}

function setRate(value: string | number | boolean | undefined) {
  const rate = Number(value)
  form.rate = rate
  if (videoRef.value) videoRef.value.playbackRate = rate
}

function toggleLoop() {
  form.loop = !form.loop
  if (videoRef.value) videoRef.value.loop = form.loop
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
  a.download = `hls-${Date.now()}.png`
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
  if (name === 'play') {
    playing.value = true
    statusText.value = isLive.value ? '直播中' : '播放中'
  }
  if (name === 'pause') playing.value = false
  if (name === 'ended') {
    playing.value = false
    statusText.value = '播放结束'
  }
  if (name === 'waiting') pushLog('waiting', '缓冲中…')
}

// 进页面就加载示例列表（不自动播放，避开浏览器自动播放策略）
onMounted(() => load(false))

onBeforeUnmount(() => {
  window.clearInterval(statTimer)
  destroyHls()
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
    error-tip="检查 m3u8 地址能否访问、列表与分片是否带 `Access-Control-Allow-Origin`，https 页面还要确认流也是 https。"
    @retry="load(true)"
    @clear="logs = []"
  >
    <template #hint>
      HLS.js 示例：播放 <code class="inline-code">m3u8</code>，支持多码率手动/自动切换、直播低延迟参数、错误自动恢复、截图与画中画；右侧为集成步骤与注意事项。
    </template>

    <template #stage>
      <video
        ref="videoRef"
        class="stage-video"
        playsinline
        @click="togglePlay"
        @play="onVideoEvent('play')"
        @pause="onVideoEvent('pause')"
        @ended="onVideoEvent('ended')"
        @waiting="onVideoEvent('waiting')"
      />
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">m3u8 地址（master 列表可切换多码率）</span>
          <el-input v-model="form.url" size="small" placeholder="https://host/live/index.m3u8" @keyup.enter="load(true)" />
        </label>
        <label class="field">
          <span class="label">示例流</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in PRESETS" :key="p.url" :label="p.label" :value="p.url" />
          </el-select>
        </label>
        <el-button type="primary" size="small" @click="load(true)">加载播放</el-button>
        <el-button size="small" @click="stop">停止</el-button>
      </div>

      <div class="btn-row">
        <el-button size="small" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
        <span class="divider" />
        <span class="label">画质</span>
        <el-select :model-value="level" size="small" class="level" :disabled="!levels.length" @update:model-value="switchLevel">
          <el-option :value="-1" label="自动" />
          <el-option v-for="l in levels" :key="l.index" :label="l.label" :value="l.index" />
        </el-select>
        <span class="divider" />
        <span class="label">音量</span>
        <el-slider class="vol" :model-value="volume" size="small" :show-tooltip="false" @update:model-value="setVolume" />
        <el-button size="small" @click="toggleMute">{{ muted ? '取消静音' : '静音' }}</el-button>
        <span class="divider" />
        <span class="label">倍速</span>
        <el-select :model-value="form.rate" size="small" class="rate" @update:model-value="setRate">
          <el-option :value="0.5" label="0.5x" />
          <el-option :value="1" label="1x" />
          <el-option :value="1.5" label="1.5x" />
          <el-option :value="2" label="2x" />
        </el-select>
        <el-button size="small" :type="form.loop ? 'primary' : 'default'" @click="toggleLoop">循环</el-button>
        <span class="divider" />
        <el-button size="small" @click="snapshot">截图</el-button>
        <el-button size="small" @click="toggleFullscreen">全屏</el-button>
        <el-button size="small" @click="togglePip">画中画</el-button>
      </div>

      <div class="btn-row">
        <span class="label">低延迟模式</span>
        <el-switch v-model="form.lowLatency" size="small" @change="recreate" />
        <span class="label">Worker</span>
        <el-switch v-model="form.enableWorker" size="small" @change="recreate" />
        <span class="divider" />
        <span class="label">缓冲上限</span>
        <el-select v-model="form.maxBuffer" size="small" class="buffer" @change="recreate">
          <el-option :value="10" label="10s" />
          <el-option :value="30" label="30s" />
          <el-option :value="60" label="60s" />
        </el-select>
        <span class="divider" />
        <span class="stats">{{ statsText }}</span>
      </div>

      <div class="progress-row">
        <span class="time">{{ fmtTime(current) }}</span>
        <el-slider
          class="progress"
          :model-value="current"
          :max="duration || 0"
          :disabled="isLive || !duration"
          :show-tooltip="false"
          @update:model-value="seek"
        />
        <span class="time">{{ isLive ? 'LIVE' : fmtTime(duration) }}</span>
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
  flex: 0 1 210px;
  min-width: 180px;
  flex-direction: column;
  gap: 3px;
}
.field.grow {
  flex: 1 1 300px;
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
.level {
  width: 170px;
}
.vol {
  width: 80px;
}
.rate {
  width: 78px;
}
.buffer {
  width: 84px;
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
