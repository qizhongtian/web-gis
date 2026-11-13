import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../../guide-types'

/**
 * 实时预览页的说明内容
 * 来源：大华 WSPlayer demo 与《高频问题 FAQ》
 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '静态资源：放 public 原样拷贝',
    desc: '解码库约 26MB，放 public/wsplayer 由 Vite 直接复制进 dist，不参与打包、不做 hash',
    code: `public/wsplayer/WSPlayer/
  WSPlayer.js          // 383KB 播放器主体
  PlaySDKInterface.js  // 250KB 解码库接口，必须先于 WSPlayer.js 加载
  player.css           // 已 @import window.division / pantilt / datePicker
  multiThread/         // 多线程解码（依赖 SharedArrayBuffer）
  singleThread/        // 单线程解码（兜底）
  commonThread/        // 公共 wasm / data
  icon/                // 播放器皮肤图标

// 打包后：dist/wsplayer/WSPlayer/... 文件名保持不变
// 不要放进 src/assets：会被 Vite 重命名成 hash，wasm 的运行时相对路径会失效
// 也不要在 index.html 全局引入，首屏白白多下 26MB`,
  },
  {
    title: '按需加载：进页面才注入脚本',
    desc: 'src/utils/video/wsplayer.ts 里用幂等 Promise，只加载一次，再次进入页面零等待',
    code: `import { assetUrl } from '@/utils/publicUrl'
import { loadCss, loadScript } from '@/utils/loadScript'

// 注入 script/link 用「带前导斜杠」的绝对路径，否则 /web-gis/ 子路径下会变成 /web-gis/web-gis/...
export const WS_PLAYER_BASE = assetUrl('wsplayer')            // /web-gis/wsplayer
// 传给播放器的 prefixUrl 要去掉前导斜杠：它内部会自己拼 '/'，否则变成 //wsplayer
export const WS_PLAYER_PREFIX = WS_PLAYER_BASE.replace(/^\\/+/, '')

let libPromise = null
export function loadWSPlayerLib() {
  if (typeof window.WSPlayer === 'function') return Promise.resolve(window.WSPlayer)
  if (libPromise) return libPromise
  libPromise = (async () => {
    await loadCss(WS_PLAYER_BASE + '/WSPlayer/player.css')
    await loadScript(WS_PLAYER_BASE + '/WSPlayer/PlaySDKInterface.js')
    await loadScript(WS_PLAYER_BASE + '/WSPlayer/WSPlayer.js')
    const mod = window.WSPlayer
    window.WSPlayer = mod.WSPlayer || mod.default || mod // 统一成构造函数
    return window.WSPlayer
  })()
  return libPromise
}`,
  },
  {
    title: '初始化播放器',
    desc: 'prefixUrl 指向「包含 WSPlayer 目录的那一级」，容器给 id 并保证有确定高度',
    code: `const player = new WSPlayer({
  el: 'ws-player-stage',            // 容器元素 id，分屏 DOM 挂到这里
  type: 'real',                     // real 实时预览 / record 录像回放
  theme: 'default',
  prefixUrl: WS_PLAYER_PREFIX,      // 解码库资源前缀，不要写到 /WSPlayer 层
  protocol: location.protocol === 'https:' ? 'wss' : 'ws',
  rtspResponseTimeout: 15,          // 拉流超时（秒），网络差可调大
  playerAdapter: 'selfAdaption',    // selfAdaption 原始比例 / stretching 铺满
  config: {
    num: 1,                         // 初始路数，支持 1 4 9 16 25
    maxNum: 4,
    showControl: true,              // 底部工具栏
    onlyLoadSingleLib: false,       // true 只加载单线程库
    localeLang: 'zhCN',
  },
  // 事件总线：初始化完成 / 播放成功失败 / 分屏变化 / 关闭视频 ...
  receiveMessageFromWSPlayer: (method, data, err) => {
    // 必须等 initializationCompleted 之后才能调用播放
    if (method === 'initializationCompleted') console.log('可以播放了')
    if (method === 'realError') console.warn('拉流失败', err)
  },
  // 传方法本身，写成 API.getRealmonitor() 会直接报错
  getRealRtsp: API.getRealmonitor,
  getTalkRtsp: API.getTalkRtsp,
  stopTalk: API.stopTalk,
})`,
  },
  {
    title: '拉流播放：realByUrl',
    desc: '适合前端自己拿 rtsp / ws 地址的场景；也支持播放器内部回调接口地址',
    code: `player.realByUrl({
  rtspURL,                    // 接口返回的 rtsp，token 已拼接，30 秒内有效
  wsURL,                      // 与 rtsp 同一台流媒体：ws://ip:9100 或 wss://ip:9102
  channelId: '1000006$0',     // 通道编码
  streamType: 1,              // 1 主码流 2 辅码流1 3 辅码流2
  selectIndex: 0,             // 窗口号，从 0 开始
  playerAdapter: 'stretching',
  channelData: { name: '大门' }, // 云台 / 抓图等需要通道信息
})`,
  },
  {
    title: '分屏 / 关闭 / 销毁',
    desc: '离开页面务必 destroy，否则 worker 与 webgl 上下文会累积',
    code: `player.setPlayerNum(4)                 // 1 2 3 4 6 8 9 16 25
player.setPlayerAdapter('stretching')  // 原始比例 <-> 铺满
player.setSelectIndex(2)               // 选中窗口 3
player.close(0)                        // 关窗口 0，不传则全部关闭

onBeforeUnmount(() => player.destroy()) // 释放 wasm / worker / canvas`,
  },
  {
    title: '生产接入：换成自己的后端',
    desc: '播放器只要接口返回 { url, token }，用项目里的 axios 实例转发即可',
    code: `// src/api/video.ts
import http from './http'

// 对应大华 /evo-apigw/admin/API/MTS/Video/StartVideo
export const getRealmonitor = (params) =>
  http.post('/video/realmonitor', params).then((res) => res.data)

// 只传函数引用，不要提前调用
new WSPlayer({ getRealRtsp: getRealmonitor, ... })`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '协议与端口必须对应',
    body: 'http 页面用 `ws`：实时预览 9100、录像回放 9320；https 页面必须用 `wss`：9102 / 9322。https 页面连 ws 会被浏览器按混合内容拦掉，控制台直接报连接失败。',
  },
  {
    title: 'https 页面要配 IP 证书',
    body: 'wss 走 SSL，需要给流媒体服务器配置证书。临时排查可先浏览器访问 `https://ip:9102`，点「高级 → 继续前往」信任一次再重试；长期方案还是正式证书，否则每台机器都要手动信任。',
  },
  {
    title: '本地起 https',
    body: '`npm run dev:https` 用自签证书起 https（`.env.https` 里 `VITE_HTTPS=1`），首次访问点「高级 → 继续前往」。页面变 https 后默认地址会自动切成 `wss://ip:9102`，此时流媒体也必须提供 wss，否则被浏览器按混合内容拦掉。',
  },
  {
    title: '协议跟着地址走',
    body: '页面协议只决定默认地址：http 页面里手动填 `wss://...` 也能用，点播放时会检测到协议变化并重建播放器实例（解码库已缓存，重建很快），播放请求自动排在初始化完成后。',
  },
  {
    title: 'token 30 秒过期',
    body: '拉流接口返回 `{ url, token }` 两个字段，rtsp 要自己拼上 `?token=xxx`。拿到地址后 30 秒内必须开始播放，Postman / demo 调试最容易超时。报 401 / 403 / 503 或错误码 224，基本都是 token 过期或没拼。',
  },
  {
    title: 'ws 地址必须与 rtsp 指向同一台流媒体',
    body: '分布式或做了端口映射时，`wsURL` 的 ip:port 要和接口返回 rtsp 里的那台服务器一致，只改其中一个必然黑屏。错误码 404 / 227（未查询到设备码流）先查这一条，再查设备是否在线。',
  },
  {
    title: 'prefixUrl 指错会报 Unexpected token "<"',
    body: '本质是解码库地址 404 被前端路由兜底返回了 index.html。`prefixUrl` 要指向「包含 WSPlayer 目录的那一级」；另外播放器内部会自己拼一个 `/`，所以前缀不能以斜杠开头，否则变成 `//wsplayer` 被当成协议相对地址，请求直接打到名为 wsplayer 的主机上。本项目用 `assetUrl(\'wsplayer\')` 去掉前导斜杠得到 `web-gis/wsplayer`，播放器再拼成 `/web-gis/wsplayer`。',
  },
  {
    title: '服务器要认 .wasm 与 .data',
    body: '控制台报 `Incorrect response MIME type. Expected \'application/wasm\'` 是静态服务没配 MIME 类型。解码依赖 wasm / data 文件，nginx 需补 `application/wasm`，并确认没被 gzip 或缓存策略弄坏。',
  },
  {
    title: '多线程硬解的两个前提',
    body: '多线程依赖 SharedArrayBuffer，服务器必须返回 `Cross-Origin-Opener-Policy: same-origin` 与 `Cross-Origin-Embedder-Policy: require-corp`，否则浏览器禁用多线程，自动退回单线程软解，性能差一大截。另外 Chrome 91+ 才支持多线程，H.265 硬解需 Chrome 104+。',
  },
  {
    title: '硬解并非处处可用',
    body: 'iOS 不支持硬解；Edge 不支持 H.265 硬解（需另装 HEVC 插件）；部分国产化终端也不支持 H.265 硬解；智能码流 / 压缩码流建议走软解。播放窗口顶部会标出当前是硬解还是软解。',
  },
  {
    title: '单页最多 16 个 WebGL',
    body: '浏览器限制一个页面最多 16 个 WebGL 上下文，软解用 canvas + WebGL 同样占额度。第 17 路会把第一路顶掉导致黑屏，而且中间关闭过的也算计数。单页建议 ≤16 路，弹窗、多标签页要一起算。',
  },
  {
    title: '8 秒不推流会自动关闭',
    body: '窗口提示「请求超时或码流不支持」，说明设备没在推流：辅码流未开启、设备离线、或网络太慢。可把 `rtspResponseTimeout` 调大（单位秒）；错误码 405 / 407 同理。',
  },
  {
    title: '对讲只支持 G711',
    body: '仅支持 `audioType` 2（G711A）与 4（G711U），采样率固定 8000、位深 16。如果接口返回不是 2，要停止后换 4 再试，仍不是就无法对讲。此外麦克风需要 https 环境才能授权。',
  },
  {
    title: '排障顺序',
    body: '先 `localStorage.playSDKLogLevel = 6` 打开详细日志，F12 Network → WS 看信令与首帧时间；再 `ping ip` 测网络、`telnet ip 端口` 测端口；最后核对地址里的 ip、端口、通道编码是否写错。',
  },
  {
    title: '打包与部署',
    body: '26MB 解码库放 public 原样拷贝，不进 bundle、不加 hash：nginx 可给 `/wsplayer/` 单独开长缓存；首页不要全局引入脚本；路由已做懒加载，本页只在进入时才拉解码库。另外静态托管（GitHub Pages）无法自定义响应头，线上会自动回退单线程解码，需要多线程硬解时要把 dist 部署到能配置 COOP/COEP 的服务器。',
  },
]
