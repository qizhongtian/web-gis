<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlayerShell from '../PlayerShell.vue'
import { guideBlocks, notes } from './guide'
import type { PlayLogItem } from '../guide-types'
import {
  JESSIBUCA_CDN,
  JESSIBUCA_CDN_DECODER,
  JESSIBUCA_LOCAL,
  JESSIBUCA_LOCAL_DECODER,
  decoderOf,
  loadJessibuca,
  type JessibucaAudioInfo,
  type JessibucaInstance,
  type JessibucaStats,
  type JessibucaVideoInfo,
} from '@/utils/video/jessibuca'

/** 公网示例：H.264 + AAC 的 http-flv，用来验证链路；H.265 请换成自己的地址 */
const SAMPLE_FLV = 'https://player.alicdn.com/video/aliyunmedia.flv'

const PRESETS = [
  { label: '在线示例（H.264 http-flv）', url: SAMPLE_FLV },
  { label: '自定义 http-flv / ws-flv 直播地址', url: '' },
]

const SDK_PRESETS = [
  { value: 'local', label: '本地 · public/jessibuca/', url: JESSIBUCA_LOCAL, decoder: JESSIBUCA_LOCAL_DECODER },
  { value: 'cdn', label: 'CDN · jsDelivr v3', url: JESSIBUCA_CDN, decoder: JESSIBUCA_CDN_DECODER },
]

const hostRef = ref<HTMLElement>()

const form = reactive({
  url: SAMPLE_FLV,
  preset: SAMPLE_FLV,
  sdk: 'local' as 'cdn' | 'local' | 'custom',
  sdkUrl: JESSIBUCA_LOCAL,
  decoderUrl: JESSIBUCA_LOCAL_DECODER,
  /** 缓冲秒数：越小越实时，越容易卡 */
  videoBuffer: 1,
  /** 等比留边 / 拉伸铺满 */
  stretch: false,
  useMSE: true,
  useWCS: false,
  hasAudio: false,
  showBandwidth: true,
  debug: false,
  volume: 60,
})

const status = ref<'loading' | 'ready' | 'error'>('ready')
const statusText = ref('等待起播')
const errorMsg = ref('')
const logs = ref<PlayLogItem[]>([])
const playing = ref(false)
const muted = ref(true)
const fullscreen = ref(false)
const sdkLoaded = ref(false)

const media = reactive({ width: 0, height: 0, encType: '-', audio: '-' })
const stat = reactive({ fps: 0, kbps: 0, buffer: 0, level: -1 })

let player: JessibucaInstance | null = null

