import type { ChangeType, LocaleText } from './knowledge'

export interface ChangelogItem {
  id: string
  date: string
  type: ChangeType
  title: LocaleText
  desc?: LocaleText
  /** 可点击跳转的示例页 */
  path?: string
}

/** 首页时间线展示的更新动态（按时间倒序） */
export const changelog: ChangelogItem[] = [
  {
    id: '2026-11-20-video-webrtc',
    date: '2026-11-20',
    type: 'feat',
    title: { zh: '新增原生 WebRTC 拉流示例', en: 'Added native WebRTC playback demo' },
    desc: {
      zh: '不依赖播放器库，直接用 RTCPeerConnection + fetch 完成 SDP 交换，支持 WHEP、ZLMediaKit 与自定义 POST 接口，并展示 ICE 状态与 getStats 指标。',
      en: 'Plays WebRTC without any player library: RTCPeerConnection plus fetch handles the SDP exchange for WHEP, ZLMediaKit and custom POST endpoints, with ICE state and getStats metrics.',
    },
    path: '/video/webrtc',
  },
  {
    id: '2026-11-20-video-jessibuca-h265web',
    date: '2026-11-20',
    type: 'feat',
    title: { zh: '新增 Jessibuca 与 h265web.js 两个播放示例', en: 'Added Jessibuca and h265web.js demos' },
    desc: {
      zh: '两个 wasm 软解播放器示例：Jessibuca 覆盖 FLV/裸流与 H.264/H.265 解码策略，h265web.js 覆盖 H.265 的 FLV/HLS/MP4，均带事件日志与排错说明。',
      en: 'Two wasm-decoding players: Jessibuca for FLV/raw streams with H.264/H.265 strategy, h265web.js for H.265 over FLV/HLS/MP4, both with event logs and troubleshooting notes.',
    },
    path: '/video/jessibuca',
  },
  {
    id: '2026-11-20-cluster-guide',
    date: '2026-11-20',
    type: 'opt',
    title: { zh: '聚合示例新增关键代码与注意事项面板', en: 'Added code & notes panel to cluster demos' },
    desc: {
      zh: '点位聚合与聚合点详情页右侧接入可折叠说明面板，整理 EntityCluster 事件、token 反查成员、弹窗逐帧投屏等要点。',
      en: 'Cluster demos now ship a collapsible right panel covering EntityCluster events, token-based member lookup and per-frame popup projection.',
    },
    path: '/cesium/cluster/detail',
  },
  {
    id: '2026-11-19-cesium-1.140',
    date: '2026-11-19',
    type: 'feat',
    title: {
      zh: 'Cesium 升级至 1.140，支持高斯泼溅',
      en: 'Upgraded Cesium to 1.140 with Gaussian splatting',
    },
    desc: {
      zh: '依赖升级到 CesiumJS 1.140.0，原生支持 KHR_gaussian_splatting / SPZ2 高斯泼溅瓦片；同时适配 1.116 起的 Scene.verticalExaggeration 与 1.121 起的 worldToWindowCoordinates。',
      en: 'Upgraded to CesiumJS 1.140.0 with native Gaussian splatting (KHR_gaussian_splatting / SPZ2); migrated to Scene.verticalExaggeration and worldToWindowCoordinates.',
    },
    path: '/cesium/basic/gaussian',
  },
  {
    id: '2026-11-19-data-inspect',
    date: '2026-11-19',
    type: 'feat',
    title: { zh: '新增数据探查页', en: 'Added data inspector' },
    desc: {
      zh: '上传点线面 GeoJSON、tileset.json、glTF / GLB，查看结构属性、Cesium 运行时对象与用法代码。',
      en: 'Inspect point / line / polygon GeoJSON, tileset.json and glTF / GLB with structure, properties, Cesium runtime objects and usage code.',
    },
    path: '/cesium/tool/inspect',
  },
  {
    id: '2026-11-17-coord-transform',
    date: '2026-11-17',
    type: 'fix',
    title: { zh: '重构坐标转换页', en: 'Rebuilt coordinate transform page' },
    desc: {
      zh: '支持手动输入经纬度 / ECEF、双向转换、地图点选与定位到点，数值一键复制。',
      en: 'Manual lon / lat and ECEF input, two-way conversion, map picking, fly-to-point and one-click copy.',
    },
    path: '/cesium/coord/transform',
  },
  {
    id: '2026-11-17-debug',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '新增调试检测工具组', en: 'Added DevTools group' },
    desc: {
      zh: '设备信息、能力探测、存储管理与性能面板四个页面。',
      en: 'Device info, capability detection, storage manager and performance panel.',
    },
    path: '/tools/debug/perf',
  },
  {
    id: '2026-11-17-cheatsheet',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '新增前端速查模块', en: 'Added frontend cheatsheets' },
    desc: {
      zh: 'CSS / JS / HTTP / Git / Vue3 速查，支持关键词搜索与一键复制。',
      en: 'CSS / JS / HTTP / Git / Vue3 sheets with search and one-click copy.',
    },
    path: '/tools/cheatsheet/css',
  },
  {
    id: '2026-11-17-data',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '新增数据转换工具组', en: 'Added data conversion group' },
    desc: {
      zh: 'CSV ↔ JSON、JSON → TS 与 SQL 格式化（词法切分，保留字符串与注释）。',
      en: 'CSV ↔ JSON, JSON → TS and SQL formatter with tokenizer-based parsing.',
    },
    path: '/tools/data/sql',
  },
  {
    id: '2026-11-17-text',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '新增文本处理工具组', en: 'Added text tools group' },
    desc: {
      zh: '文本统计、命名风格、行处理与假数据生成。',
      en: 'Text stats, case convert, line tools and mock data generator.',
    },
    path: '/tools/text/mock',
  },
  {
    id: '2026-11-17-codec',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '编码转换补充 JWT / 哈希 / 进制', en: 'Added JWT, hash and radix converters' },
    desc: {
      zh: 'JWT 声明校验、MD5 与 SHA 系列哈希、BigInt 进制互转。',
      en: 'JWT claim checks, MD5 / SHA hashes and BigInt radix conversion.',
    },
    path: '/tools/codec/jwt',
  },
  {
    id: '2026-11-17-design',
    date: '2026-11-17',
    type: 'feat',
    title: { zh: '设计辅助补充圆角 / 单位 / 对比度', en: 'Added radius, units and contrast tools' },
    desc: {
      zh: '可视化圆角、多单位换算与 WCAG 对比度检测。',
      en: 'Visual border radius, unit conversion and WCAG contrast checker.',
    },
    path: '/tools/design/contrast',
  },
  {
    id: '2026-11-13-zlmrtc',
    date: '2026-11-13',
    type: 'feat',
    title: { zh: '新增 ZLMRTCClient.js WebRTC 播放示例', en: 'Added ZLMRTCClient.js WebRTC demo' },
    desc: { zh: '覆盖超低延迟监控场景，补齐视频接入矩阵。', en: 'Covers ultra-low-latency surveillance and completes the video matrix.' },
    path: '/video/zlmrtc',
  },
  {
    id: '2026-11-13-easyplayer',
    date: '2026-11-13',
    type: 'feat',
    title: { zh: '新增 EasyPlayer.js 播放示例', en: 'Added EasyPlayer.js demo' },
    path: '/video/easyplayer',
  },
  {
    id: '2026-11-13-flv-hls',
    date: '2026-11-13',
    type: 'feat',
    title: { zh: '新增 Flv.js 与 Hls.js 播放示例', en: 'Added Flv.js and Hls.js demos' },
    path: '/video/flv',
  },
  {
    id: '2026-11-13-wsplayer',
    date: '2026-11-13',
    type: 'feat',
    title: { zh: '新增 WSPlayer 视频监控模块', en: 'Added WSPlayer video module' },
    desc: { zh: '实时画面 + 历史回放两个页面。', en: 'Realtime and playback pages.' },
    path: '/video/wsplayer/real',
  },
  {
    id: '2026-11-13-wsplayer-fix',
    date: '2026-11-13',
    type: 'fix',
    title: { zh: '修复子路径部署下 WSPlayer 解码库 404', en: 'Fixed WSPlayer decoder 404 on sub-path deploy' },
  },
  {
    id: '2026-11-13-terrain',
    date: '2026-11-13',
    type: 'opt',
    title: { zh: '地形默认改用全球高程服务', en: 'Terrain now defaults to global elevation service' },
    desc: { zh: '统一 provider 创建入口，并新增 Worker 地形反代解决生产跨域。', en: 'Unified provider entry and added a Worker terrain proxy for CORS.' },
    path: '/cesium/basic/terrain',
  },
  {
    id: '2026-11-13-cluster',
    date: '2026-11-13',
    type: 'feat',
    title: { zh: '新增聚合点详情页', en: 'Added cluster detail page' },
    desc: { zh: '点击聚合气泡列出被合并点位，同时重构聚合示例。', en: 'Click a cluster bubble to list merged points; refactored clustering.' },
    path: '/cesium/cluster/detail',
  },
  {
    id: '2026-11-13-deploy',
    date: '2026-11-13',
    type: 'chore',
    title: { zh: '支持子路径部署与 GitHub Pages 自动发布', en: 'Sub-path deploy and GitHub Pages CI' },
    desc: { zh: '纯静态环境下也有 Mock 数据可用。', en: 'Mock data also works in a purely static environment.' },
  },
  {
    id: '2026-11-12-faq',
    date: '2026-11-12',
    type: 'feat',
    title: { zh: '新增 FAQ 弹窗、标签避让与贴地示例', en: 'Added FAQ popup, label declutter and clamp demos' },
    desc: { zh: '抽取 CodePanel 代码预览组件，FAQ 页改用双页签说明面板。', en: 'Extracted CodePanel and moved FAQ pages to a two-tab guide panel.' },
    path: '/cesium/faq/popup',
  },
  {
    id: '2026-11-12-elevation',
    date: '2026-11-12',
    type: 'feat',
    title: { zh: '新增表面高程提取工具页', en: 'Added surface elevation tool' },
    desc: { zh: '支持 GeoJSON / Excel 点表批量采样与结果导出。', en: 'Batch sample and export for GeoJSON / Excel point tables.' },
    path: '/cesium/tool/elevation',
  },
  {
    id: '2026-11-07-refactor',
    date: '2026-11-07',
    type: 'opt',
    title: { zh: '抽离 Cesium 配置与后处理通道', en: 'Extracted Cesium config and post-process stages' },
    desc: { zh: '重构测量与天气工具，状态栏新增鼠标拾取信息。', en: 'Refactored measure and weather tools; status bar shows picked info.' },
  },
  {
    id: '2026-11-06-vector',
    date: '2026-11-06',
    type: 'feat',
    title: { zh: '矢量上传支持即时预览与图层编辑', en: 'Vector upload with instant preview and layer editing' },
    desc: { zh: '选文件即定位预览，参数改动实时生效。', en: 'Pick a file to fly and preview; style changes apply live.' },
    path: '/cesium/tool/vector',
  },
  {
    id: '2026-11-06-init',
    date: '2026-11-06',
    type: 'chore',
    title: { zh: '初始化 WebGIS 示例管理平台', en: 'Initialized WebGIS demo platform' },
    desc: { zh: 'Vue3 + TS + Pinia + Element Plus + UnoCSS。', en: 'Vue3 + TS + Pinia + Element Plus + UnoCSS.' },
  },
]
