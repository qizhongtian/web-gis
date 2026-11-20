/**
 * Jessibuca（开源版）按需加载 + 类型声明
 *
 * 官方仓库 https://github.com/langhuihui/jessibuca ，文档 https://jessibuca.com/api.html
 *
 * 开源版只支持 ws-raw / ws-flv / http(s)-flv 三种协议，编码支持 H.264 与 H.265：
 * - H.264：useMSE（<video> 硬解）或 useWCS（WebCodecs，需 Chrome 94+ 且 https/localhost）
 * - H.265：浏览器不原生支持，只能走 wasm 软解（decoder.js + decoder.wasm）
 *
 * dist 目录三个文件必须同目录：jessibuca.js / decoder.js / decoder.wasm。
 * 主文件约 1 MB、wasm 约 2~3 MB，不参与打包：只有打开示例页时才注入 <script>。
 *
 * 两种取源方式：
 * - 本地（默认）：public/jessibuca/ 下已放 v3 的 dist 三个文件，用 assetUrl 拼 BASE_URL 避免子路径 404
 * - CDN：jsDelivr 的 gh/langhuihui/jessibuca@v3/dist，解码器同目录，受网络影响
 */
import { loadScript } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/** 构造参数（只声明页面用到的项，完整列表见官方 API 文档） */
export interface JessibucaOptions {
  /** 挂载容器，必填；不要传 canvas/video，也不要对它做 transform */
  container: HTMLElement | string
  /** 缓冲时长（秒），默认 1；调小更实时、更易卡 */
  videoBuffer?: number
  /** true 等比留黑边，false 拉伸铺满；<video> 渲染（MSE）时无效 */
  isResize?: boolean
  /** 等比裁切铺满，等价 setScaleMode(2) */
  isFullResize?: boolean
  /** MediaSource 硬解，仅 H.264；iOS Safari 无 MSE */
  useMSE?: boolean
  /** WebCodecs 硬解，仅 H.264，需 Chrome 94+ 与 https/localhost */
  useWCS?: boolean
  /** decoder.js 地址；decoder.wasm 必须与它同目录。相对路径以「当前页面 URL」为基准 */
  decoder?: string
  /** 是否解析音频；关掉能省解码开销 */
  hasAudio?: boolean
  /** ws 地址不带 .flv 时强制按 FLV 解析 */
  isFlv?: boolean
  /** 底部操作按钮开关，默认全 false */
  operateBtns?: {
    fullscreen?: boolean
    screenshot?: boolean
    play?: boolean
    audio?: boolean
    record?: boolean
  }
  /** 起播超时（秒），默认 10 */
  timeout?: number
  /** 播放中心跳超时（秒），默认 10 */
  heartTimeout?: number
  /** 心跳超时后自动重播 */
  heartTimeoutReplay?: boolean
  /** 重播次数，-1 表示无限 */
  heartTimeoutReplayTimes?: number
  /** 起播阶段无数据超时（秒） */
  loadingTimeout?: number
  /** 起播超时自动重试 */
  loadingTimeoutReplay?: boolean
  /** H.265 硬解不支持时自动降级 wasm，默认 true；设 false 直接报错 */
  autoWasm?: boolean
  /** 控制台日志 */
  debug?: boolean
  /** 右上角码率 */
  showBandwidth?: boolean
  /** 加载提示文字 */
  loadingText?: string
  /** 背景图 */
  background?: string
  /** 默认不静音（仍需用户手势才能出声） */
  isNotMute?: boolean
  /** 双击全屏 */
  supportDblclickFullscreen?: boolean
  /** 控制条自动隐藏 */
  controlAutoHide?: boolean
  /** 页签切到后台自动暂停 */
  hiddenAutoPause?: boolean
  /** Esc 退全屏、上下键调音量 */
  hotKey?: boolean
  /** 移动端网页全屏（iOS 推荐） */
  useWebFullScreen?: boolean
  /** 旋转角度 */
  rotate?: 0 | 90 | 180 | 270
  /** 水印文字 */
  text?: string
}

/** videoInfo 事件参数：encTypeCode 10 = H.264，12 = H.265 */
export interface JessibucaVideoInfo {
  width: number
  height: number
  encTypeCode?: number
  encType?: string
}

/** audioInfo 事件参数：encTypeCode 10 = AAC，7 = G711A，8 = G711U */
export interface JessibucaAudioInfo {
  numOfChannels?: number
  sampleRate?: number
  encTypeCode?: number
  encType?: string
}

