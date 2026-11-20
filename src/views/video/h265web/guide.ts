import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../guide-types'

/** h265web.js 页面说明：最小链路 → 回调 → 释放 → 服务端配套 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '三步接入：容器 + 主脚本 + wasm 目录',
    desc: 'SDK 需要一个带 id 的容器节点，wasm 资源由 base_url 定位，二者缺一不可',
    code: `<!-- 1. 容器：SDK 会往里塞 canvas，用绝对定位铺满 -->
<div id="h265web-host" style="position:absolute;inset:0"></div>

<!-- 2. 主脚本 + wasm 资源同源部署在 public/h265web/ -->
<script src="/h265web/h265web.js"></script>

// 3. 声明资源根目录（末尾斜杠），单页部署在子路径时用 import.meta.env.BASE_URL 拼
//    public/h265web/ 里需要三个文件：h265web.js、h265web_wasm.js、h265web_wasm.wasm
const baseUrl = import.meta.env.BASE_URL + 'h265web/'`,
  },
  {
    title: 'build → load_media → play',
    desc: 'v2 API：工厂函数拿到实例，build 建 canvas，load_media 只是挂流，play 才真正解码',
    code: `const player = window.H265webjsPlayer()

player.build({
  player_id: 'h265web-host',   // 容器的 DOM id，不是元素对象
  base_url: baseUrl,           // wasm 资源目录
  // SDK 没有默认 wasm 文件名，这两项必须显式给，否则起播时 404
  wasm_js_uri: baseUrl + 'h265web_wasm.js',
  wasm_wasm_uri: baseUrl + 'h265web_wasm.wasm',
  width: host.clientWidth,
  height: host.clientHeight,
  auto_play: false,            // 交给页面控制，避免无声起播
  ignore_audio: false,
})

player.load_media('https://host/live/stream.flv')
player.play()`,
  },
  {
    title: '回调全是属性赋值，不是 addEventListener',
    desc: 'on_ready_show_done_callback 表示首帧已渲染，只有它触发后截图/取尺寸才有效',
    code: `player.on_ready_show_done_callback = () => {
  status.value = 'ready'         // 首帧渲染完成，此时宽高才是真实的
}

player.on_play_time = (seconds) => {
  current.value = seconds        // 每秒回调一次，单位秒
}

player.onPlayStart = () => (playing.value = true)
player.onPlayPause = () => (playing.value = false)
player.onPlayFinish = () => (playing.value = false)

player.on_error_callback = (err) => {
  // 常见原因：不是 H.265、flv 头缺 enhanced-rtmp、wasm 资源 404
  fail(String(err))
}`,
  },
  {
    title: '暂停 / 音量 / 换流 / 释放',
    desc: '换流不要重新 new，先释放旧实例；release 是回调式的，包一层 Promise 好收尾',
    code: `player.pause()                 // 直播流 resume 用 play()
player.set_voice(0.5)          // 注意：部分版本按 0~100 传值

// 换流：先释放，再重建，避免 canvas 与 worker 叠加
await releasePlayer(player)
host.innerHTML = ''
player = null

// 页面卸载同样要释放，否则 wasm 线程会一直跑
await releasePlayer(player)`,
  },
  {
    title: '服务端必须真的吐出 H.265',
    desc: 'FLV 里装 HEVC 依赖 enhanced-RTMP，普通 RTMP 推 H.265 会被服务端直接丢掉',
    code: `# SRS 5.0+ / MediaMTX 支持 enhanced-RTMP（HEVC over FLV）
ffmpeg -re -i input.mp4 \\
  -c:v libx265 -x265-params keyint=30:min-keyint=30:scenecut=0 \\
  -b:v 1200k -c:a aac -f flv rtmp://127.0.0.1:1935/live/h265

# 校验流的编码，确认是 hevc 而不是 h264
ffprobe -v error -show_entries stream=codec_name -of csv=p=0 http://host/live/h265.flv`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '这种方案只解决「播不了 H.265」',
    body: 'h265web.js 是 wasm 软解，浏览器有硬解能力时（H.264、部分平台的 HEVC）它就是纯浪费 CPU。只有确认源是 H.265、且换不了编码时才用它；桌面端 1080p 单路一般占 1~2 个核，4K 或多路要提前评估。',
  },
  {
    title: 'npm 上的 h265web.js 包不含产物',
    body: '`npm i h265web.js` 装到的只有 README、demo 截图和 `dist/index.js` 占位，没有 `static/` 下的 `h265web.js` 与 wasm。产物要从 GitHub 仓库的 `static/` 目录取（本项目已放到 `public/h265web/`）。另外 `wasm_js_uri` / `wasm_wasm_uri` SDK 不设默认值，`base_url` 只用来解析这两个地址，所以 build 时必须显式传。',
  },
  {
    title: 'wasm 资源必须同源或带 CORS',
    body: '真正的解码器是 `h265web_wasm.js` / `.wasm`，主脚本只是壳。走 CDN 时要求对方返回 `Access-Control-Allow-Origin`，否则报 wasm 实例化失败；同源部署（本项目默认）没有这个问题，注意服务器给 `.wasm` 返回 `application/wasm` 即可。',
  },
  {
    title: '多线程 wasm 需要 COOP/COEP',
    body: '部分版本会尝试 `SharedArrayBuffer` 走多线程解码，这要求页面响应头带 `Cross-Origin-Opener-Policy: same-origin` 与 `Cross-Origin-Embedder-Policy: require-corp`。没有这两个头会退化成单线程，帧率明显下降——如果换不了响应头，就按单线程的预期压码率/分辨率。',
  },
  {
    title: '容器 id 必须稳定且唯一',
    body: '`build()` 收的是 `player_id` 字符串，SDK 内部 `getElementById`。同一页面重复 build 会往同一个节点里塞多个 canvas，表现为「画面叠影 + 音频双轨」。换流前一定 `release()` + 清空 `innerHTML`，或者给每次实例化生成唯一 id。',
  },
  {
    title: '宽高在 build 时就固定了',
    body: '`width` / `height` 决定 canvas 的实际像素尺寸，跟 CSS 无关。容器尺寸变化（全屏、侧栏收起）后画面会被拉伸或裁切，稳妥做法是监听 `ResizeObserver` 重建实例，或者在 build 时按最大尺寸创建、用 CSS 适配。',
  },
  {
    title: '自动播放一定没声音',
    body: '`auto_play: true` 起播可以，但浏览器策略要求音频必须由用户手势激活，所以首帧必然是静音。页面里要在点击事件里调 `set_voice(0.6)` 之类的操作，才能在控制台之外真正出声。',
  },
  {
    title: '回调是属性覆盖，不是监听列表',
    body: '`onPlayStart`、`on_play_time`、`on_error_callback` 都是直接赋值，重复赋值会覆盖上一个，不是 `addEventListener`。所以页面卸载时没有「解绑」这一步，靠 `release()` 让所有回调失效即可。',
  },
  {
    title: '和 Jessibuca 的分工',
    body: 'Jessibuca 开源版只吃 FLV/裸流（ws-flv、http-flv），h265web.js 还能播 HLS 与 MP4。做监控大屏用 Jessibuca 更省心；要在浏览器里直接播 H.265 的 mp4 回放，才轮到 h265web.js。',
  },
]
