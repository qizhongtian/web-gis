/**
 * EasyPlayer.js（EasyPlayerPro）按需加载 + 类型声明
 *
 * 播放器本体 `EasyPlayer-pro.js` 约 3.6 MB，起播后还会再拉 wasm 软解器（合计约 10 MB），
 * 所以不参与打包、也不写进 index.html：只有真正打开 EasyPlayer 示例页时才注入 <script>。
 *
 * 资源放在 public/easyplayer/（不参与打包、不做 hash），库内部按「脚本所在目录」相对路径
 * 加载 EasyPlayer-lib.js / EasyPlayer-decode.js / *.wasm，因此整个目录必须一起发布。
 * 部署在 /web-gis/ 子路径下时用 assetUrl 拼 BASE_URL，否则脚本与 wasm 都会 404。
 */
import { assetUrl } from '@/utils/publicUrl'

/** 播放器构造参数（只声明页面用到的项，完整能力见官方 demo 文档） */
export interface EasyPlayerProConfig {
  /** 直播 / 点播；false 时库内部按 mp4、m3u8 校验地址 */
  isLive?: boolean
  /** 是否解析音频，默认关闭：开音频后浏览器会拦截自动播放 */
  hasAudio?: boolean
  /** 静音渲染 */
  isMute?: boolean
  /**
   * 画面是否拉伸铺满。
   * 注意语义与字面相反：该值直接赋给内部 `isResize`，而 `isResize` 为假时才是 fill（拉伸）。
   */
  stretch?: boolean
  /** 最小缓冲时长（秒），播放器会自动追帧消除累积延迟 */
  bufferTime?: number
  /** 加载超时（秒） */
  loadTimeOut?: number
  /** 重连次数，-1 表示一直重连 */
  loadTimeReplay?: number
  /** MSE 解码（默认） */
  MSE?: boolean
  /** WebCodecs 解码 */
  WCS?: boolean
  /** WASM 软解（H.265 需要） */
  WASM?: boolean
  /** WASM SIMD 软解 */
  WASMSIMD?: boolean
  /** 强制按 flv 解析 */
  isFlv?: boolean
  /** 水印 */
  watermark?: Record<string, unknown>
  /** 控制台日志 */
  debug?: boolean
  /** 右上角网络状态 */
  isBand?: boolean
  /** 界面语言，默认 zh */
  lang?: 'zh' | 'en'
  /** 工具条按钮开关 */
  btns?: Record<string, boolean>
}

/** 播放器实例（页面实际调用的方法） */
export interface EasyPlayerProInstance {
  /** 直播 / 通用起播 */
  play: (url: string) => Promise<void>
  /** 点播起播（仅 mp4 / m3u8） */
  playback: (url: string) => Promise<void>
  pause: () => void
  isPause: () => boolean
  setMute: (muted: boolean) => void
  isMute: () => boolean
  /** 截图；type 为 base64 时返回 base64 字符串 */
  screenshot: (
    filename?: string,
    format?: 'png' | 'jpeg' | 'webp',
    quality?: number,
    type?: 'download' | 'base64' | 'blob',
  ) => string | Promise<string>
  /** 全屏 / 退出全屏 */
  setFullscreen: (flag: boolean) => void
  exitFullscreen: () => void
  /** 点播倍速，实时流会 reject */
  setRate: (rate: number) => void
  /** 点播跳转（秒） */
  seekTime: (seconds: number) => void
  /** 销毁实例，释放解码线程 */
  destroy: () => void
  /** 事件监听：play / pause / error / timeout / liveEnd / timestamps … */
  on: (event: string, handler: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    EasyPlayerPro?: new (
      container: HTMLElement,
      config?: EasyPlayerProConfig,
    ) => EasyPlayerProInstance
  }
}

/** 播放器脚本地址：/web-gis/easyplayer/EasyPlayer-pro.js */
export const EASYPLAYER_SCRIPT = assetUrl('easyplayer/EasyPlayer-pro.js')

let pending: Promise<void> | null = null

export function isEasyPlayerReady(): boolean {
  return typeof window.EasyPlayerPro !== 'undefined'
}

/**
 * 按需注入播放器脚本，多个页面 / 多次重试共用同一个 Promise。
 * 加载失败清空缓存，下次起播还能重试。
 */
export function loadEasyPlayer(): Promise<void> {
  if (isEasyPlayerReady()) return Promise.resolve()
  if (pending) return pending

  pending = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = EASYPLAYER_SCRIPT
    el.async = true
    el.addEventListener(
      'load',
      () => {
        // 脚本 200 但没挂上构造器，多半是发布时漏了同目录的 lib / wasm
        if (!isEasyPlayerReady()) {
          pending = null
          reject(new Error('EasyPlayer-pro.js 已加载，但 window.EasyPlayerPro 不存在'))
          return
        }
        resolve()
      },
      { once: true },
    )
    el.addEventListener(
      'error',
      () => {
        el.remove()
        pending = null
        reject(new Error(`script load failed: ${EASYPLAYER_SCRIPT}`))
      },
      { once: true },
    )
    document.head.appendChild(el)
  })

  return pending
}
