import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** Jessibuca 页面的说明内容：最小可用 → 解码策略 → 事件排错 → 生命周期 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '最小可用：注入脚本 + new + play',
    desc: 'jessibuca.js 暴露全局构造器；decoder 指向 decoder.js，wasm 由它自己按同目录加载',
    code: `// 1. 引入（本地 public/jessibuca/ 或 CDN，三个文件必须同目录）
await loadScript('/jessibuca/jessibuca.js')
// 兜底：https://cdn.jsdelivr.net/gh/langhuihui/jessibuca@v3/dist/jessibuca.js

// 2. 挂载容器只做定位，不要加 transform / 旋转
const player = new Jessibuca({
  container: hostEl,
  decoder: '/jessibuca/decoder.js',
  videoBuffer: 1,        // 缓冲秒数，越小越实时
  isResize: true,        // true 等比留黑边，false 拉伸铺满
  hasAudio: true,
  loadingText: '加载中',
})

// 3. 起播：返回 Promise，必须 catch，否则失败是静默的
player.play('https://host/live/stream.flv').catch((e) => console.warn(e))`,
  },
  {
    title: '解码策略：H.264 走硬解，H.265 只能软解',
    desc: 'useMSE / useWCS 只覆盖 H.264；H.265 关掉 autoWasm 会直接报错',
    code: `const player = new Jessibuca({
  container: hostEl,
  decoder: '/jessibuca/decoder.js',   // H.265 软解入口

  useMSE: true,    // <video> + MediaSource，仅 H.264，CPU 低
  useWCS: true,    // WebCodecs，仅 H.264，需 Chrome 94+ 且 https/localhost
  // 优先级：useMSE > useWCS > wasm 软解
  autoWasm: true,  // 硬解不支持时自动降级 wasm；设 false 会直接抛错停机

  videoBuffer: 0.5,
  hasAudio: false, // 监控场景不要音频，能省一大截解码开销
})`,
  },
  {
    title: '事件：分辨率、编码、卡顿都能拿到',
    desc: 'videoInfo 的 encTypeCode 能直接确认拉到的到底是 H.264 还是 H.265',
    code: `// encTypeCode: 10 = H.264，12 = H.265
player.on('videoInfo', (info) => {
  console.log(info.width, info.height, info.encType)
})

// 10 = AAC，7 = G711A，8 = G711U（国标摄像头常见）
player.on('audioInfo', (info) => console.log(info.encTypeCode))

// 每秒一次：buf 缓冲、fps、abps 音频码率、vbps 视频码率
player.on('stats', ({ buf, fps, abps, vbps }) => {
  console.log('buffer', buf, 'fps', fps, 'kbps', ((vbps + abps) / 1024).toFixed(0))
})

// performance: 0 卡顿 / 1 流畅 / 2 很流畅
player.on('performance', (level) => console.log('等级', level))`,
  },
  {
    title: '错误与超时：用常量比较，不要硬编码字符串',
    desc: 'error 回调给的是常量值，靠 Jessibuca.ERROR / TIMEOUT 判断才能区分原因',
    code: `player.on('error', (err) => {
  const E = Jessibuca.ERROR
  if (err === E.fetchError) return console.warn('HTTP 拉流失败：地址 / CORS / 4xx')
  if (err === E.websocketError) return console.warn('ws 连接失败：wss 与 https 要配套')
  if (err === E.wasmDecodeError) return console.warn('wasm 解码失败：编码不受支持或流损坏')
  if (err === E.webcodecsH265NotSupport) return console.warn('H.265 无 WCS 硬解，需开 autoWasm')
  console.warn('其它错误', err)
})

player.on('timeout', (type) => {
  // loadingTimeout 起播无数据 / delayTimeout 播放中卡住
  if (type === Jessibuca.TIMEOUT.loadingTimeout) player.play(url).catch(() => {})
})

player.on('loadingTimeout', () => console.warn('起播超时，多半是服务端没推流或地址写错'))`,
  },
  {
    title: '暂停 / 音量 / 截图 / 销毁',
    desc: '恢复播放用 play() 续播；销毁必须 await，否则 wasm 线程留在后台',
    code: `player.pause()

// 静音只关音频输出，cancelMute 必须在用户手势里调
player.mute()
player.cancelMute()
player.setVolume(0.6)      // 0~1

player.setBufferTime(0.8)  // 运行中调缓冲
player.setScaleMode(1)     // 0 拉伸 / 1 留边 / 2 裁切（MSE 渲染时无效）
player.setFullscreen(true)

// 截图：start 之后约 1s 再截，type 可为 download / base64 / blob
player.screenshot('snapshot', 'png', 1, 'download')

// 切页面 / 换流前销毁
await player.destroy()`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '开源版只认三种协议',
    body: '开源版只支持 `ws-raw`、`ws-flv`、`http(s)-flv`，HLS / fMP4 / WebRTC / RTMP / RTSP 都要服务端先转成 FLV 或裸流（Pro 版才有）。如果填了 `m3u8` 或 `webrtc://` 一直黑屏，先确认协议，而不是调参数。',
  },
  {
    title: 'decoder.js 与 decoder.wasm 必须同目录',
    body: '`decoder` 是相对**当前页面 URL** 解析的，不是相对 `jessibuca.js`。单页应用里页面在 `/video/jessibuca`，写 `./decoder.js` 会请求到 `/video/decoder.js` 直接 404，表现为「MSE 可用的浏览器正常、H.265 全黑」。一律用绝对路径（`/jessibuca/decoder.js` 或 CDN 全路径）。',
  },
  {
    title: 'H.265 没有硬解这条路',
    body: '浏览器对 HEVC 的原生支持极不完整，`useMSE` / `useWCS` 只覆盖 H.264。H.265 只能 wasm 软解，1080p 桌面端尚可，4K 或多路并发会明显掉帧、CPU 打满；移动端建议服务端转 H.264。',
  },
  {
    title: 'MSE 在 iOS 上不成立',
    body: 'iOS Safari 没有可用的 MediaSource，`useMSE: true` 无效，会回退到 wasm。iOS 上更推荐 `useWebFullScreen: true` 走网页全屏，避免系统全屏退出后画面尺寸错乱。',
  },
  {
    title: '默认是静音，出声必须靠用户手势',
    body: '自动播放策略要求音频在用户点击/触摸里激活：`isNotMute: true` 也只保证不主动静音，真正出声要在 `click` 事件里调 `cancelMute()` / `audioResume()`。所以页面加载后没声音是正常的，点一下「取消静音」即可。',
  },
  {
    title: 'play() 必须 catch，错误用常量比对',
    body: '`play()` 返回 Promise，不 catch 的话失败既不进 UI 也不进控制台。`error` 事件给的是 `Jessibuca.ERROR.*` 的常量值，`timeout` 是 `Jessibuca.TIMEOUT.*`，硬编码字符串比较在版本升级后会全部失效。',
  },
  {
    title: 'https 页面拉不了 ws:// 与 http://',
    body: '混合内容会被浏览器直接拦掉（控制台 `Mixed Content`，播放器只报 websocket/fetch 错误）。页面是 https 时，流地址必须是 `wss://` 或 `https://`，本地调试请用 http 页面。',
  },
  {
    title: '容器不要做 transform',
    body: 'jessibuca 依赖容器的实际像素尺寸做 canvas 与实际坐标换算，对 `container` 加 `transform: scale()`、旋转或缩放会导致画面偏移、点击错位。要缩放请在容器外面再套一层。',
  },
  {
    title: 'npm 上的 jessibuca 包没有 dist',
    body: '`npm i jessibuca` 装到的是 4.0.0 的 monorepo 源码（`packages/*`），没有编译后的 `jessibuca.js`，所以 `cdn.jsdelivr.net/npm/jessibuca@3/dist/jessibuca.js` 这类地址是 404 的。要用现成产物就去 GitHub 的 `v3` 分支 `dist/` 目录取（本项目已把三个文件放在 `public/jessibuca/`）；4.x 需要自己按仓库 pnpm workspace 构建。',
  },
  {
    title: 'CDN 取源的两个前提',
    body: '跨域加载 `decoder.js` / `decoder.wasm` 需要 CDN 返回 `Access-Control-Allow-Origin`，并且 `.wasm` 的 MIME 是 `application/wasm`，否则回退到 arrayBuffer 编译、启动明显变慢。本项目已把 v3 的 dist 三个文件放到 `public/jessibuca/` 同源部署，本页「SDK 来源」默认就是本地。',
  },
]
