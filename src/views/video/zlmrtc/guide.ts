import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** ZLMRTCClient.js 页面的说明内容：最小可用 → 地址格式 → 事件与排错 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '最小可用示例',
    desc: '拉流只要 recvOnly + useCamera:false；构造器内部就会发 offer 并 POST 到 zlmsdpUrl',
    code: `// 1. 先注入构建版（本页放在 public/zlmrtc/，进入页面才按需加载）
//    <script src="/zlmrtc/ZLMRTCClient.js"></script>
//    注入后全局多出 window.ZLMRTCClient（Endpoint / Events）

// 2. 创建 Endpoint：这一步就会开始 SDP 协商
const player = new ZLMRTCClient.Endpoint({
  element: videoEl,                       // 远端流由库直接塞进 srcObject
  zlmsdpUrl: 'http://host:8080/index/api/webrtc?app=live&stream=test&type=play',
  recvOnly: true,                         // 只收不发
  useCamera: false,                       // 拉流必须 false，否则会去申请摄像头
  debug: false,                           // true 会打开库内部日志
})

// 3. 远端流到达（注意：这个版本回调参数是 RTCTrackEvent，不是 MediaStream）
player.on(ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, (event) => {
  const stream = event.streams && event.streams[0]
  videoEl.srcObject = stream             // 库内已赋值，这里兜底
  videoEl.play().catch(() => {})         // 被自动播放策略拦时静音后再放
})

// 4. 不再需要时关闭，实例不可复用
player.close()`,
  },
  {
    title: '地址格式：ZLM 的 webrtc 接口',
    desc: '不是 rtsp / 也不是标准播放器地址，而是 ZLMediaKit 的 HTTP 接口，靠 query 指定流',
    code: `http://<host>:<port>/index/api/webrtc?app=<app>&stream=<stream>&type=play

// type: play 拉流 / push 推流 / echo 回声测试
// app、stream 要与推流端一致，例如 ffmpeg 推到 live/test：
//   ffmpeg -re -i demo.flv -c copy -f flv rtmp://host/live/test
// 对应播放地址：
//   http://host/index/api/webrtc?app=live&stream=test&type=play

// 该地址用 POST 提交 offer、返回 JSON：
//   { "code": 0, "sdp": "...", "id": "..." }
//   { "code": -1, "msg": "该流不存在" }`,
  },
  {
    title: '事件只有 6 个，连接状态要看 pc',
    desc: '这个构建版的 Events 里没有 CONNECTION_STATE_CHANGE / DATACHANNEL，直接监听底层 pc',
    code: `const E = ZLMRTCClient.Events

// 库里实际只有：
//   WEBRTC_ON_REMOTE_STREAMS / WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED
//   WEBRTC_ICE_CANDIDATE_ERROR / WEBRTC_NOT_SUPPORT
//   WEBRTC_ON_LOCAL_STREAM / CAPTURE_STREAM_FAILED（推流侧）
player.on(E.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, ({ code, msg }) => {
  // 服务端返回 code != 0：常见 -1「该流不存在」（没推流 / app 或 stream 写错）
})

// 连接状态没有事件，自己挂 pc（close() 之后 pc 会被置 null）
player.pc.onconnectionstatechange = () => {
  // new / connecting / connected / disconnected / failed / closed
  console.log('connectionState', player.pc.connectionState)
}`,
  },
  {
    title: '拉流固定收两路，开关在服务端',
    desc: 'receive() 里固定 addTransceiver(audio) + addTransceiver(video)，前端 audioEnable/videoEnable 对拉流不生效',
    code: `// 该版本的 receive() 不读这两个开关，想只要一路得改库源码：
//   this.pc.addTransceiver('audio', { direction: 'recvonly' })
//   this.pc.addTransceiver('video', { direction: 'recvonly' })

// 延迟与卡顿在服务端调：
//   rtc.port / rtc.tcpPort   收流端口
//   rtc.externIP             对外通告的 IP（多网卡必配）
//   rtc.timeoutSec           无数据超时
// 公网 UDP 被墙时改走 TCP（rtc.tcpPort），代价是延迟略高`,
  },
  {
    title: '取码率与帧率：pc.getStats()',
    desc: '库把 RTCPeerConnection 挂在实例上，标准 WebRTC 统计直接可读',
    code: `const report = await player.pc.getStats()
report.forEach((r) => {
  if (r.type === 'inbound-rtp' && r.kind === 'video') {
    r.frameWidth, r.frameHeight   // 分辨率
    r.framesPerSecond             // 帧率
    r.bytesReceived               // 累计字节，做差得到瞬时码率
    r.packetsLost                 // 丢包
    r.jitter                      // 抖动
  }
  if (r.type === 'candidate-pair' && r.state === 'succeeded') {
    r.currentRoundTripTime        // RTT（秒）
  }
})`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '必须先跑起 ZLMediaKit',
    body: 'WebRTC 播放依赖服务端的 SDP 交换接口 `/index/api/webrtc`，没有可用的公网演示源，所以本页默认指向本机 `http://127.0.0.1:8080`。先把 ZLM 跑起来、用 ffmpeg 往 `live/test` 推一路流，再点「连接」；服务端没开 rtc 时接口本身就不存在。',
  },
  {
    title: 'rtc.externIP 没配 → 一直 connecting',
    body: 'ZLM 默认把网卡内网 IP 写进 answer 的 ICE 候选，浏览器在外网自然连不上，表现是 `connectionState` 停在 `connecting`，最后变 `failed`。在 `config.ini` 里配 `externIP`（公网 IP 或域名），或推流/播放都在同一内网。',
  },
  {
    title: '页面必须 https 或 localhost',
    body: 'Chrome / Safari 只在安全上下文里启用完整 WebRTC 能力，`http://192.168.x.x` 这类地址可能连 `RTCPeerConnection` 都建不起来。开发时用 `npm run dev:https`，线上就上证书；播放地址也该跟页面同协议，否则 https 页面 POST http 接口会被混合内容拦截。',
  },
  {
    title: 'SDP 交换也是跨域请求',
    body: '库用 axios POST `zlmsdpUrl`，属于 XHR 跨域：ZLM 默认放行 `Access-Control-Allow-Origin: *`，但经过 nginx / 网关转发时容易被吞掉。CORS 失败不会派发任何事件，只在控制台报 `Network Error`，本页用超时兜底把它显示成错误。',
  },
  {
    title: 'code = -1：该流不存在',
    body: '`WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED` 带回的 `msg` 就是服务端原话。`app` / `stream` 写错、推流端已断开、或者推的不是 H.264 都会走到这里；ZLM 的 WebRTC 不支持 H.265（浏览器侧也不支持），需要转码或改用 FLV / HLS 方案。',
  },
  {
    title: '暂停只是不渲染，连接还在',
    body: 'WebRTC 没有「暂停拉流」的概念：`video.pause()` 之后信令与传输仍在继续，只是不出画面。真正断流要调 `player.close()`（内部会关 pc、停掉所有 track，并把 `pc` 与 `options` 置 null），本页「断开」按钮做的就是这件事；切路由前也会自动 close。',
  },
  {
    title: '低延迟的代价是抗抖动差',
    body: 'WebRTC 端到端通常 200~500ms，但完全没有缓冲：公网一丢包就是花屏或卡住。对延迟不敏感的场景（比如大屏轮巡）优先用 HLS / FLV；确实要 WebRTC，就在服务端把 `rtc.tcpPort` 打开作为 UDP 不通时的兜底。',
  },
  {
    title: '脚本用的是现成构建版',
    body: '`public/zlmrtc/ZLMRTCClient.js` 是官方 rollup 构建产物（UMD，`var ZLMRTCClient = (function(exports){…})({})`，约 241 KB），依赖 axios / webrtc-adapter / es6-promise 已内联，并带 ZLMediaKit 的 msid 改写逻辑；官方仓库没提交 dist、也没发布 npm 包，升级时直接替换该文件即可，页面代码不用改。',
  },
]
