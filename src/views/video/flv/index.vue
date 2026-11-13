<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import flvjs from 'flv.js'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'

type FlvPlayer = ReturnType<typeof flvjs.createPlayer>

/** MEDIA_INFO / STATISTICS_INFO 回调里页面用到的字段 */
interface FlvMediaInfo {
  width?: number
  height?: number
  fps?: number
  videoCodec?: string
  audioCodec?: string
}
interface FlvStatisticsInfo {
  speed?: number
  decodedFrames?: number
  droppedFrames?: number
}

/** 公网示例：H.264 + AAC、支持 Range、Access-Control-Allow-Origin: * */
const SAMPLE_FLV = 'https://player.alicdn.com/video/aliyunmedia.flv'

const videoRef = ref<HTMLVideoElement>()
const fileRef = ref<HTMLInputElement>()

const form = reactive({
  url: SAMPLE_FLV,
  /** 直播流：关缓冲、自动清 buffer */
  isLive: false,
  /** 低延迟：enableStashBuffer=false + autoCleanupSourceBuffer=true */
  lowLatency: false,
  /** Worker 解封装：flv.js 1.6.2 在较新 Chromium 上 worker 内会报 `Class extends value undefined`，默认关闭 */
  enableWorker: false,
  stashInitialSize: 384,
  loop: false,
  rate: 1,
  preset: SAMPLE_FLV,
})

const presets = [
  { label: '在线示例（点播 H.264 + AAC）', url: SAMPLE_FLV, live: false },
  { label: '自定义 http-flv 直播地址', url: '', live: true },
]

const status = ref<'loading' | 'ready' | 'error'>('loading')
const statusText = ref('等待加载')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const muted = ref(false)
const volume = ref(60)
const current = ref(0)
const duration = ref(0)
const buffered = ref(0)

const media = reactive({ width: 0, height: 0, fps: 0, videoCodec: '-', audioCodec: '-' })
const stat = reactive({ speed: 0, decoded: 0, dropped: 0 })

let player: FlvPlayer | null = null
let objectUrl = ''
let statTimer = 0

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

const statsText = computed(() =>
  [
    `${media.width}x${media.height}`,
    media.fps ? `${Math.round(media.fps)}fps` : '',
    stat.speed ? `${stat.speed.toFixed(0)} KB/s` : '',
    `缓存 ${buffered.value.toFixed(1)}s`,
    `解码 ${stat.decoded}`,
    `丢帧 ${stat.dropped}`,
  ]
    .filter(Boolean)
    .join(' · '),
)

function bindEvents(p: FlvPlayer) {
  const api = flvjs
  p.on(api.Events.ERROR, (type: string, detail: string, info: any) => {
    status.value = 'error'
    const msg = `${type} / ${detail}${info?.msg ? ` - ${info.msg}` : ''}`
    errorMsg.value = msg
    pushLog('ERROR', msg)
  })
  p.on(api.Events.LOADING_COMPLETE, () => {
    statusText.value = '流已结束'
    pushLog('LOADING_COMPLETE', '数据加载完毕')
  })
  p.on(api.Events.RECOVERED_EARLY_EOF, () => pushLog('RECOVERED_EOF', '网络中断后自动恢复'))
  p.on(api.Events.MEDIA_INFO, (info: FlvMediaInfo) => {
    media.width = info.width || 0
    media.height = info.height || 0
    media.fps = info.fps || 0
    media.videoCodec = info.videoCodec || '-'
    media.audioCodec = info.audioCodec || '-'
    pushLog('MEDIA_INFO', `${media.videoCodec} ${media.width}x${media.height} / ${media.audioCodec}`)
  })
  p.on(api.Events.STATISTICS_INFO, (info: FlvStatisticsInfo) => {
    stat.speed = info.speed || 0
    stat.decoded = info.decodedFrames || 0
    stat.dropped = info.droppedFrames || 0
  })
}

function destroyPlayer() {
  if (player) {
    try {
      player.pause()
      player.unload()
      player.detachMediaElement()
      player.destroy()
    } catch {
      /* 忽略销毁阶段的异常 */
    }
    player = null
  }
  playing.value = false
}

function startStats() {
  window.clearInterval(statTimer)
  statTimer = window.setInterval(() => {
    const v = videoRef.value
    if (!v) return
    duration.value = Number.isFinite(v.duration) ? v.duration : 0
    current.value = v.currentTime
    const b = v.buffered
    buffered.value = b.length ? Math.max(0, b.end(b.length - 1) - v.currentTime) : 0
  }, 500)
}

async function load(autoPlay = true) {
  const url = form.url.trim()
  if (!url) {
    ElMessage.warning('请填写 flv 地址')
    return
  }

  destroyPlayer()
  status.value = 'loading'
  errorMsg.value = ''

  if (!flvjs.isSupported()) {
    status.value = 'error'
    errorMsg.value = '当前浏览器不支持 MSE（flvjs.isSupported() === false），iOS Safari 无法播放 FLV'
    pushLog('error', errorMsg.value)
    return
  }

  statusText.value = form.isLive ? '正在拉起直播流…' : '正在加载视频…'
  try {
    player = flvjs.createPlayer(
      {
        type: 'flv',
        url,
        isLive: form.isLive,
        cors: true,
        hasAudio: true,
        hasVideo: true,
      },
      {
        enableWorker: form.enableWorker,
        enableStashBuffer: !form.lowLatency && !form.isLive,
        stashInitialSize: Number(form.stashInitialSize),
        lazyLoad: !form.isLive,
        autoCleanupSourceBuffer: form.lowLatency || form.isLive,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 10,
      },
    )
    bindEvents(player)
    player.attachMediaElement(videoRef.value!)
    player.load()
    if (autoPlay) player.play()
    statusText.value = form.isLive ? '直播拉流中' : '已加载，可播放'
    // load() 期间可能同步触发 ERROR，此时保留错误态
    if (!errorMsg.value) status.value = 'ready'
    pushLog('load', `${form.isLive ? '直播' : '点播'} · ${url.length > 48 ? `${url.slice(0, 48)}…` : url}`)
    startStats()
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message || String(e)
    pushLog('error', errorMsg.value)
  }
}

