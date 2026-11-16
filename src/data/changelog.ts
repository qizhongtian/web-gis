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
    path: '/cesium/layer/terrain',
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
