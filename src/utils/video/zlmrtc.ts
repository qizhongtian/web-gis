/**
 * ZLMediaKit WebRTC 播放器（ZLMRTCClient.js）：按需加载 + 类型声明
 *
 * 官方仓库 https://github.com/ZLMediaKit/ZLMRTCClient.js 只提交源码与 demo，
 * 构建产物没有入库、也没发布到 npm，因此 public/zlmrtc/ZLMRTCClient.js 用的是
 * 现成的官方 rollup 构建版（带 ZLMediaKit 的 msid 修正，可直接拉流）。
 *
 * 库暴露全局 `ZLMRTCClient`（Endpoint / Events / Media …），不参与打包：
 * 只有真正进入 WebRTC 示例页时才注入 <script>，首页零成本。
 * 部署在 /web-gis/ 子路径时用 assetUrl 拼 BASE_URL，否则会 404。
 */
import { loadScript } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/** 播放器脚本地址：/web-gis/zlmrtc/ZLMRTCClient.js */
export const ZLM_RTC_SCRIPT = assetUrl('zlmrtc/ZLMRTCClient.js')

/**
 * 事件名常量，与该构建版里的 `Events` 一一对应。
 * 注意：这个版本只有 6 个事件，没有 CONNECTION_STATE / DATACHANNEL，
 * 连接状态要自己挂 `endpoint.pc.onconnectionstatechange`，页面里就是这么做的。
 */
export const ZLM_RTC_EVENTS = {
  WEBRTC_NOT_SUPPORT: 'WEBRTC_NOT_SUPPORT',
  WEBRTC_ICE_CANDIDATE_ERROR: 'WEBRTC_ICE_CANDIDATE_ERROR',
  WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED: 'WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED',
  WEBRTC_ON_REMOTE_STREAMS: 'WEBRTC_ON_REMOTE_STREAMS',
  WEBRTC_ON_LOCAL_STREAM: 'WEBRTC_ON_LOCAL_STREAM',
  CAPTURE_STREAM_FAILED: 'CAPTURE_STREAM_FAILED',
} as const

export type ZlmRtcEventName = (typeof ZLM_RTC_EVENTS)[keyof typeof ZLM_RTC_EVENTS]

/** 构造参数（只声明页面用到的项，完整默认值见 endpoint.js） */
export interface ZlmRtcOptions {
  /** 承载远端流的 video 元素 */
  element: HTMLVideoElement
  /** 输出库内部日志 */
  debug?: boolean
  /**
   * SDP 交换地址，形如：
   * http://host:port/index/api/webrtc?app=live&stream=test&type=play
   */
  zlmsdpUrl: string
  /** 推流时同时推多档分辨率 */
  simulcast?: boolean
  /** true 走摄像头/屏幕采集（推流），拉流播放必须 false */
  useCamera?: boolean
  audioEnable?: boolean
  videoEnable?: boolean
  /** 只收不发；播放场景必须 true，否则库会去申请摄像头 */
  recvOnly?: boolean
  /** 推流分辨率，0,0 表示不限制 */
  resolution?: { w: number; h: number }
}

/** SDP 交换失败时库回传的结构 */
export interface ZlmRtcAnswerFail {
  code: number
  msg?: string
}

/** Endpoint 实例（页面实际调用的部分） */
export interface ZlmRtcEndpoint {
  /** 底层 RTCPeerConnection，close() 之后为 null */
  pc: RTCPeerConnection | null
  options: ZlmRtcOptions | null
  /** 远端媒体流，用于取尺寸 / 统计 */
  readonly remoteStream: MediaStream | null
  readonly localStream: MediaStream | null
  on: (event: string, handler: (data: any) => void) => boolean
  off: (event: string, handler: (data: any) => void) => boolean
  offAll: () => void
  dispatch: (event: string, data?: any) => boolean
  /** 只收不发（构造时 recvOnly 自动调用） */
  receive: () => void
  /** 采集 + 推流 */
  start: () => void
  /** 关闭 pc、停掉所有 track，实例不可复用 */
  close: () => void
}

/**
 * WEBRTC_ON_REMOTE_STREAMS 的回调参数：
 * 这个版本派发的是 RTCTrackEvent（不是 MediaStream），流在 event.streams[0]。
 */
export interface ZlmRtcTrackEvent {
  streams?: MediaStream[]
  track?: MediaStreamTrack
}

/** 库挂在 window 上的构造器 */
export interface ZlmRtcClient {
  Endpoint: new (options: ZlmRtcOptions) => ZlmRtcEndpoint
  Events: typeof ZLM_RTC_EVENTS
}

declare global {
  interface Window {
    ZLMRTCClient?: ZlmRtcClient
  }
}

let pending: Promise<void> | null = null

export function isZlmRtcReady(): boolean {
  return typeof window.ZLMRTCClient?.Endpoint === 'function'
}

/**
 * 按需注入脚本，多个页面 / 多次重试共用同一个 Promise。
 * 加载失败时清空缓存，下次连接还能重试。
 */
export function loadZlmRtc(): Promise<void> {
  if (isZlmRtcReady()) return Promise.resolve()
  if (pending) return pending

  pending = loadScript(ZLM_RTC_SCRIPT)
    .then(() => {
      // 脚本 200 但没挂上构造器，说明发布时漏了这个文件或被网关改写成了 HTML
      if (!isZlmRtcReady()) throw new Error(`ZLMRTCClient.js 已加载，但 window.ZLMRTCClient 不存在`)
    })
    .catch((e: unknown) => {
      pending = null
      throw e
    })

  return pending
}

/**
 * 按 ZLMediaKit 的接口拼 SDP 交换地址。
 *
 * 服务端约定：`/<base>/index/api/webrtc?app=<app>&stream=<stream>&type=play`
 * type 取 play（拉流）/ push（推流）/ echo（回声测试）。
 */
export function buildZlmSdpUrl(
  server: string,
  app: string,
  stream: string,
  type: 'play' | 'push' | 'echo' = 'play',
): string {
  const base = server.trim().replace(/\/+$/, '')
  const params = new URLSearchParams({ app: app.trim(), stream: stream.trim(), type })
  return `${base}/index/api/webrtc?${params.toString()}`
}
