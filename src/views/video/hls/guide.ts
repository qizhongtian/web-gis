import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** HLS.js 页面的说明内容：起播 → 多码率 → 直播调优 → 错误恢复 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '最小可用示例',
    desc: 'Safari 原生支持 m3u8，其它浏览器走 hls.js；两条路都要处理，否则 iOS 白屏',
    code: `import Hls from 'hls.js'

const video = document.querySelector('video')

if (Hls.isSupported()) {
  const hls = new Hls({
    enableWorker: true,
    maxBufferLength: 30,   // 缓冲上限（秒）
  })
  hls.loadSource('https://host/live/index.m3u8')
  hls.attachMedia(video)
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play())
} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
  // iOS Safari：直接用原生播放器
  video.src = 'https://host/live/index.m3u8'
  video.play()
}`,
  },
  {
    title: '多码率与画质切换',
    desc: 'master 列表解析出 levels，-1 表示自动；手动指定会清空当前缓冲',
    code: `hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
  // [{ height: 720, bitrate: 2149280, name: '720' }, …]
  levels.value = data.levels
})

hls.currentLevel = -1   // 自动（按带宽 + 缓冲选）
hls.currentLevel = 2    // 立刻切到第 3 档
hls.nextLevel = 2       // 下一分片再切，切换更平滑

hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
  console.log('当前档位', data.level, hls.levels[data.level]?.height)
})`,
  },
  {
    title: '直播：低延迟与缓冲',
    desc: '延迟换稳定：低延迟模式要服务端支持 LL-HLS，普通直播调 liveSyncDurationCount 更稳',
    code: `const hls = new Hls({
  lowLatencyMode: true,        // 服务端返回 #EXT-X-PART 时才有意义
  liveSyncDurationCount: 2,    // 距离直播边缘保留的分片数（默认 3）
  maxBufferLength: 10,         // 缓冲上限，直播别给太大
  backBufferLength: 30,        // 已播过的最多保留 30s，防内存上涨
  maxLiveSyncPlaybackRate: 1.5 // 落后太多时轻微加速追帧
})

// 读实时延迟（秒）
console.log(hls.latency)`,
  },
  {
    title: '错误分层处理',
    desc: 'fatal 错误先尝试恢复：网络重拉、解码重建；恢复不了再销毁并提示用户',
    code: `hls.on(Hls.Events.ERROR, (_, data) => {
  if (!data.fatal) return console.warn(data.type, data.details)

  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
    hls.startLoad()            // 重新拉列表/分片
  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    hls.recoverMediaError()    // 重建 MSE，必要时 swapAudioCodec()
  } else {
    hls.destroy()
    showError('播放失败：' + data.details)
  }
})`,
  },
  {
    title: '销毁与重建',
    desc: '切地址前先 destroy，否则旧实例的定时器与 XHR 会继续跑',
    code: `hls.stopLoad()
hls.detachMedia()
hls.destroy()
// 再 new Hls() 换新地址`,
  },
]

export const notes: NoteItem[] = [
  {
    title: 'HLS 播不了 flv',
    body: 'HLS 只认 `m3u8` + TS/fMP4 分片；拿到的是 `.flv` 或 http-flv 地址时用 `flv.js` / `mpegts.js`。反过来，flv.js 也播不了 m3u8，别填错。',
  },
  {
    title: '跨域与 https',
    body: 'hls.js 用 fetch 拉列表和分片，服务端必须返回 `Access-Control-Allow-Origin`；列表跨域时还要 `Access-Control-Expose-Headers` 才能读到 `Content-Length` 等头。https 页面不能拉 `http://` 的流（混合内容拦截）。',
  },
  {
    title: '直播延迟与稳定性的取舍',
    body: '`liveSyncDurationCount` 越小延迟越低但越容易卡。普通直播建议 2~3 片；真低延迟（<3s）要服务端开 LL-HLS（`#EXT-X-PART`），前端再开 `lowLatencyMode`，单靠前端参数压不下去。',
  },
  {
    title: '切画质会重新缓冲',
    body: '手动 `currentLevel` 会清空 SourceBuffer 并重新拉分片，画面会短暂卡一下；播放器一般用 `nextLevel` 或直接留在自动档，让 hls.js 按带宽自适应。',
  },
  {
    title: 'Safari 走原生，能力有差异',
    body: 'iOS/桌面 Safari 下 `Hls.isSupported()` 为 false，只能用原生播放器：无法读取 levels、不能设 `lowLatencyMode`、也无法做精细的错误恢复，功能要按「原生降级」设计。',
  },
  {
    title: '示例流是公网测试流',
    body: '默认用 Mux / Apple 的公开测试流（已放行 CORS），可能随时失效；换成自己的 m3u8 时注意列表必须带 CORS 响应头，且 https 页面只能用 https 流。',
  },
]
