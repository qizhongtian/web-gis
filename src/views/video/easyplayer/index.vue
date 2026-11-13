<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'
import {
  isEasyPlayerReady,
  loadEasyPlayer,
  type EasyPlayerProConfig,
  type EasyPlayerProInstance,
} from '@/utils/video/easyplayer'

/** 公网公开测试源：HLS 点播 / MP4 点播 / FLV 点播（阿里云示例） */
const PRESETS = [
  {
    // 默认放 MP4：jsDelivr 带 ACAO: * 且支持 Range，最稳。
    // 很多免版权站（media.w3.org 等）不放行跨域，点播走 XHR 拉片会直接失败
    label: 'MP4 点播 · Big Buck Bunny（推荐）',
    url: 'https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4',
    live: false,
  },
  {
    label: 'HLS 点播 · Mux 多码率',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    live: false,
  },
  {
    label: 'FLV 点播 · 阿里云示例',
    url: 'https://player.alicdn.com/video/aliyunmedia.flv',
    live: true,
  },
  {
    label: '自定义 http-flv / ws-flv 直播地址',
    url: '',
    live: true,
  },
]

type DecodeMode = 'MSE' | 'WASM' | 'WASMSIMD' | 'WCS'

const hostRef = ref<HTMLElement>()

const form = reactive({
  url: PRESETS[0].url,
  preset: PRESETS[0].url,
  isLive: false,
  hasAudio: false,
  muted: true,
  stretch: true,
  bufferTime: 0.5,
  decode: 'MSE' as DecodeMode,
  watermark: '',
  rate: 1,
})

const status = ref<'loading' | 'ready' | 'error'>('loading')
const statusText = ref('等待加载')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const buffered = ref(0)
const media = reactive({ width: 0, height: 0 })
const stat = reactive({ dropped: 0, total: 0 })

let player: EasyPlayerProInstance | null = null
let statTimer = 0

const statsText = computed(() =>
  [
    media.width ? `${media.width}x${media.height}` : '',
    // 直播看缓冲，点播看进度；HLS 点播拿不到总时长时退回已播时间
    form.isLive
      ? `缓存 ${buffered.value.toFixed(1)}s`
      : duration.value
        ? `进度 ${Math.min(100, (current.value / duration.value) * 100).toFixed(0)}%`
        : `已播 ${fmtTime(current.value)}`,
    stat.total ? `帧 ${stat.total}` : '',
    stat.dropped ? `丢帧 ${stat.dropped}` : '',
    form.decode,
  ]
    .filter(Boolean)
    .join(' · '),
)

/** 只有真正的 mp4 / m3u8 文件才走 playback()，其它（flv / 直播）一律 play() */
const playAsVod = computed(() => !form.isLive && /\.mp4|\.m3u8/i.test(form.url))

