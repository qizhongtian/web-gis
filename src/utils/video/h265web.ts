/**
 * h265web.js（numberwolf/h265web.js）按需加载 + 类型声明
 *
 * 官方仓库 https://github.com/numberwolf/h265web.js
 *
 * 用 wasm 软解播放浏览器原生不支持的 H.265，支持 http-flv / ws-flv / HLS / MP4，
 * 没有 MSE / WebCodecs 的硬解通道，因此 4K 或多路并发对 CPU 压力很大。
 *
 * 仓库提供两代 API：
 * - v2 之后（static/h265web.js）：H265webjsPlayer() → build(config) → load_media(url) → play()
 * - 早期版本（dist/h265web.js）：new265webjs(...) 一把梭，参数顺序各分支不同，本页不支持
 *
 * SDK 除主脚本外还需要 wasm 资源（h265web_wasm.js / .wasm 等），
 * 体积大且不能跨域随意取，一般放 public/h265web/ 同源部署，base_url 指向该目录。
 */
import { loadScript } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/** build() 的配置项 */
export interface H265webBuildConfig {
  /** 挂载容器的 DOM id，SDK 内部 getElementById */
  player_id: string
  /** wasm 资源根目录，末尾带 /；同源部署时用 assetUrl 拼 BASE_URL */
  base_url: string
  /** wasm 装载器地址（h265web_wasm.js），SDK 无默认值，必填 */
  wasm_js_uri?: string
  /** wasm 解码器地址（h265web_wasm.wasm），SDK 无默认值，必填 */
  wasm_wasm_uri?: string
  /** 播放区宽高（像素），SDK 会创建对应尺寸的 canvas */
  width: number
  height: number
  /** 是否由 SDK 自动起播；建议 false，交给页面在 ready 后调 play() */
  auto_play?: boolean
  /** 丢弃音频，省解码开销 */
  ignore_audio?: boolean
  /** 内核/协议标识，不同版本取值不同，一般不用传 */
  core?: string
}

/** 播放器实例：回调靠属性赋值，方法按需存在 */
export interface H265webPlayer {
  build: (config: H265webBuildConfig) => boolean
  load_media: (url: string) => void
  play: () => void
  pause: () => void
  resume?: () => void
  /** 秒 */
  seek?: (seconds: number) => void
  /** 音量：v2 文档为 0~1，早期分支按 0~100，需按实际 SDK 试 */
  set_voice?: (volume: number) => void
  setVoice?: (volume: number) => void
  snapshot?: () => void
  /** 释放 wasm 线程与 canvas，cb 可选 */
  release: (callback?: () => void) => void
  /** 首帧渲染完成 */
  on_ready_show_done_callback?: () => void
  /** 每秒一次，单位秒 */
  on_play_time?: (seconds: number) => void
  onPlayStart?: () => void
  onPlayPause?: () => void
  onPlayFinish?: () => void
  on_error_callback?: (error: unknown) => void
  /** 不同版本的其它回调，统一放过 */
  [key: string]: any
}

declare global {
  interface Window {
    /** v2+ 工厂函数 */
    H265webjsPlayer?: () => H265webPlayer
    /** 早期版本的全局函数 */
    new265webjs?: (...args: any[]) => any
  }
}

/** CDN 取源：直接取仓库 static 目录，便于开箱验证；生产请改本地同源 */
export const H265WEB_CDN = 'https://cdn.jsdelivr.net/gh/numberwolf/h265web.js@master/static/h265web.js'
export const H265WEB_CDN_BASE = 'https://cdn.jsdelivr.net/gh/numberwolf/h265web.js@master/static/'

/** 本地取源：把 dist/static 下的 js 与 wasm 一起放到 public/h265web/ */
export const H265WEB_LOCAL = assetUrl('h265web/h265web.js')
export const H265WEB_LOCAL_BASE = assetUrl('h265web/')

/**
 * wasm 装载器与解码器本体
 *
 * SDK 内部只对 wasm_js_uri / wasm_wasm_uri 做 URL 解析，没有默认文件名，
 * 所以 build 时必须显式传这两个值，否则起播时报 wasm 资源 404。
 */
export const H265WEB_WASM_JS = 'h265web_wasm.js'
export const H265WEB_WASM_BIN = 'h265web_wasm.wasm'

export type H265webKind = 'v2' | 'legacy' | null

/** 判断当前页面挂的是哪一代 SDK，避免调错 API */
export function detectH265web(): H265webKind {
  if (typeof window.H265webjsPlayer === 'function') return 'v2'
  if (typeof window.new265webjs === 'function') return 'legacy'
  return null
}

const pending = new Map<string, Promise<void>>()

export function loadH265web(script = H265WEB_CDN): Promise<void> {
  if (detectH265web()) return Promise.resolve()
  const cached = pending.get(script)
  if (cached) return cached

  const task = loadScript(script)
    .then(() => {
      // 脚本 200 但没挂全局：多半取到了别的构建产物，或地址指向 demo 页面
      if (!detectH265web()) {
        pending.delete(script)
        throw new Error('h265web.js 已加载，但未找到 H265webjsPlayer / new265webjs，请确认地址指向 SDK 主文件')
      }
    })
    .catch((e: unknown) => {
      pending.delete(script)
      throw e instanceof Error ? e : new Error(String(e))
    })

  pending.set(script, task)
  return task
}

/** release() 是回调式，这里包成 Promise 便于 finally 清理 */
export function releasePlayer(player: H265webPlayer | null): Promise<void> {
  return new Promise((resolve) => {
    if (!player) return resolve()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    try {
      player.release(finish)
    } catch {
      return finish()
    }
    // SDK 个别版本回调不触发，兜底超时
    setTimeout(finish, 600)
  })
}