function togglePlay() {
  const v = videoRef.value
  if (!v) return
  if (!player) return load()
  if (v.paused) player.play()
  else player.pause()
}

function stop() {
  destroyPlayer()
  const v = videoRef.value
  if (v) {
    v.pause()
    v.removeAttribute('src')
    v.load()
  }
  status.value = 'ready'
  statusText.value = '已停止'
  current.value = 0
  buffered.value = 0
  pushLog('stop', '已销毁播放器实例')
}

function reload() {
  load(true)
}

/** 参数变更后立刻按新参数重建（在线时才有意义） */
function recreate() {
  if (player) load(!videoRef.value?.paused)
}

function choosePreset(url: string | number | boolean | undefined) {
  const item = presets.find((p) => p.url === url || p.label === url)
  if (!item) return
  if (!item.url) {
    form.url = 'https://your-host/live/stream.flv'
    ElMessage.info('把地址换成你自己的 http-flv 直播地址后再点「加载」')
  } else {
    form.url = item.url
  }
  form.isLive = item.live
  load(true)
}

function onLocalFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  form.url = objectUrl
  form.isLive = false
  form.preset = ''
  ElMessage.success(`已选择本地文件：${file.name}`)
  load(true)
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
  const v = videoRef.value
  const rate = Number(value)
  form.rate = rate
  if (v) v.playbackRate = rate
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
  a.download = `flv-${Date.now()}.png`
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
  const v = videoRef.value
  if (name === 'play') {
    playing.value = true
    statusText.value = form.isLive ? '直播中' : '播放中'
  }
  if (name === 'pause') playing.value = false
  if (name === 'ended') {
    playing.value = false
    statusText.value = '播放结束'
  }
  if (name === 'waiting') pushLog('waiting', '缓冲中…')
  if (name === 'canplay' && status.value === 'loading') status.value = 'ready'
  if (v) muted.value = v.muted
}

// 进页面就加载示例（不自动播放，避开浏览器自动播放策略）
onMounted(() => load(false))

onBeforeUnmount(() => {
  window.clearInterval(statTimer)
  destroyPlayer()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
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
    error-tip="检查 flv 地址能否直接访问、服务端是否放行 `Access-Control-Allow-Origin`，以及流是否为 H.264 + AAC 编码。"
    @retry="reload"
    @clear="logs = []"
  >
    <template #hint>
      FLV.js 示例：基于 MSE 解封装播放 <code class="inline-code">.flv</code> 与 http-flv 直播流，可切换直播/点播参数、截图、画中画；右侧为集成步骤与注意事项。
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
        @canplay="onVideoEvent('canplay')"
      />
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">flv 地址（点播 .flv 或 http-flv 直播）</span>
          <el-input v-model="form.url" size="small" placeholder="https://host/live/stream.flv" @keyup.enter="load(true)" />
        </label>
        <label class="field">
          <span class="label">示例</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in presets" :key="p.label" :label="p.label" :value="p.url" />
          </el-select>
        </label>
        <el-button size="small" @click="fileRef?.click()">本地文件</el-button>
        <input ref="fileRef" type="file" accept=".flv,video/x-flv" hidden @change="onLocalFile" />
        <el-button type="primary" size="small" @click="load(true)">加载播放</el-button>
        <el-button size="small" @click="stop">停止</el-button>
      </div>

      <div class="btn-row">
        <el-button size="small" :disabled="!player" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
        <span class="divider" />
        <span class="label">音量</span>
        <el-slider
          class="vol"
          :model-value="volume"
          size="small"
          :show-tooltip="false"
          @update:model-value="setVolume"
        />
        <el-button size="small" @click="toggleMute">{{ muted ? '取消静音' : '静音' }}</el-button>
        <span class="divider" />
        <span class="label">倍速</span>
        <el-select :model-value="form.rate" size="small" class="rate" :disabled="form.isLive" @update:model-value="setRate">
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
        <span class="label">直播流</span>
        <el-switch v-model="form.isLive" size="small" @change="recreate" />
        <span class="label">低延迟缓冲</span>
        <el-switch v-model="form.lowLatency" size="small" @change="recreate" />
        <span class="label">Worker 解封装</span>
        <el-switch v-model="form.enableWorker" size="small" @change="recreate" />
        <span class="divider" />
        <span class="label">初始缓冲</span>
        <el-select v-model="form.stashInitialSize" size="small" class="stash" @change="recreate">
          <el-option :value="128" label="128 KB" />
          <el-option :value="384" label="384 KB" />
          <el-option :value="1024" label="1 MB" />
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
          :disabled="form.isLive || !duration"
          :show-tooltip="false"
          @update:model-value="seek"
        />
        <span class="time">{{ form.isLive ? 'LIVE' : fmtTime(duration) }}</span>
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
.vol {
  width: 90px;
}
.rate {
  width: 78px;
}
.stash {
  width: 92px;
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
