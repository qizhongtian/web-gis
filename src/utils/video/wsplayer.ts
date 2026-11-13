/**
 * 大华 WSPlayer 播放器：按需加载 + 轻量封装
 *
 * 解码库与样式放在 public/wsplayer/WSPlayer/ 下，由 Vite 原样拷贝到 dist（不参与打包、不做 hash），
 * 只有真正进入视频页面时才注入脚本，因此首页与其他页面零成本。
 * 部署到子路径（GitHub Pages）时用 assetUrl 拼 BASE_URL，避免 404。
 */
import { loadCss, loadScript } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/**
 * 解码库前缀，对应 new WSPlayer({ prefixUrl })；形如 /web-gis/wsplayer
 *
 * 注意：WSPlayer 内部 processPrefixUrl 会把前缀拼成 `/${prefixUrl}`，
 * 因此这里必须去掉前导斜杠，否则会变成 //wsplayer（被浏览器当成协议相对地址）。
 */
export const WS_PLAYER_PREFIX = assetUrl('wsplayer').replace(/^\/+/, '')

/**
 * 从 ws 地址推断协议；地址没写协议时返回 null
 *
 * 页面协议只决定「默认值」，最终以地址为准：http 页面也能填 wss://，
 * 协议不一致时由页面重建实例（见各页面 ensureProtocol）。
 */
export function wsProtocolOf(url: string): 'ws' | 'wss' | null {
  const matched = /^(wss?):\/\//i.exec(url.trim())
  return matched ? (matched[1].toLowerCase() as 'ws' | 'wss') : null
}

/** WSPlayer 暴露在 window 上，这里只声明用到的部分 */
type WsPlayerInstance = Record<string, any>

export type WsPlayerAdapter = 'selfAdaption' | 'stretching'

/** real - 实时预览   record - 录像回放 */
export type WsPlayerType = 'real' | 'record'

export interface WsPlayOptions {
  /** rtsp 地址（需带 token，30 秒内有效） */
  rtspURL: string
  /** websocket 地址，需与 rtsp 指向同一流媒体服务 */
  wsURL: string
  /** 通道编码 */
  channelId: string
  /** 1-主码流 2-辅码流1 3-辅码流2 */
  streamType?: number
  /** 窗口序号，从 0 开始 */
  selectIndex?: number
  playerAdapter?: WsPlayerAdapter
  channelData?: Record<string, any>
}

/** 录像文件（平台「查询录像文件列表」接口返回的数组元素，原样透传） */
export type WsRecordFile = Record<string, any>

export interface WsRecordOptions {
  /** 回放 rtsp 地址（时间形式回放，需带 token） */
  rtspURL: string
  /** 回放 websocket 地址，默认端口 ws 9320 / wss 9322 */
  wsURL: string
  /** 通道编码 */
  channelId: string
  /** 录像文件列表：不传则进度条不可拖拽 */
  records?: WsRecordFile[]
  /** 窗口序号，从 0 开始 */
  selectIndex?: number
  /** 开始时间（秒级时间戳），不传则从 records 中截取 */
  startTime?: number
  /** 结束时间（秒级时间戳），不传则从 records 中截取 */
  endTime?: number
  /** 默认 true；进度条拖拽异常时传 false */
  playRecordByTime?: boolean
  playerAdapter?: WsPlayerAdapter
  channelData?: Record<string, any>
}

export interface WsPlayerInitOptions {
  /** 容器元素 id（播放器会把分屏 DOM 挂载到该元素内） */
  el: string
  /** real - 实时预览（默认）  record - 录像回放 */
  type?: WsPlayerType
  /** 初始显示路数，支持 1 4 9 16 25 */
  num?: number
  /** 最大路数 */
  maxNum?: number
  /** ws / wss，https 页面必须用 wss */
  protocol?: 'ws' | 'wss'
  /** 是否显示播放器底部工具栏 */
  showControl?: boolean
  /** 拉流超时（毫秒），默认 15 秒 */
  rtspResponseTimeout?: number
  /** 是否只加载单线程解码库（无 SharedArrayBuffer 时可设为 true） */
  onlyLoadSingleLib?: boolean
  /** 播放器事件回调 */
  onMessage?: (method: string, data: any, err?: any) => void
}

let libPromise: Promise<new (options: any) => WsPlayerInstance> | null = null

/**
 * 动态加载 WSPlayer 解码库（幂等）
 * 顺序很重要：先 PlaySDKInterface.js，再 WSPlayer.js
 */
export function loadWSPlayerLib(): Promise<new (options: any) => WsPlayerInstance> {
  const globalObj = window as any
  if (typeof globalObj.WSPlayer === 'function') {
    return Promise.resolve(globalObj.WSPlayer)
  }
  if (libPromise) return libPromise

  libPromise = (async () => {
    await loadCss(`${WS_PLAYER_PREFIX}/WSPlayer/player.css`)
    await loadScript(`${WS_PLAYER_PREFIX}/WSPlayer/PlaySDKInterface.js`)
    await loadScript(`${WS_PLAYER_PREFIX}/WSPlayer/WSPlayer.js`)
    const mod = globalObj.WSPlayer
    const ctor = mod?.WSPlayer ?? mod?.default ?? mod
    if (typeof ctor !== 'function') {
      throw new Error(`WSPlayer 解码库加载失败，请检查 ${WS_PLAYER_PREFIX}/WSPlayer 是否存在`)
    }
    // 统一收敛成构造函数，页面后续判断只需 typeof === 'function'
    globalObj.WSPlayer = ctor
    return ctor as new (options: any) => WsPlayerInstance
  })()

  libPromise.catch(() => {
    libPromise = null
  })
  return libPromise
}

