import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** FLV.js 页面的说明内容：最小可用 → 直播/点播差异 → 事件与排错 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '最小可用示例',
    desc: 'flv.js 基于 MSE，只做「拉流 → 解封装 → 交给 video」三步；attachMediaElement 之后必须 load()',
    code: `import flvjs from 'flv.js'

if (flvjs.isSupported()) {
  const player = flvjs.createPlayer(
    {
      type: 'flv',        // 固定 flv
      url,                // http(s):// 的 flv 地址，http-flv 直播流同样走这里
      isLive: false,      // 直播流传 true
      cors: true,         // 跨域时带上 Origin，服务端要回 Access-Control-Allow-Origin
      hasAudio: true,
      hasVideo: true,
    },
    {
      enableWorker: false, // 解封装放 Worker 会更顺，但 1.6.2 在新版 Chromium 上会崩，见注意事项
      enableStashBuffer: false,
      lazyLoad: true,
    },
  )

  player.attachMediaElement(videoEl) // video 元素
  player.load()
  player.play()
}`,
  },
  {
    title: '直播与点播的参数差异',
    desc: '直播要「低延迟」，点播要「少卡顿」，两者是相反的取舍',
    code: `// 点播：攒一点缓冲再播，网络抖动不易卡
flvjs.createPlayer(media, {
  enableStashBuffer: true,      // 开启积压缓冲
  stashInitialSize: 384,        // 初始缓冲 384KB
  lazyLoad: true,               // 起播前不急着全量请求
})

// 直播：尽量贴近最新帧
flvjs.createPlayer(media, {
  enableStashBuffer: false,
  autoCleanupSourceBuffer: true,        // 自动清理已播过的 buffer
  autoCleanupMaxBackwardDuration: 30,   // 最多回退 30s
  autoCleanupMinBackwardDuration: 10,   // 清理到只留 10s
})
// 想再降延迟：配 isLive: true + 服务端 GOP 调小，别指望前端单方面追帧`,
  },
  {
    title: '事件与错误处理',
    desc: 'ERROR 的 detail 是排错关键：NETWORK_* 看地址/CORS，MEDIA_* 看编码',
    code: `player.on(flvjs.Events.ERROR, (type, detail, info) => {
  // type:   NETWORK_ERROR / MEDIA_ERROR / OTHER_ERROR
  // detail: NETWORK_STATUS_CODE_INVALID、NETWORK_EXCEPTION、
  //         MEDIA_FORMAT_UNSUPPORTED、MEDIA_MSE_ERROR …
  console.warn(type, detail, info) // info.msg 常带具体原因
})

player.on(flvjs.Events.MEDIA_INFO, (info) => {
  // { mimeType, width, height, fps, videoCodec, audioCodec, audioSampleRate, … }
})

player.on(flvjs.Events.STATISTICS_INFO, (info) => {
  // { speed(KB/s), decodedFrames, droppedFrames }
})

player.on(flvjs.Events.LOADING_COMPLETE, () => console.log('流已结束'))
player.on(flvjs.Events.RECOVERED_EARLY_EOF, () => console.log('网络中断后自动恢复'))`,
  },
  {
    title: '暂停、跳转与销毁',
    desc: 'seek 用 video.currentTime；销毁必须 unload + detach + destroy，否则 Worker 和 buffer 会泄漏',
    code: `player.pause()
player.play()
videoEl.currentTime = 30       // 点播跳转（直播跳转无意义）

// 用完一定要按顺序释放
player.pause()
player.unload()
player.detachMediaElement()
player.destroy()`,
  },
  {
    title: '本地文件也能播',
    desc: '把 File 转成 objectURL 直接喂给 flv.js，适合离线演示；播放完记得 revoke',
    code: `const url = URL.createObjectURL(file)   // <input type="file" accept=".flv">
const player = flvjs.createPlayer({ type: 'flv', url, isLive: false })
// …播放完
URL.revokeObjectURL(url)`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '只认 H.264 + AAC',
    body: 'flv.js 解封装后用 MSE 播放，编码必须是 H.264（AVC）+ AAC。国标摄像头常见的 H.265 或 G.711A 音频播不了，会报 `MEDIA_FORMAT_UNSUPPORTED`，这类场景要换 `mpegts.js`（可软解 H.265）或 Jessibuca。',
  },
  {
    title: '跨域必须先放行',
    body: 'flv.js 用 fetch/XHR 拉流，属于跨域请求。服务端（nginx / SRS / ZLMediaKit / OSS）必须返回 `Access-Control-Allow-Origin`，否则控制台报 CORS 而播放器只给一个 `NETWORK_EXCEPTION`，看起来像地址写错了。',
  },
  {
    title: 'https 页面不能拉 http 流',
    body: '页面是 https 时，`http://` 的 flv 地址会被浏览器按混合内容拦截（`Mixed Content`）。要么流服务也上 https，要么本地用 http 页面调试。',
  },
  {
    title: '直播延迟不是越小越好',
    body: '关掉 `enableStashBuffer`、开 `autoCleanupSourceBuffer` 能压低延迟，但网络一抖就卡顿甚至花屏。实际项目一般把服务端 GOP 调到 1s~2s，前端留 1~2s 缓冲，比一味追帧稳。',
  },
  {
    title: 'iOS / Safari 基本播不了',
    body: 'flv.js 依赖 MSE，iOS Safari 没有可用的 MSE，`flvjs.isSupported()` 直接返回 false。移动端直播建议用 HLS，或服务端同时提供 m3u8。',
  },
  {
    title: '示例流是公网测试流',
    body: '默认播放阿里云公开示例 `player.alicdn.com/video/aliyunmedia.flv`（H.264 + AAC、支持 Range 与 `Access-Control-Allow-Origin: *`），文件较大但按需分段加载；失效时换自己的地址即可。用 `flv` 本地文件时走 objectURL，同源无需 CORS。切页面前请先「停止」，避免后台继续拉流占带宽。',
  },
  {
    title: 'enableWorker 建议先关掉',
    body: 'flv.js 1.6.2 的 transmuxing worker 依赖自身 webpack 运行时，在较新 Chromium 上会抛 `Class extends value undefined` / `Cannot read properties of undefined (reading \'call\')`，表现为开了 Worker 后一直 `readyState=0` 起不来。本页默认 `enableWorker: false`（主线程解封装，单路 1080p 完全够用）；确实要开请先在目标浏览器实测，或换 `mpegts.js`（API 基本兼容、维护更活跃）。',
  },
]
