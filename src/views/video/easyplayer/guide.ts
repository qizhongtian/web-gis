import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** EasyPlayer.js 说明：按需加载 → 起播 → 换流/销毁 → 解码选择 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '最小可用示例',
    desc: '播放器是 UMD 脚本，挂到 window.EasyPlayerPro；容器由库自己往里插 video / canvas',
    code: `<!-- 1. 原样引入（不参与打包），同目录的 lib / decode / wasm 必须一起发布 -->
<script src="/easyplayer/EasyPlayer-pro.js"></script>

<script>
const host = document.querySelector('#player')

// 2. 容器建实例
const player = new EasyPlayerPro(host, {
  isLive: true,      // 直播 true；点播 mp4 / m3u8 传 false
  hasAudio: false,   // 解析音频（开音频后浏览器会拦自动播放）
  isMute: true,
  bufferTime: 0.5,   // 最小缓冲，库会自动追帧降延迟
  isBand: true,      // 右上角网络状态
  lang: 'zh',
})

// 3. 起播
player.play('http://host:8090/live/stream.flv')  // 直播 / flv
// player.playback('https://host/a.m3u8')        // 点播，仅 mp4 / m3u8
</script>`,
  },
  {
    title: '直播与点播走不同方法',
    desc: 'playback() 只接受 mp4 / m3u8，传 flv 会直接 reject；isLive: false 时 play() 也会走同一条校验',
    code: `// ✅ 点播文件（mp4 / m3u8）
new EasyPlayerPro(host, { isLive: false }).playback(url)

// ✅ 直播 / flv / ws-flv：必须 isLive: true，否则会按点播校验地址而失败
new EasyPlayerPro(host, { isLive: true }).play(url)

// 判断规则（本项目示例页同款）
const playAsVod = !isLive && /\\.mp4|\\.m3u8/i.test(url)`,
  },
  {
    title: '解码方式怎么选',
    desc: 'MSE 走浏览器硬解最省 CPU；H.265 只有 WASM / WASM SIMD 能软解，代价是首个包大、解码吃 CPU',
    code: `new EasyPlayerPro(host, {
  MSE: true,        // 默认，H.264 + MSE
  WCS: true,        // WebCodecs：新浏览器上更省心
  WASM: true,       // WASM 软解（H.265 首选）
  WASMSIMD: true,   // SIMD 版软解，多路更划算
})

// 实测：H.265 走 MSE 只会报「不支持的编码」，
// 必须切 WASM / WASMSIMD 才能出画面（canvas 渲染，没有 <video> 元素）`,
  },
  {
    title: '截图、倍速、全屏与销毁',
    desc: '常用方法都在实例上；换流 / 换参数只能 destroy 后重建，库没有「换流」入口',
    code: `player.screenshot('snap', 'png', 0.92, 'base64') // 返回 base64
player.setRate(2)          // 仅点播，实时流会 reject
player.seekTime(30)        // 点播跳转到 30s
player.setMute(true)
player.setFullscreen(true)
player.pause()

// 换地址 / 换解码方式 / 切直播点播
player.destroy()
player = new EasyPlayerPro(host, newConfig)`,
  },
  {
    title: '按需加载：不要进首屏',
    desc: '本体 3.6 MB + wasm 约 6 MB，写进 index.html 会让所有页面白等；进示例页时再注入',
    code: `import { assetUrl } from '@/utils/publicUrl'

const SRC = assetUrl('easyplayer/EasyPlayer-pro.js') // 子路径部署也不会 404

let pending = null
export function loadEasyPlayer() {
  if (window.EasyPlayerPro) return Promise.resolve()
  if (pending) return pending          // 多路 / 反复进出共用一次加载
  pending = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SRC
    el.async = true
    el.onload = () => (window.EasyPlayerPro ? resolve() : reject(new Error('未挂上 EasyPlayerPro')))
    el.onerror = () => { pending = null; reject(new Error('加载失败')) }
    document.head.appendChild(el)
  })
  return pending
}`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '整个目录必须一起发布',
    body: '`EasyPlayer-pro.js` 只负责界面与调度，解码靠同目录的 `EasyPlayer-lib.js`、`EasyPlayer-decode.js` 和 `EasyPlayer-pro.wasm` / `EasyPlayer-snap.wasm`，路径是「相对脚本所在目录」算的。只拷 pro.js 会出现「脚本加载成功但一播放就报错」。本项目放在 `public/easyplayer/`。',
  },
  {
    title: '不要 import 进打包器',
    body: '它是带 UMD 头和 wasm 加载器的成品包，`import EasyPlayerPro from \'xxx/EasyPlayer-pro.js\'` 会被 Vite 当成普通模块处理，内部按 `document.currentScript.src` 定位 wasm 的逻辑随之失效。正确做法是注入 `<script>`，走全局 `window.EasyPlayerPro`。',
  },
  {
    title: '换流必须销毁重建',
    body: '库没有 `switchUrl()` 之类的方法，直接对新地址再调一次 `play()` 会把上一路解码线程、WebSocket、MSE buffer 留在后台。多切几次页面就被拖垮，所以本页每次改参数都 `destroy()` 后 `new` 一次。',
  },
  {
    title: 'H.265 只能软解',
    body: 'MSE 只认浏览器支持的编码，H.265 走 `MSE: true` 必然失败，要传 `WASM: true` 或 `WASMSIMD: true`。软解是 canvas 渲染，页面取不到 `<video>`，进度、音量得改用库自己的方法（`seekTime` / `setMute`）。',
  },
  {
    title: '子路径部署注意 wasm',
    body: 'GitHub Pages 这类部署在 `/web-gis/` 下的场景，脚本地址要用 `assetUrl()` 拼 BASE_URL，否则请求会打到域名根目录变 404；服务器还需返回 `application/wasm` 的 MIME，不然控制台会报 `Incorrect response MIME type`。',
  },
  {
    title: '音频会触发自动播放限制',
    body: '`hasAudio: true` 后浏览器会按「有声自动播放」拦截，表现为起播失败或画面静音。要么先 `isMute: true` 起播、由用户点一次再 `setMute(false)`，要么保持只出画面。',
  },
  {
    title: '示例源说明',
    body: '默认播 jsDelivr 上的 MP4（带 `Access-Control-Allow-Origin: *`、支持 Range），另备 Mux 的公开 m3u8 与阿里云 FLV；FLV 走 `play()` 且 `isLive: true`，因为 `playback()` 只接受 mp4 / m3u8。点播是 XHR 拉片，源站不放行跨域就会直接失败，所以像 `media.w3.org` 这类站点不能当示例。公网示例随时可能失效，换成自己的流地址即可。',
  },
]