const statsText = computed(() =>
  [
    media.width ? `${media.width}x${media.height}` : '',
    media.encType !== '-' ? media.encType : '',
    stat.fps ? `${Math.round(stat.fps)}fps` : '',
    stat.kbps ? `${stat.kbps.toFixed(0)} kbps` : '',
    stat.buffer ? `缓存 ${stat.buffer.toFixed(1)}s` : '',
    stat.level >= 0 ? ['卡顿', '流畅', '很流畅'][stat.level] : '',
    form.useMSE ? 'MSE' : form.useWCS ? 'WCS' : 'wasm',
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

/** SDK 来源切换：主脚本与 decoder 必须配套，一起换 */
function applySdkPreset(value: string | number | boolean | undefined) {
  const preset = SDK_PRESETS.find((p) => p.value === value)
  form.sdk = String(value) as typeof form.sdk
  if (!preset) {
    // 自定义：按地址推断 decoder，猜不到就沿用本地路径
    form.decoderUrl = decoderOf(form.sdkUrl)
    return
  }
  form.sdkUrl = preset.url
  form.decoderUrl = preset.decoder
}

function bindEvents(p: JessibucaInstance) {
  const E = window.Jessibuca?.ERROR ?? {}

  p.on('videoInfo', (info: JessibucaVideoInfo) => {
    media.width = info.width || 0
    media.height = info.height || 0
    media.encType = info.encType || (info.encTypeCode === 12 ? 'H.265' : 'H.264')
    pushLog('videoInfo', `${media.encType} ${media.width}x${media.height}`)
  })

  p.on('audioInfo', (info: JessibucaAudioInfo) => {
    media.audio = info.encType || '-'
    pushLog('audioInfo', `${media.audio} / ${info.sampleRate ?? 0}Hz / ${info.numOfChannels ?? 0}ch`)
  })

  p.on('stats', (s: JessibucaStats) => {
    stat.fps = Number(s.fps) || 0
    stat.buffer = Number(s.buf) || 0
    stat.kbps = ((Number(s.vbps) || 0) + (Number(s.abps) || 0)) / 1024
  })

  p.on('performance', (level: number) => {
    stat.level = level
  })

  p.on('play', () => {
    playing.value = true
    status.value = 'ready'
    statusText.value = '播放中'
    pushLog('play', '已起播')
  })

  p.on('pause', () => {
    playing.value = false
    statusText.value = '已暂停'
    pushLog('pause', '已暂停')
  })

  p.on('start', () => {
    pushLog('start', '首帧已渲染')
  })

  p.on('fullscreen', (flag: boolean) => {
    fullscreen.value = !!flag
    pushLog('fullscreen', flag ? '进入全屏' : '退出全屏')
  })

  p.on('mute', (flag: boolean) => {
    muted.value = !!flag
  })

  // v3 的 kBps 传的是 toFixed(2) 后的字符串，直接赋值会让 toFixed 报错
  p.on('kBps', (kbps: string | number) => {
    if (!form.showBandwidth) return
    stat.kbps = Number(kbps) || 0
  })

  p.on('error', (err: string) => {
    // 错误值都是 Jessibuca.ERROR 里的常量，硬编码字符串比较会随版本失效
    const reason =
      err === E.fetchError
        ? 'HTTP 拉流失败：地址不可访问 / 跨域被拦 / 返回 4xx'
        : err === E.websocketError
          ? 'WebSocket 连接失败：wss 与 https 要配套，检查端口与反代'
          : err === E.wasmDecodeError
            ? 'wasm 解码失败：编码不受支持或流已损坏'
            : err === E.mediaSourceH265NotSupport || err === E.webcodecsH265NotSupport
              ? 'H.265 没有硬解通道，请开启 autoWasm 走软解'
              : err === E.playError
                ? '播放参数非法：地址为空或上一次播放未结束'
                : `播放失败：${err}`
    fail(reason)
  })

  p.on('timeout', (type: string) => {
    pushLog('timeout', String(type))
  })

  p.on('loadingTimeout', () => {
    fail('起播超时：服务端没有推流、地址写错，或 ws 握手被防火墙拦住')
  })

  p.on('delayTimeout', () => {
    pushLog('delayTimeout', '播放中无数据，播放器会按 heartTimeoutReplay 自动重播')
  })

  p.on('log', (msg: unknown) => {
    if (form.debug) pushLog('log', String(msg).slice(0, 120))
  })
}

async function destroyPlayer() {
  const p = player
  player = null
  playing.value = false
  if (p) {
    try {
      await p.destroy()
    } catch {
      /* 未起播时销毁可能抛错，忽略 */
    }
  }
  if (hostRef.value) hostRef.value.innerHTML = ''
}

async function load() {
  const url = form.url.trim()
  if (!url) {
    ElMessage.warning('请填写 http-flv / ws-flv 地址')
    return
  }
  const host = hostRef.value
  if (!host || !host.clientWidth || !host.clientHeight) {
    fail('播放容器尺寸为 0，无法初始化（页面切换动画未结束时重试一次即可）')
    return
  }

  await destroyPlayer()
  status.value = 'loading'
  statusText.value = '正在加载 SDK…'
  errorMsg.value = ''

  try {
    await loadJessibuca(form.sdkUrl)
    sdkLoaded.value = true
    pushLog('sdk', form.sdkUrl.includes('cdn.') ? 'SDK 来自 CDN' : `SDK 来自 ${form.sdkUrl}`)
  } catch (e: any) {
    fail(
      `播放器脚本加载失败：${e?.message || e}。` +
        ' 可把 jessibuca.js / decoder.js / decoder.wasm 放到 public/jessibuca/ 后把「SDK 来源」切成本地，避免依赖 CDN。',
    )
    return
  }

  const Jessibuca = window.Jessibuca
  if (!Jessibuca) {
    fail('window.Jessibuca 不存在，请确认脚本地址指向 dist/jessibuca.js')
    return
  }

  statusText.value = '正在拉流…'
  try {
    player = new Jessibuca({
      container: host,
      decoder: form.decoderUrl,
      videoBuffer: Number(form.videoBuffer),
      // isResize: true 等比留黑边，false 拉伸铺满
      isResize: !form.stretch,
      useMSE: form.useMSE,
      useWCS: form.useWCS,
      // H.265 没有硬解通道，必须允许降级 wasm
      autoWasm: true,
      hasAudio: form.hasAudio,
      debug: form.debug,
      showBandwidth: form.showBandwidth,
      loadingText: '加载中',
      // 底部按钮交给我们自己的控件，避免双层控制条
      operateBtns: { fullscreen: false, screenshot: false, play: false, audio: false, record: false },
      supportDblclickFullscreen: true,
      hotKey: true,
    })
    bindEvents(player)
    await player.play(url)
    status.value = 'ready'
    statusText.value = '已起播'
    pushLog('load', `${url.length > 48 ? `${url.slice(0, 48)}…` : url}`)
  } catch (e: any) {
    fail(e?.message || String(e))
  }
}

function togglePlay() {
  if (!player) return load()
  if (!playing.value) {
    player.play(form.url).catch((e: any) => fail(e?.message || String(e)))
    return
  }
  player
    .pause()
    .then(() => pushLog('pause', '已暂停'))
    .catch((e: any) => fail(e?.message || String(e)))
}

function stop() {
  destroyPlayer()
  status.value = 'ready'
  statusText.value = '已停止'
  media.width = 0
  media.height = 0
  stat.fps = 0
  stat.kbps = 0
  stat.buffer = 0
  pushLog('stop', '已销毁实例并释放 wasm')
}

function setVolume(value: number | number[]) {
  const val = Number(Array.isArray(value) ? value[0] : value)
  form.volume = val
  player?.setVolume(val / 100)
  if (val > 0 && muted.value) toggleMute()
}

function toggleMute() {
  if (!player) return
  // 浏览器自动播放策略：出声必须在用户手势里触发 cancelMute()
  if (muted.value) {
    player.cancelMute()
    player.audioResume?.()
    muted.value = false
  } else {
    player.mute()
    muted.value = true
  }
}

function setBuffer(value: number | number[]) {
  const val = Number(Array.isArray(value) ? value[0] : value)
  form.videoBuffer = val
  player?.setBufferTime(val)
}

function setScale() {
  form.stretch = !form.stretch
  player?.setScaleMode(form.stretch ? 0 : 1)
}

function snapshot() {
  if (!player) return ElMessage.warning('还没有实例可截图')
  try {
    // 截图要求已起播 1s 以上；MSE 用 <video> 渲染时截图可能拿不到画面
    player.screenshot('jessibuca-snapshot', 'png', 1, 'download')
    pushLog('snapshot', '已触发截图')
  } catch (e: any) {
    ElMessage.warning(e?.message || '截图失败')
  }
}

function toggleFullscreen() {
  if (!player) return
  player.setFullscreen(!fullscreen.value)
}

function choosePreset(url: string | number | boolean | undefined) {
  const item = PRESETS.find((p) => p.url === url || p.label === url)
  if (!item) return
  if (!item.url) {
    form.url = 'https://your-host/live/stream.flv'
    ElMessage.info('换成自己的 http-flv / ws-flv 地址后再点「加载」')
    return
  }
  form.url = item.url
  form.preset = item.url
  load()
}

function onSdkChange(value: string | number | boolean | undefined) {
  applySdkPreset(value)
  if (form.sdk === 'custom') ElMessage.info('填好 sdkUrl 后 decoder 会按地址推断，必要时手动改')
}

/** 容器尺寸变化后要通知播放器重算，否则全屏/侧栏收起时会留黑边 */
let resizeObserver: ResizeObserver | null = null
function watchHost() {
  if (!hostRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => player?.resize())
  resizeObserver.observe(hostRef.value)
}

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
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
    notes-tip="Jessibuca 的问题基本都落在「协议不匹配 / wasm 路径错 / 自动播放策略」三类，按顺序排查最快。"
    error-tip="先确认地址是 `http(s)-flv` 或 `ws(s)-flv`（开源版不支持 HLS、WebRTC），再用「SDK 来源」切到本地 `public/jessibuca/` 排除 CDN 与跨域问题。"
    @retry="load"
    @clear="logs = []"
  >
    <template #hint>
      Jessibuca 示例：wasm 软解播放 <b>http-flv / ws-flv</b>，支持 H.264 与 H.265；可切换 MSE / WebCodecs 硬解、缓冲与缩放模式，右侧为接入步骤与排错要点。
    </template>

    <template #stage>
      <div ref="hostRef" class="player-host" />
      <div v-if="!sdkLoaded" class="sdk-hint">
        <p class="sdk-title">尚未加载播放器 SDK</p>
        <p class="sdk-desc">
          已默认使用本地 <code>public/jessibuca/</code>（v3 dist：<code>jessibuca.js</code> +
          <code>decoder.js</code> + <code>decoder.wasm</code>，共约 1.4 MB）。若本地文件缺失，可在下方「SDK 来源」
          切到 jsDelivr 兜底。
        </p>
      </div>
    </template>

    <template #controls>
      <div class="field-row">
        <label class="field grow">
          <span class="label">流地址（http-flv / ws-flv）</span>
          <el-input v-model="form.url" size="small" placeholder="https://host/live/stream.flv" @keyup.enter="load" />
        </label>
        <label class="field">
          <span class="label">示例</span>
          <el-select :model-value="form.preset" size="small" placeholder="选择示例" @update:model-value="choosePreset">
            <el-option v-for="p in PRESETS" :key="p.label" :label="p.label" :value="p.url" />
          </el-select>
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
        <el-button size="small" @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '全屏' }}</el-button>
      </div>

      <div class="btn-row">
        <span class="label">SDK 来源</span>
        <el-select :model-value="form.sdk" size="small" class="sdk" @update:model-value="onSdkChange">
          <el-option v-for="p in SDK_PRESETS" :key="p.value" :label="p.label" :value="p.value" />
          <el-option label="自定义地址" value="custom" />
        </el-select>
        <el-input v-if="form.sdk === 'custom'" v-model="form.sdkUrl" size="small" class="sdk-url" placeholder="自定义 jessibuca.js 地址" />
        <span class="divider" />
        <span class="label">MSE</span>
        <el-switch v-model="form.useMSE" size="small" />
        <span class="label">WCS</span>
        <el-switch v-model="form.useWCS" size="small" />
        <span class="label">音频</span>
        <el-switch v-model="form.hasAudio" size="small" />
        <span class="label">码率</span>
        <el-switch v-model="form.showBandwidth" size="small" />
      </div>

      <div class="btn-row">
        <span class="label">缓冲</span>
        <el-slider class="buf" :model-value="form.videoBuffer" :min="0.2" :max="5" :step="0.1" size="small" :show-tooltip="false" @update:model-value="setBuffer" />
        <el-button size="small" :type="form.stretch ? 'primary' : 'default'" @click="setScale">
          {{ form.stretch ? '拉伸铺满' : '等比留边' }}
        </el-button>
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
  max-width: 560px;
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
.buf {
  width: 130px;
}
.sdk {
  width: 150px;
}
.sdk-url {
  flex: 1 1 220px;
  min-width: 200px;
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