/** stats 事件参数：每秒一次 */
export interface JessibucaStats {
  buf?: number
  fps?: number
  abps?: number
  vbps?: number
  ts?: number
}

/** 播放器实例（页面实际调用的方法） */
export interface JessibucaInstance {
  /** 起播；返回 Promise，必须 catch。headers 仅对 http 生效 */
  play: (url: string, options?: { headers?: Record<string, string> }) => Promise<void>
  /** 暂停后再 play() 可续播同一路流 */
  pause: () => Promise<void>
  /** 释放资源，推荐 await */
  destroy: () => Promise<void>
  mute: () => void
  cancelMute: () => void
  /** 在用户手势里恢复音频 */
  audioResume: () => void
  /** 0~1，仍会解码音频（与 mute 不同） */
  setVolume: (volume: number) => void
  setBufferTime: (seconds: number) => void
  /** 0 拉伸 / 1 留边 / 2 裁切 */
  setScaleMode: (mode: 0 | 1 | 2) => void
  setRotate: (degree: number) => void
  setFullscreen: (flag: boolean) => void
  resize: () => void
  clearView: () => void
  /** type 为 base64 时返回字符串；download 直接下载 */
  screenshot: (
    name?: string,
    format?: 'png' | 'jpeg',
    quality?: number,
    type?: 'download' | 'base64' | 'blob',
  ) => string | Blob | void
  isPlaying: () => boolean
  isMute: () => boolean
  /** 事件监听：videoInfo / audioInfo / stats / kBps / performance / error / timeout … */
  on: (event: string, handler: (...args: any[]) => void) => void
  setDebug?: (flag: boolean) => void
}

declare global {
  interface Window {
    Jessibuca?: {
      new (options: JessibucaOptions): JessibucaInstance
      /** 错误码常量，判断 error 事件用，不要硬编码字符串 */
      ERROR: Record<string, string>
      /** 超时常量 */
      TIMEOUT: Record<string, string>
    }
  }
}

/**
 * CDN 取源：走 GitHub 的 v3 分支 dist
 *
 * npm 上的 jessibuca 只有 4.0.0 的 monorepo 源码（packages/*），没有编译后的 jessibuca.js，
 * 所以不能写 cdn.jsdelivr.net/npm/jessibuca@3/...；v3 分支的 dist 才是可直接加载的产物。
 */
export const JESSIBUCA_CDN = 'https://cdn.jsdelivr.net/gh/langhuihui/jessibuca@v3/dist/jessibuca.js'
export const JESSIBUCA_CDN_DECODER = 'https://cdn.jsdelivr.net/gh/langhuihui/jessibuca@v3/dist/decoder.js'

/** 本地取源：把 dist 三个文件放到 public/jessibuca/（部署在子路径下必须用 assetUrl） */
export const JESSIBUCA_LOCAL = assetUrl('jessibuca/jessibuca.js')
export const JESSIBUCA_LOCAL_DECODER = assetUrl('jessibuca/decoder.js')

export function isJessibucaReady(): boolean {
  return typeof window.Jessibuca === 'function'
}

/** 已注入的脚本共用同一个 Promise；失败时清缓存，允许重试 */
const pending = new Map<string, Promise<void>>()

export function loadJessibuca(script = JESSIBUCA_CDN): Promise<void> {
  if (isJessibucaReady()) return Promise.resolve()
  const cached = pending.get(script)
  if (cached) return cached

  const task = loadScript(script)
    .then(() => {
      // 脚本 200 但没挂全局，通常是地址指向了别的构建产物
      if (!isJessibucaReady()) {
        pending.delete(script)
        throw new Error('jessibuca.js 已加载，但 window.Jessibuca 不存在，请确认地址指向 dist/jessibuca.js')
      }
    })
    .catch((e: unknown) => {
      pending.delete(script)
      throw e instanceof Error ? e : new Error(String(e))
    })

  pending.set(script, task)
  return task
}

/** decoder.js 与 jessibuca.js 必须配套（3.x 与 4.x 不能混用），按主脚本来源推断 */
export function decoderOf(script: string): string {
  if (script.includes('cdn.jsdelivr.net') || script.includes('unpkg.com')) {
    return script.replace(/jessibuca(\.min)?\.js$/, 'decoder.js')
  }
  return JESSIBUCA_LOCAL_DECODER
}
