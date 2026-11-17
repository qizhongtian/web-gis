/**
 * 知识库静态数据：首页「最近新增」、更新动态时间线、全局搜索共用。
 *
 * - knowledgeMeta 按路由 path 给示例页补充摘要 / 关键词 / 场景 / 新增时间；
 *   未登记的页面同样可被搜索（标题、分类、分组自动进入全文索引）。
 * - searchScenes 把「我想做什么」翻译成搜索条件，即场景化导航。
 */

export interface LocaleText {
  zh: string
  en: string
}

export interface KnowledgeMeta {
  /** 与菜单 path 对应 */
  path: string
  /** 新增日期 YYYY-MM-DD */
  addedAt: string
  summary: LocaleText
  /** 同义词 / 技术名词，中英都收录，切换语言后仍能命中 */
  keywords: { zh: string[]; en: string[] }
  /** 场景标签 */
  scenario?: LocaleText
}

export interface SearchScene {
  key: string
  label: LocaleText
  desc: LocaleText
  query: LocaleText
  /** 限定分类（顶层菜单 key），留空表示全部 */
  category?: string
}

/** 更新动态类型 */
export type ChangeType = 'feat' | 'fix' | 'opt' | 'chore'

export const knowledgeMeta: KnowledgeMeta[] = [
  {
    path: '/video/wsplayer/real',
    addedAt: '2026-11-13',
    summary: {
      zh: 'WSPlayer 播放 WebSocket-FLV 实时流，支持截图与全屏，HTTPS 下自动切 wss。',
      en: 'WSPlayer plays WebSocket-FLV live streams with snapshot and fullscreen; auto-switches to wss on HTTPS.',
    },
    keywords: {
      zh: ['视频监控', '实时画面', '直播', 'WebSocket', 'FLV', '截图'],
      en: ['video monitor', 'realtime', 'live', 'websocket', 'flv', 'snapshot'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/video/wsplayer/record',
    addedAt: '2026-11-13',
    summary: {
      zh: '按时间区间回放历史录像，复用实时画面的控制条与状态处理。',
      en: 'Play back recordings by time range, reusing the realtime controls and state handling.',
    },
    keywords: {
      zh: ['历史回放', '录像', '回放', '时间轴'],
      en: ['playback', 'record', 'history', 'timeline'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/video/flv',
    addedAt: '2026-11-13',
    summary: {
      zh: 'flv.js 拉取 HTTP-FLV 直播流，内置低延迟参数与断流重连。',
      en: 'flv.js pulls HTTP-FLV live streams with low-latency tuning and reconnection.',
    },
    keywords: {
      zh: ['flv.js', 'HTTP-FLV', '直播', '拉流', '低延迟'],
      en: ['flv.js', 'http-flv', 'live', 'stream', 'low latency'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/video/hls',
    addedAt: '2026-11-13',
    summary: {
      zh: 'hls.js 播放 m3u8 切片流，Safari 下自动回退原生 HLS。',
      en: 'hls.js plays m3u8 segments with native HLS fallback on Safari.',
    },
    keywords: {
      zh: ['hls.js', 'm3u8', '切片', '直播', '点播'],
      en: ['hls.js', 'm3u8', 'segments', 'live', 'vod'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/video/easyplayer',
    addedAt: '2026-11-13',
    summary: {
      zh: 'EasyPlayer.js 播放器接入示例，覆盖 FLV / HLS 与常用控制能力。',
      en: 'EasyPlayer.js integration covering FLV / HLS and common player controls.',
    },
    keywords: {
      zh: ['EasyPlayer.js', '播放器', 'FLV', 'HLS'],
      en: ['easyplayer.js', 'player', 'flv', 'hls'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/video/zlmrtc',
    addedAt: '2026-11-13',
    summary: {
      zh: 'ZLMRTCClient.js 走 WebRTC 播放，主打超低延迟监控场景。',
      en: 'ZLMRTCClient.js plays over WebRTC for ultra-low-latency surveillance.',
    },
    keywords: {
      zh: ['ZLMRTCClient.js', 'WebRTC', '超低延迟', '监控'],
      en: ['zlmrtcclient.js', 'webrtc', 'low latency', 'surveillance'],
    },
    scenario: { zh: '视频接入', en: 'Video streaming' },
  },
  {
    path: '/cesium/cluster/points',
    addedAt: '2026-11-13',
    summary: {
      zh: '海量点位按距离聚合，气泡显示数量，缩放时自动拆分与合并。',
      en: 'Cluster massive points by distance; bubbles show counts and split or merge on zoom.',
    },
    keywords: {
      zh: ['聚合', '点位', '海量点', '性能', '气泡'],
      en: ['cluster', 'points', 'massive', 'performance', 'bubble'],
    },
    scenario: { zh: '海量点性能', en: 'Massive points' },
  },
  {
    path: '/cesium/cluster/detail',
    addedAt: '2026-11-13',
    summary: {
      zh: '点击聚合气泡列出被合并的点位，可逐条定位查看。',
      en: 'Click a cluster bubble to list merged points and locate them one by one.',
    },
    keywords: {
      zh: ['聚合点详情', '聚合', '点位列表', '弹窗'],
      en: ['cluster details', 'cluster', 'point list', 'popup'],
    },
    scenario: { zh: '海量点性能', en: 'Massive points' },
  },
  {
    path: '/cesium/faq/pointpick',
    addedAt: '2026-11-13',
    summary: {
      zh: '点击点位仅高亮单条数据，同时还原上一条的原始样式。',
      en: 'Pick a point to highlight only that one while restoring the previous style.',
    },
    keywords: {
      zh: ['点选', '高亮', '选中态', '点位', '样式还原'],
      en: ['pick', 'highlight', 'selected', 'point', 'style restore'],
    },
    scenario: { zh: '点位上图', en: 'Points on map' },
  },
  {
    path: '/cesium/faq/pointscale',
    addedAt: '2026-11-13',
    summary: {
      zh: '海量点图标按相机距离动态缩放，远看聚集近看不糊。',
      en: 'Scale point billboards by camera distance so dense points stay readable at any zoom.',
    },
    keywords: {
      zh: ['图标缩放', '按距离缩放', '海量点', '性能', '视角'],
      en: ['scale', 'distance', 'billboard', 'massive points', 'camera'],
    },
    scenario: { zh: '海量点性能', en: 'Massive points' },
  },
  {
    path: '/cesium/faq/terrainlabel',
    addedAt: '2026-11-17',
    summary: {
      zh: '图标与文字像贴纸一样铺在地表，随地形起伏，拉远自动分级隐藏且互不重叠。',
      en: 'Icons and text are painted onto ground-aligned polygons, following terrain, hiding by distance and never overlapping.',
    },
    keywords: {
      zh: ['贴地文字', '地形贴图', 'Canvas 纹理', '多边形贴地', '标注重叠', '地名标注'],
      en: ['ground label', 'terrain sticker', 'canvas texture', 'polygon clamp', 'label overlap'],
    },
    scenario: { zh: '点位上图', en: 'Points on map' },
  },
  {
    path: '/cesium/faq/label',
    addedAt: '2026-11-12',
    summary: {
      zh: '海量 label 自动避让，减少压字与重叠，兼顾可读性和性能。',
      en: 'Label decluttering for massive points reduces overlap while keeping performance.',
    },
    keywords: {
      zh: ['label', '避让', '压字', '重叠', '海量点', '优化'],
      en: ['label', 'declutter', 'overlap', 'collision', 'massive points'],
    },
    scenario: { zh: '海量点性能', en: 'Massive points' },
  },
  {
    path: '/cesium/faq/popup',
    addedAt: '2026-11-12',
    summary: {
      zh: '弹窗跟随实体移动，贴近屏幕边缘时自动翻转避让。',
      en: 'Popups follow their entity and flip automatically near viewport edges.',
    },
    keywords: {
      zh: ['弹窗', '跟随', '边缘避让', '信息框'],
      en: ['popup', 'follow', 'viewport edge', 'info box'],
    },
    scenario: { zh: '点位上图', en: 'Points on map' },
  },
  {
    path: '/cesium/faq/clamp',
    addedAt: '2026-11-12',
    summary: {
      zh: '无高程点位贴地显示，解决漂浮与穿地问题（clampToGround）。',
      en: 'Clamp points without elevation to the ground to avoid floating or sinking.',
    },
    keywords: {
      zh: ['贴地', '贴地形', '无高程', 'clampToGround', '悬空'],
      en: ['clamp to ground', 'terrain', 'no elevation', 'floating'],
    },
    scenario: { zh: '点位上图', en: 'Points on map' },
  },
  {
    path: '/cesium/faq/elevation',
    addedAt: '2026-11-12',
    summary: {
      zh: '按地形采样获取点位真实高度，批量点位也能稳定取高程。',
      en: 'Sample terrain to get real point heights, stable even for batches of points.',
    },
    keywords: {
      zh: ['高程', '取高程', '地形采样', 'sampleTerrain', '点位高度'],
      en: ['elevation', 'sample terrain', 'height', 'point altitude'],
    },
    scenario: { zh: '点位上图', en: 'Points on map' },
  },
  {
    path: '/cesium/tool/elevation',
    addedAt: '2026-11-12',
    summary: {
      zh: '上传 GeoJSON / Excel 点表批量采样地形与倾斜面高程，可取较高值并导出结果。',
      en: 'Upload GeoJSON / Excel points to batch sample terrain and tilted-surface heights, then export.',
    },
    keywords: {
      zh: ['表面高程', '高程提取', '批量采样', '倾斜模型', 'Excel', '导出'],
      en: ['surface elevation', 'batch sampling', 'tilted model', 'excel', 'export'],
    },
    scenario: { zh: '高程与坐标', en: 'Elevation & coordinate' },
  },
  {
    path: '/cesium/tool/vector',
    addedAt: '2026-11-06',
    summary: {
      zh: '上传点 / 线 / 面 GeoJSON，选文件即预览、调样式实时生效，支持图层显隐与编辑。',
      en: 'Upload point / line / polygon GeoJSON with instant preview, live styling and layer editing.',
    },
    keywords: {
      zh: ['矢量上传', 'GeoJSON', '点线面', '样式', '图层管理'],
      en: ['vector upload', 'geojson', 'point line polygon', 'style', 'layer'],
    },
    scenario: { zh: '数据上图', en: 'Data on map' },
  },
  {
    path: '/cesium/layer/terrain',
    addedAt: '2026-11-13',
    summary: {
      zh: '地形服务默认改用全球高程（免密钥），并可叠加倾斜模型与本地地形。',
      en: 'Terrain defaults to a keyless global elevation service, with tilted models and local terrain support.',
    },
    keywords: {
      zh: ['地形', '高程服务', 'DEM', '跨域', '倾斜模型'],
      en: ['terrain', 'elevation service', 'dem', 'cors', 'tilted model'],
    },
    scenario: { zh: '高程与坐标', en: 'Elevation & coordinate' },
  },
  {
    path: '/cesium/tool/measure',
    addedAt: '2026-11-07',
    summary: {
      zh: '空间距离、面积与高度量算，绘制过程实时显示结果。',
      en: 'Measure distance, area and height with live results while drawing.',
    },
    keywords: {
      zh: ['量算', '距离', '面积', '高度', '测量'],
      en: ['measure', 'distance', 'area', 'height'],
    },
    scenario: { zh: '量算与分析', en: 'Measure & analysis' },
  },
  {
    path: '/cesium/tool/weather',
    addedAt: '2026-11-07',
    summary: {
      zh: '雨、雪、雾等天气后处理特效，可调节强度与范围。',
      en: 'Rain, snow and fog post-processing effects with adjustable intensity.',
    },
    keywords: {
      zh: ['天气', '雨', '雪', '雾', '特效', '后处理'],
      en: ['weather', 'rain', 'snow', 'fog', 'effect', 'post process'],
    },
    scenario: { zh: '三维特效', en: '3D effects' },
  },
  {
    path: '/cesium/compose/trackplayback',
    addedAt: '2026-11-13',
    summary: {
      zh: '轨迹回放：按时间推进模型位置与朝向，支持倍速与暂停。',
      en: 'Track playback advances model position and heading over time, with speed and pause.',
    },
    keywords: {
      zh: ['轨迹回放', '动画', '模型', '倍速', '时间'],
      en: ['track playback', 'animation', 'model', 'speed', 'time'],
    },
    scenario: { zh: '三维特效', en: '3D effects' },
  },
  {
    path: '/cesium/coord/transform',
    addedAt: '2026-11-07',
    summary: {
      zh: '经纬度与笛卡尔坐标互转，支持批量与精度对比。',
      en: 'Convert between longitude/latitude and Cartesian coordinates, batch and precision aware.',
    },
    keywords: {
      zh: ['坐标转换', '经纬度', '笛卡尔', 'WGS84', 'Cartesian'],
      en: ['coordinate transform', 'lng lat', 'cartesian', 'wgs84'],
    },
    scenario: { zh: '高程与坐标', en: 'Elevation & coordinate' },
  },
  {
    path: '/openlayer/tool/measure',
    addedAt: '2026-11-06',
    summary: {
      zh: 'OpenLayers 距离量算，支持继续绘制、撤销与清除。',
      en: 'OpenLayers distance measurement with continue, undo and clear.',
    },
    keywords: {
      zh: ['OpenLayers', '距离量算', '测量', '撤销'],
      en: ['openlayers', 'measure', 'distance', 'undo'],
    },
    scenario: { zh: '量算与分析', en: 'Measure & analysis' },
  },
  {
    path: '/leaflet/tool/draw',
    addedAt: '2026-11-06',
    summary: {
      zh: 'Leaflet 绘制与量算，点 / 线 / 面绘制后即时给出长度与面积。',
      en: 'Leaflet draw and measure: get length and area right after drawing points, lines or polygons.',
    },
    keywords: {
      zh: ['Leaflet', '绘制', '量算', '面积', '长度'],
      en: ['leaflet', 'draw', 'measure', 'area', 'length'],
    },
    scenario: { zh: '量算与分析', en: 'Measure & analysis' },
  },
  {
    path: '/three/basic/cube',
    addedAt: '2026-11-06',
    summary: {
      zh: 'Three.js 旋转立方体入门，含场景、相机、光照与渲染循环。',
      en: 'Three.js rotating cube basics with scene, camera, lights and render loop.',
    },
    keywords: {
      zh: ['Three.js', '立方体', '场景', '相机', '光照'],
      en: ['three.js', 'cube', 'scene', 'camera', 'light'],
    },
    scenario: { zh: '三维特效', en: '3D effects' },
  },
]

export const searchScenes: SearchScene[] = [
  {
    key: 'points',
    label: { zh: '点位上图', en: 'Points on map' },
    desc: { zh: '贴地、高程、弹窗与高亮', en: 'Clamp, elevation, popup, highlight' },
    query: { zh: '点位', en: 'point' },
    category: 'menus.cesium',
  },
  {
    key: 'measure',
    label: { zh: '量算与分析', en: 'Measure & analysis' },
    desc: { zh: '距离、面积、空间分析', en: 'Distance, area, spatial analysis' },
    query: { zh: '量算', en: 'measure' },
  },
  {
    key: 'massive',
    label: { zh: '海量点性能', en: 'Massive points' },
    desc: { zh: '聚合、避让、缩放优化', en: 'Cluster, declutter, scaling' },
    query: { zh: '海量', en: 'massive' },
    category: 'menus.cesium',
  },
  {
    key: 'video',
    label: { zh: '视频接入', en: 'Video streaming' },
    desc: { zh: 'FLV / HLS / WebRTC 播放', en: 'FLV / HLS / WebRTC playback' },
    query: { zh: '视频', en: 'video' },
    category: 'menus.video',
  },
  {
    key: 'coord',
    label: { zh: '高程与坐标', en: 'Elevation & coordinate' },
    desc: { zh: '高程采样、坐标转换', en: 'Sampling, coordinate transform' },
    query: { zh: '坐标', en: 'coordinate' },
  },
  {
    key: 'data',
    label: { zh: '数据上图', en: 'Data on map' },
    desc: { zh: 'GeoJSON 上传与图层管理', en: 'GeoJSON upload and layers' },
    query: { zh: '上传', en: 'upload' },
  },
]
