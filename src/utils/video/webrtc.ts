/**
 * 原生 WebRTC 拉流工具（不依赖任何播放器 SDK）
 *
 * 拉流本质只有两步：
 * 1. RTCPeerConnection 加一条 recvonly 的 m-line，createOffer 得到本地 SDP
 * 2. 把 offer 发给服务端换回 answer，setRemoteDescription 之后等 ontrack
 *
 * 换 SDP 的接口按服务端实现分三种：
 * - whep：W3C 的 WebRTC-HTTP Egress Protocol，POST application/sdp，201 返回 answer
 * - zlm：ZLMediaKit 的 /index/api/webrtc，POST JSON（{ sdp }），回 JSON（{ code, sdp, msg }）
 * - custom：其它自建接口，POST text/plain，回纯 SDP 或用 JSON 包一层
 */

/** SDP 交换方式 */
export type SdpMode = 'whep' | 'zlm' | 'custom'

/** 当前环境是否有 RTCPeerConnection（node 端渲染、老浏览器都没有） */
export function isWebRtcSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function'
}

/**
 * 等 ICE candidate 收集结束
 *
 * 非 trickle 的 SDP 交换（WHEP、ZLMediaKit 都是）要求 offer 里已经带上 candidate，
 * 否则服务端按无候选处理，setRemoteDescription 之后迟迟不进 connected。
 * 这里收尾用超时兜底：host candidate 一般几十毫秒就够，跨网才需要多等。
 */
export function waitIceGathering(pc: RTCPeerConnection, timeout = 1500): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      pc.removeEventListener('icegatheringstatechange', onChange)
      window.clearTimeout(timer)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    const timer = window.setTimeout(finish, timeout)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}

/**
 * 从响应体里抠出 SDP 正文
 *
 * 兼容三种形态：纯 SDP、`{ sdp }` / `{ answer }` 的 JSON、以及正文里前面带了别的内容。
 * ZLMediaKit 在 code != 0 时返回的 JSON 没有 sdp 字段，此时返回空串，由调用方报错。
 *
 * 注意末尾必须补回 CRLF：Chrome 的 SDP 解析器把「没有换行结尾的最后一行」判为
 * `Invalid SDP line`，而普通 SDP 的最后一行恰好是 `a=rtpmap:126 telephone-event/8000`，
 * 直接 trim 掉换行就会在这里报错。
 */
export function pickSdp(text: string): string {
  const raw = (text || '').trim()
  if (!raw) return ''

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const json: any = JSON.parse(raw)
      const candidate = json?.sdp ?? json?.answer ?? json?.data?.sdp
      if (typeof candidate === 'string' && candidate.includes('v=0')) {
        return normalizeSdp(candidate)
      }
    } catch {
      /* 不是合法 JSON，落到按纯文本处理 */
    }
  }

  return raw.includes('v=0') ? normalizeSdp(raw) : ''
}

/** 掐掉 v=0 之前的多余内容，行尾空格清理掉，并保证以 CRLF 结尾 */
function normalizeSdp(sdp: string): string {
  const idx = sdp.indexOf('v=0')
  if (idx < 0) return ''
  return `${sdp.slice(idx).replace(/\s+$/, '')}\r\n`
}

/** 解析 ICE 服务器列表：支持 `stun:host:port`，也允许只写 host:port */
export function parseIceServers(text: string): RTCIceServer[] {
  return text
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ urls: item.includes('://') ? item : `stun:${item}` }))
}

/** SDP 交换结果 */
export interface SdpExchangeResult {
  /** 抠出来的 answer SDP，空串表示服务端没给 */
  sdp: string
  status: number
  /** 原始响应体，报错时用来展示服务端说了什么 */
  raw: string
  /** WHEP 的 answer 资源地址，做 trickle 时需要 PATCH 它 */
  location?: string
}

/** 把 offer 发出去换 answer，超时用 AbortController 打断 */
export async function exchangeSdp(options: {
  mode: SdpMode
  url: string
  offer: string
  timeout?: number
}): Promise<SdpExchangeResult> {
  const { mode, url, offer, timeout = 10000 } = options
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  const headers: Record<string, string> =
    mode === 'whep'
      ? { 'Content-Type': 'application/sdp', Accept: 'application/sdp' }
      : mode === 'zlm'
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { 'Content-Type': 'text/plain' }

  const body = mode === 'zlm' ? JSON.stringify({ sdp: offer }) : offer

  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal })
    const raw = await res.text()
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}：${raw.slice(0, 160) || '无响应体'}`)
    }
    return {
      sdp: pickSdp(raw),
      status: res.status,
      raw,
      location: res.headers.get('Location') || undefined,
    }
  } finally {
    window.clearTimeout(timer)
  }
}

/** 停止媒体流里的所有轨道，避免关连接后摄像头/麦克风指示灯还亮着 */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      /* 已结束的轨道重复 stop 会抛错，忽略 */
    }
  })
}