/**
 * 播放器实例封装：负责初始化、拉流、销毁，避免页面里散落生命周期代码
 */
export class WsPlayerHost {
  private instance: WsPlayerInstance | null = null
  /** 初始化完成前发起的播放请求，等 initializationCompleted 后补发 */
  private pendingPlay: { type: WsPlayerType; options: WsPlayOptions | WsRecordOptions } | null = null
  private initialized = false
  private playerType: WsPlayerType = 'real'

  get player(): WsPlayerInstance | null {
    return this.instance
  }

  get isReady(): boolean {
    return this.initialized
  }

  /** 初始化播放器（重复调用会先销毁旧实例） */
  async init(options: WsPlayerInitOptions): Promise<void> {
    const WSPlayerCtor = await loadWSPlayerLib()
    this.destroy()

    this.playerType = options.type || 'real'
    this.instance = new WSPlayerCtor({
      el: options.el,
      type: this.playerType,
      theme: 'default',
      prefixUrl: WS_PLAYER_PREFIX,
      protocol: options.protocol || (window.location.protocol === 'https:' ? 'wss' : 'ws'),
      playerAdapter: 'selfAdaption',
      rtspResponseTimeout: options.rtspResponseTimeout || 15000,
      config: {
        num: options.num || 1,
        maxNum: options.maxNum || 4,
        showControl: options.showControl !== false,
        showTopOperate: true,
        onlyLoadSingleLib: !!options.onlyLoadSingleLib,
        localeLang: 'zhCN',
        draggable: false,
      },
      receiveMessageFromWSPlayer: (method: string, data: any, err?: any) => {
        if (method === 'initializationCompleted') {
          this.initialized = true
          // 初始化完成前调用播放会被丢弃，这里把挂起的请求补上
          if (this.pendingPlay) {
            const play = this.pendingPlay
            this.pendingPlay = null
            if (play.type === 'record') this.recordByUrl(play.options as WsRecordOptions)
            else this.realByUrl(play.options as WsPlayOptions)
          }
        }
        options.onMessage?.(method, data, err)
      },
      // 演示页不接入平台接口，改为直接传入 ws / rtsp 地址；保留占位避免未定义调用
      getRealRtsp: () => Promise.reject(new Error('未接入大华平台接口，请使用 realByUrl 直接传入地址')),
      getTalkRtsp: () => Promise.reject(new Error('未接入大华平台接口')),
      stopTalk: () => Promise.resolve(),
    })
  }

  /** 按地址实时预览（可传多个窗口） */
  realByUrl(options: WsPlayOptions): void {
    if (!this.instance) return
    if (!this.initialized) {
      // 解码库尚在初始化，先缓存，initializationCompleted 后自动播放
      this.pendingPlay = { type: 'real', options }
      return
    }
    this.instance.realByUrl({
      rtspURL: options.rtspURL,
      wsURL: options.wsURL,
      channelId: options.channelId,
      streamType: options.streamType ?? 1,
      selectIndex: options.selectIndex ?? 0,
      playerAdapter: options.playerAdapter || 'selfAdaption',
      channelData: options.channelData || {},
    })
  }

  /** 按地址录像回放（需 type 为 record 的实例） */
  recordByUrl(options: WsRecordOptions): void {
    if (!this.instance) return
    if (!this.initialized) {
      this.pendingPlay = { type: 'record', options }
      return
    }
    const records = options.records || []
    this.instance.recordByUrl({
      rtspURL: options.rtspURL,
      wsURL: options.wsURL,
      channelId: options.channelId,
      records,
      selectIndex: options.selectIndex ?? 0,
      // 默认 true；拖拽进度条异常时传 false
      playRecordByTime: options.playRecordByTime !== false,
      // 秒级时间戳，不传则由 records 中截取
      startTime: options.startTime,
      endTime: options.endTime,
      playerAdapter: options.playerAdapter || 'selfAdaption',
      // 通道信息里也带上录像列表，播放器内部取用
      channelData: options.channelData || { records },
    })
  }

  /** 回放暂停 */
  pause(index = 0): void {
    this.instance?.pause(index)
  }

  /** 回放继续（仅暂停后有效） */
  resume(index = 0): void {
    this.instance?.play(index)
  }

  /** 回放倍速：0.125 0.25 0.5 1 1.25 1.5 2 4 8 */
  playSpeed(speed: number, index = 0): void {
    this.instance?.playSpeed(speed, index)
  }

  /** 跳转到指定时间点；isSeekTime 为 true 时直接 seek 录像 */
  jumpPlayByTime(time: number | string, index = 0, isSeekTime = true): void {
    this.instance?.jumpPlayByTime(time, index, isSeekTime)
  }

  /** 设置显示路数：1 2 3 4 6 8 9 16 25 */
  setPlayerNum(num: number): void {
    this.instance?.setPlayerNum(num)
  }

  /** 原始比例 / 画面铺满 */
  setPlayerAdapter(adapter: WsPlayerAdapter): void {
    this.instance?.setPlayerAdapter(adapter)
  }

  /** 关闭指定窗口，不传则关闭全部 */
  close(index?: number): void {
    this.instance?.close(index, 'api')
  }

  /** 销毁实例并清空容器，离开页面时调用 */
  destroy(el?: string): void {
    try {
      this.instance?.destroy()
    } catch {
      /* 实例已销毁或解码库未就绪，忽略 */
    }
    this.instance = null
    this.initialized = false
    this.pendingPlay = null
    if (el) {
      const host = document.getElementById(el)
      if (host) host.innerHTML = ''
    }
  }
}
