import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** 原生 WebRTC 页面说明：建连接 → 换 SDP → 收流 → 排错 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '拉流只需三步：建连接 + 加 recvonly + 换 SDP',
    desc: '没有 SDK，全部走浏览器原生 API；关键是把 recvonly 的 m-line 放进 offer',
    code: `const pc = new RTCPeerConnection({
  iceServers: [],                 // 局域网直连不需要 STUN
  bundlePolicy: 'max-bundle',
})

// 只收不发：不加这条，createOffer 出来没有 m-line，服务端无从下发
pc.addTransceiver('video', { direction: 'recvonly' })
pc.addTransceiver('audio', { direction: 'recvonly' })

await pc.setLocalDescription(await pc.createOffer())
// 非 trickle 交换必须先等 candidate 收集完（局域网通常 <100ms）
await waitIceGathering(pc, 1500)`,
  },
  {
    title: 'WHEP：POST application/sdp，201 返回 answer',
    desc: '标准化的「HTTP 上的 SDP 交换」，MediaMTX、部分 SRS / 商业网关都按这个实现',
    code: `const res = await fetch(whepUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
  body: pc.localDescription.sdp,
})

// 201 Created，answer 是响应体，资源地址在 Location 头
const answer = await res.text()
pc.setRemoteDescription({ type: 'answer', sdp: answer })`,
  },
  {
    title: 'ZLMediaKit：POST JSON，回 JSON',
    desc: '同一个 /index/api/webrtc 接口，body 是 { sdp }，返回 { code, sdp, msg }',
    code: `const url = 'http://host:8080/index/api/webrtc?app=live&stream=test&type=play'

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sdp: pc.localDescription.sdp }),
})
const ret = await res.json()

if (ret.code !== 0) throw new Error(ret.msg)   // 流不存在 / app 不匹配
pc.setRemoteDescription({ type: 'answer', sdp: ret.sdp })`,
  },
  {
    title: '收流、播放与释放',
    desc: 'ontrack 里挂 srcObject；卸载时必须 close + stop，否则 ICE 通道会挂在后台',
    code: `pc.ontrack = (event) => {
  const stream = event.streams[0] ?? new MediaStream([event.track])
  video.srcObject = stream
  video.muted = true            // 自动播放要求静音
  video.play().catch(() => {})  // 被拦就等用户点画面
}

pc.onconnectionstatechange = () => {
  if (pc.connectionState === 'failed') {
    // 常见：rtc.externIP 是内网 IP、UDP 端口被防火墙拦
  }
}

// 卸载：先停轨道再 close，避免摄像头/麦克风指示灯不灭
video.srcObject?.getTracks().forEach((t) => t.stop())
pc.close()`,
  },
]

export const notes: NoteItem[] = [
  {
    title: 'WebRTC 只在安全上下文可用',
    body: '`RTCPeerConnection` 要求页面处于 secure context：https 或 `localhost` / `127.0.0.1`。用局域网 IP + http 打开时，Chrome 会直接不暴露该 API，页面提示「不支持 WebRTC」多半是这个问题，而不是浏览器太旧。',
  },
  {
    title: 'https 页面不能 POST http 接口',
    body: 'SDP 交换走 `fetch`，受混合内容策略限制：页面是 https 时，请求 http 的 `8080` 会被浏览器拦成 `TypeError`，且控制台只给一句 Failed to fetch。要么两边都上 https，要么都在内网 http 环境里调试。',
  },
  {
    title: '必须先加 recvonly 的 transceiver',
    body: '`createOffer()` 只会为已有的 transceiver / track 生成 m-line。只拉流时若忘了 `addTransceiver(\'video\', { direction: \'recvonly\' })`，offer 里没有媒体行，服务端会返回一个没有媒体段的 answer，表现就是「连上了但永远没画面」。',
  },
  {
    title: '非 trickle 就别急着发 offer',
    body: 'WHEP 与 ZLMediaKit 都按「offer 自带全部 candidate」处理，收集没结束就发出去，服务端只能拿到 host candidate 之外的空白，`setRemoteDescription` 之后可能一直停在 `connecting`。本项目用 `waitIceGathering` 等 `iceGatheringState === complete`，超时 1.5s 兜底。',
  },
  {
    title: 'CORS 要放行 POST 与 Location',
    body: 'WHEP 是跨域 POST，服务端需要返回 `Access-Control-Allow-Origin`，并 `Access-Control-Expose-Headers: Location`，否则前端读不到 answer 的资源地址；预检请求（OPTIONS）也要带 `Access-Control-Allow-Headers: Content-Type`。',
  },
  {
    title: 'ZLMediaKit 的三处坑',
    body: '一是 `code != 0` 时响应里没有 `sdp` 字段，必须读 `msg`；二是 `rtc.externIP` 要填浏览器能访问到的地址，否则 ICE 只在服务端内网生效；三是拉流要 `type=play`，推流才是 `type=push`，写错会报参数错误。',
  },
  {
    title: 'ICE 服务器不是越多越好',
    body: '局域网直连（浏览器与服务端同网段）`iceServers: []` 最快，host candidate 直接打通。只有跨 NAT 才需要 STUN/TURN；TURN 还会把媒体绕到中继，延迟和带宽都变差——监控场景优先保证浏览器到服务端的网络可达。',
  },
  {
    title: 'answer 末尾的换行不能 trim',
    body: '从响应里缓存 answer 时，若顺手 `sdp.trim()` 去掉末尾换行，Chrome 会报 `Failed to parse SessionDescription ... Invalid SDP line`（通常指向最后一行 `a=rtpmap:126 telephone-event/8000`）。SDP 的最后一行同样需要 CRLF 结束，本项目用 `pickSdp` 统一补回 `\\r\\n`。',
  },
  {
    title: '自动播放仍然要静音',
    body: '`video.play()` 的自动播放许可跟 `<video muted>` 绑定，与是不是 WebRTC 无关。页面默认 `muted`，用户点「取消静音」后再出声；否则首帧会被 `NotAllowedError` 拦下，看起来像「连上了不播」。',
  },
  {
    title: '与 ZLMRTCClient.js 页面的分工',
    body: '这一页是裸 API 教学版：能看清 offer/answer、ICE 状态与 `getStats` 指标，但没有库里的重连、事件封装。生产接入 ZLMediaKit 时用 `ZLMRTCClient.js` 页面那套更省事；接 WHEP 网关或自研信令时，直接抄这一页的流程。',
  },
]