function pushLog(type: string, text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  // 库里 play 事件会连发两次，同一秒内的重复事件只记一条
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

/** 播放器内部自己插 <video>（MSE）或 <canvas>（WASM 软解），这里按需取用 */
function innerVideo() {
  return hostRef.value?.querySelector<HTMLVideoElement>('video') ?? null
}

function buildConfig(): EasyPlayerProConfig {
  return {
    // 非点播文件必须为 true，否则 play() 会走点播分支校验 mp4 / m3u8 直接失败
    isLive: !playAsVod.value,
    hasAudio: form.hasAudio,
    isMute: form.muted,
    // 注意：库内语义相反，stretch=false 才是「拉伸铺满」
    stretch: !form.stretch,
    bufferTime: Number(form.bufferTime),
    loadTimeOut: 20,
    loadTimeReplay: 3,
    isBand: true,
    lang: 'zh',
    debug: false,
    MSE: form.decode === 'MSE',
    WASM: form.decode === 'WASM',
    WASMSIMD: form.decode === 'WASMSIMD',
    WCS: form.decode === 'WCS',
    btns: {
      play: true,
      audio: form.hasAudio,
      stretch: true,
      screenshot: true,
      fullscreen: true,
      record: false,
      zoom: false,
      ptz: false,
      quality: false,
    },
    ...(form.watermark.trim()
      ? {
          watermark: {
            text: { content: form.watermark.trim() },
            right: 10,
            top: 10,
          },
        }
      : {}),
  }
}

function destroyPlayer() {
  if (player) {
    try {
      player.destroy()
    } catch {
      /* 销毁阶段异常忽略 */
    }
    player = null
  }
  // 连带挂载点一起丢掉，下次起播用新节点，避免库在同一容器上残留内部状态
  if (hostRef.value) hostRef.value.innerHTML = ''
  playing.value = false
}

function startStats() {
  window.clearInterval(statTimer)
  statTimer = window.setInterval(() => {
    const v = innerVideo()
    if (!v) return
    duration.value = Number.isFinite(v.duration) ? v.duration : 0
    current.value = v.currentTime || 0
    media.width = v.videoWidth || media.width
    media.height = v.videoHeight || media.height
    const b = v.buffered
    buffered.value = b.length ? Math.max(0, b.end(b.length - 1) - v.currentTime) : 0
    const q = v.getVideoPlaybackQuality?.()
    if (q) {
      stat.total = q.totalVideoFrames
      stat.dropped = q.droppedVideoFrames
    }
  }, 500)
}

function bindEvents(instance: EasyPlayerProInstance) {
  instance.on('play', () => {
    playing.value = true
    status.value = 'ready'
    statusText.value = playAsVod.value ? '点播播放中' : '直播播放中'
    pushLog('play', playAsVod.value ? '点播起播' : '直播起播')
  })
  instance.on('pause', () => {
    playing.value = false
    statusText.value = '已暂停'
    pushLog('pause', '暂停')
  })
  instance.on('error', (error: unknown) => {
    const msg = (error as Error)?.message || String(error)
    status.value = 'error'
    errorMsg.value = msg
    pushLog('error', msg)
  })
  instance.on('timeout', () => {
    // HLS 点播起播后库里的计时器偶尔还会走到超时，已经在播就别再报错吞掉画面
    if (playing.value) {
      pushLog('timeout', '已起播，忽略播放器内部超时回调')
      return
    }
    status.value = 'error'
    errorMsg.value = '加载超时：地址不可达、跨域被拦，或编码不受支持'
    pushLog('timeout', errorMsg.value)
  })
  instance.on('liveEnd', () => {
    playing.value = false
    statusText.value = '流已结束'
    pushLog('liveEnd', '直播结束 / 流被关闭')
  })
  instance.on('timestamps', (seconds: number) => {
    if (typeof seconds === 'number' && Number.isFinite(seconds)) current.value = seconds
  })
}

async function load() {
  const url = form.url.trim()
  if (!url) {
    ElMessage.warning('请填写流地址')
    return
  }

  destroyPlayer()
  status.value = 'loading'
  errorMsg.value = ''

  if (!isEasyPlayerReady()) {
    statusText.value = '正在加载播放器（约 3.6 MB）…'
    try {
      await loadEasyPlayer()
    } catch (e: any) {
      status.value = 'error'
      errorMsg.value = e?.message || String(e)
      pushLog('error', errorMsg.value)
      return
    }
  }

  const Ctor = window.EasyPlayerPro
  const host = hostRef.value
  if (!Ctor || !host) {
    status.value = 'error'
    errorMsg.value = '播放器未就绪：window.EasyPlayerPro 不存在'
    return
  }

  statusText.value = playAsVod.value ? '正在加载视频…' : '正在拉流…'

  try {
    // 每次起播都用全新的挂载点：复用同一个元素时库会残留内部状态，
    // 第二次 new 直接报 `EasyPlayerPro err container` 且不出画面
    const mount = document.createElement('div')
    mount.className = 'easy-mount'
    host.appendChild(mount)

    const instance = new Ctor(mount, buildConfig())
    player = instance
    bindEvents(instance)
    startStats()
    pushLog('load', `${playAsVod.value ? '点播' : '直播'} · ${url.length > 52 ? `${url.slice(0, 52)}…` : url}`)

    if (playAsVod.value && typeof instance.playback === 'function') {
      await instance.playback(url)
    } else {
      await instance.play(url)
    }

    // 起播成功但没等到 play 事件时给个可读状态，
    // 否则不要覆盖事件里写的「点播播放中 / 直播播放中」
    status.value = 'ready'
    if (!playing.value) statusText.value = playAsVod.value ? '已加载，可播放' : '拉流中'
  } catch (e: any) {
    const msg = e?.message || String(e)
    status.value = 'error'
    errorMsg.value = msg
    pushLog('error', msg)
  }
}

function stop() {
  destroyPlayer()
  window.clearInterval(statTimer)
  current.value = 0
  duration.value = 0
  buffered.value = 0
  status.value = 'ready'
  statusText.value = '已停止'
  pushLog('stop', '已销毁播放器实例，解码线程随实例释放')
}

function togglePlay() {
  if (!player) return load()
  const v = innerVideo()
  const paused = v ? v.paused : !playing.value
  if (paused) {
    // 用底层 video 续播：不重连、不重抓流头；WASM 软解没有 video 时才回落到 play()
    if (v) {
      void v
        .play()
        .then(() => {
          playing.value = true
          statusText.value = playAsVod.value ? '点播播放中' : '直播播放中'
        })
        .catch(() => {})
    } else {
      player.play(form.url).catch(() => {})
    }
    pushLog('resume', '继续播放')
  } else {
    // 走播放器自己的 pause()，同时驱动它内部工具条与事件
    player.pause()
    if (v) v.pause()
    playing.value = false
    statusText.value = '已暂停'
    pushLog('pause', '暂停')
  }
}

function toggleMute() {
  form.muted = !form.muted
  player?.setMute(form.muted)
  const v = innerVideo()
  if (v) v.muted = form.muted
  pushLog('mute', form.muted ? '已静音' : '取消静音')
}

function setRate(value: string | number | boolean | undefined) {
  const rate = Number(value)
  form.rate = rate
  if (rate === 1) {
    const v = innerVideo()
    if (v) v.playbackRate = 1
  }
  // setRate 只对点播生效，实时流会 reject
  Promise.resolve(player?.setRate(rate)).catch(() => ElMessage.warning('实时流不支持倍速'))
}

function seek(value: number | number[]) {
  const v = innerVideo()
  if (!v || !duration.value) return
  v.currentTime = Number(Array.isArray(value) ? value[0] : value)
}

async function snapshot() {
  if (!player) return ElMessage.warning('请先加载播放器')
  try {
    const result = await player.screenshot(`easyplayer-${Date.now()}`, 'png', 0.92, 'base64')
    if (typeof result !== 'string' || !result) return ElMessage.warning('截图失败：当前渲染方式不支持')
    const a = document.createElement('a')
    a.href = result.startsWith('data:') ? result : `data:image/png;base64,${result}`
    a.download = `easyplayer-${Date.now()}.png`
    a.click()
    pushLog('screenshot', '已导出 PNG')
  } catch (e: any) {
    ElMessage.warning(e?.message || '截图失败')
  }
}

function toggleFullscreen() {
  if (!player) return ElMessage.warning('请先加载播放器')
  const flag = !document.fullscreenElement
  player.setFullscreen(flag)
  pushLog('fullscreen', flag ? '进入全屏' : '退出全屏')
}

function choosePreset(url: string | number | boolean | undefined) {
  const item = PRESETS.find((p) => p.url === url || p.label === url)
  if (!item) return
  form.preset = item.url || item.label
  if (!item.url) {
    form.url = 'http://your-host:8090/live/stream.flv'
    ElMessage.info('把地址换成自己的 http-flv / ws-flv 直播地址后再点「加载播放」')
    return
  }
  form.url = item.url
  form.isLive = item.live
  load()
}

/** 参数变了必须销毁重建：库没有换流 / 换解码方法，复用实例会把旧解码线程留在后台 */
function recreate() {
  if (player) load()
}

onMounted(() => load())

onBeforeUnmount(() => {
  window.clearInterval(statTimer)
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
    notes-tip="以下为 EasyPlayer.js 接入的高频问题，按「先能播、再播好、再排错」的顺序整理。"
    error-tip="先确认 `EasyPlayer-pro.js` 与同目录的 `EasyPlayer-lib.js`、`*.wasm` 都发布成功；再看流地址是否跨域放行、编码是否为 H.264 / H.265。"
    @retry="load()"
    @clear="logs = []"
  >
    <template #hint>
      EasyPlayer.js 示例：一个播放器同时吃 HLS / FLV / MP4 / WebRTC，H.265 走 WASM 软解；顶部参数可切直播点播、解码方式、缓冲与拉伸。
    </template>

    <template #stage>
      <!-- 播放器自己往这个容器里插 video / canvas 与工具条 -->
      <div ref="hostRef" class="easy-host" />
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">流地址（m3u8 / mp4 / flv / ws-flv）</span>
          <el-input v-model="form.url" size="small" placeholder="https://host/live/stream.m3u8" @keyup.enter="load()" />
        </label>
        <label class="field">
          <span class="label">示例</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in PRESETS" :key="p.label" :label="p.label" :value="p.url || p.label" />
          </el-select>
        </label>
        <el-button type="primary" size="small" @click="load()">加载播放</el-button>
        <el-button size="small" @click="stop">停止</el-button>
      </div>

      <div class="btn-row">
        <el-button size="small" :disabled="!player" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
        <span class="divider" />
        <el-button size="small" :disabled="!form.hasAudio" @click="toggleMute">{{ form.muted ? '取消静音' : '静音' }}</el-button>
        <span class="divider" />
        <span class="label">倍速</span>
        <el-select :model-value="form.rate" size="small" class="narrow" :disabled="form.isLive" @update:model-value="setRate">
          <el-option :value="0.5" label="0.5x" />
          <el-option :value="1" label="1x" />
          <el-option :value="2" label="2x" />
          <el-option :value="4" label="4x" />
          <el-option :value="8" label="8x" />
        </el-select>
        <span class="divider" />
        <el-button size="small" @click="snapshot">截图</el-button>
        <el-button size="small" @click="toggleFullscreen">全屏</el-button>
      </div>

      <div class="btn-row">
        <span class="label">直播 / 点播</span>
        <el-switch v-model="form.isLive" size="small" @change="recreate" />
        <span class="divider" />
        <span class="label">解析音频</span>
        <el-switch v-model="form.hasAudio" size="small" @change="recreate" />
        <span class="label">拉伸铺满</span>
        <el-switch v-model="form.stretch" size="small" @change="recreate" />
        <span class="divider" />
        <span class="label">解码</span>
        <el-select v-model="form.decode" size="small" class="narrow" @change="recreate">
          <el-option value="MSE" label="MSE 硬解" />
          <el-option value="WCS" label="WebCodecs" />
          <el-option value="WASM" label="WASM" />
          <el-option value="WASMSIMD" label="WASM SIMD" />
        </el-select>
        <span class="label">缓冲</span>
        <el-select v-model="form.bufferTime" size="small" class="narrow" @change="recreate">
          <el-option :value="0.2" label="0.2s" />
          <el-option :value="0.5" label="0.5s" />
          <el-option :value="1" label="1s" />
          <el-option :value="2" label="2s" />
        </el-select>
        <el-input
          v-model="form.watermark"
          size="small"
          class="wm"
          placeholder="水印文字"
          @change="recreate"
        />
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
        <span class="time">{{ form.isLive ? 'LIVE' : duration ? fmtTime(duration) : '--:--' }}</span>
      </div>

      <div class="btn-row">
        <span class="stats">{{ statsText }}</span>
        <span class="label">{{ playAsVod ? 'playback()' : 'play()' }}</span>
      </div>
    </template>
  </PlayerShell>
</template>

<style scoped>
.easy-host {
  position: absolute;
  inset: 0;
  background: #000;
}
.easy-host :deep(.easy-mount) {
  position: absolute;
  inset: 0;
}
/* 库起来之前先按 fill 渲染，不留黑边；库接管后会用内联样式覆盖 */
.easy-host :deep(video),
.easy-host :deep(canvas) {
  object-fit: fill;
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
.narrow {
  width: 96px;
}
.wm {
  width: 120px;
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
