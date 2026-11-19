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
    path: '/cesium/tool/inspect',
    addedAt: '2026-11-19',
    summary: {
      zh: '上传点 / 线 / 面 GeoJSON、tileset.json 与 glTF / GLB，解析结构属性并上图，展示 Cesium 可读取的数据与用法代码。',
      en: 'Upload point / line / polygon GeoJSON, tileset.json and glTF / GLB, inspect structure and properties, load onto the map, and read Cesium runtime objects with code recipes.',
    },
    keywords: {
      zh: ['数据探查', 'GeoJSON', '3D Tiles', 'tileset', 'glTF', 'GLB', '属性', '拾取'],
      en: ['data inspector', 'geojson', '3d tiles', 'tileset', 'gltf', 'glb', 'properties', 'picking'],
    },
    scenario: { zh: '数据接入', en: 'Data onboarding' },
  },
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
    path: '/cesium/basic/terrain',
    addedAt: '2026-11-13',
    summary: {
      zh: '地形服务默认使用全球高程（免密钥），可切换自建 quantized-mesh、垂直夸张与按需采样高程。',
      en: 'Terrain uses a keyless global elevation service by default, with quantized-mesh, vertical exaggeration and on-demand sampling.',
    },
    keywords: {
      zh: ['地形', '高程服务', 'DEM', '跨域', 'quantized-mesh'],
      en: ['terrain', 'elevation service', 'dem', 'cors', 'quantized-mesh'],
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
      zh: 'WGS84 经纬度与 ECEF 地心坐标双向转换：手动输入、地图点选、定位到点，结果可复制。',
      en: 'Two-way WGS84 ↔ ECEF conversion with manual input, map picking, fly-to-point and copyable results.',
    },
    keywords: {
      zh: ['坐标转换', '经纬度', '笛卡尔', 'WGS84', 'ECEF', '定位', '复制'],
      en: ['coordinate transform', 'lng lat', 'cartesian', 'wgs84', 'ecef', 'fly to', 'copy'],
    },
    scenario: { zh: '高程与坐标', en: 'Elevation & coordinate' },
  },
  {
    path: '/openlayer/analysis/distance',
    addedAt: '2026-11-06',
    summary: {
      zh: 'OpenLayers 距离分析，ol/sphere 按椭球面计算线长度，支持撤销与清除。',
      en: 'OpenLayers distance analysis with ellipsoidal length, undo and clear.',
    },
    keywords: {
      zh: ['OpenLayers', '距离', '量算', '测量', '撤销'],
      en: ['openlayers', 'distance', 'measure', 'length', 'undo'],
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
  {
    path: '/tools/codec/jwt',
    addedAt: '2026-11-17',
    summary: {
      zh: '粘贴 JWT 即解析 Header / Payload，校验 exp、iat、nbf 时间声明并提示算法风险。',
      en: 'Paste a JWT to decode header and payload, validate exp / iat / nbf claims and flag risky algorithms.',
    },
    keywords: {
      zh: ['JWT', 'Token', '解码', '鉴权', '过期时间', 'HS256'],
      en: ['jwt', 'token', 'decode', 'auth', 'expiry', 'hs256'],
    },
    scenario: { zh: '编码转换', en: 'Converters' },
  },
  {
    path: '/tools/codec/hash',
    addedAt: '2026-11-17',
    summary: {
      zh: '文本与文件哈希计算，支持 MD5、SHA-1、SHA-256 等常用算法并一键对比。',
      en: 'Compute text and file hashes with MD5, SHA-1, SHA-256 and compare results side by side.',
    },
    keywords: {
      zh: ['哈希', '摘要', 'MD5', 'SHA-256', '文件校验', 'Web Crypto'],
      en: ['hash', 'digest', 'md5', 'sha-256', 'checksum', 'web crypto'],
    },
    scenario: { zh: '编码转换', en: 'Converters' },
  },
  {
    path: '/tools/codec/radix',
    addedAt: '2026-11-17',
    summary: {
      zh: '二进制、八进制、十进制、十六进制与 Base36 互转，基于 BigInt 支持大整数。',
      en: 'Convert between binary, octal, decimal, hex and Base36 with BigInt support for large values.',
    },
    keywords: {
      zh: ['进制转换', '二进制', '十六进制', 'Base36', 'BigInt'],
      en: ['radix', 'binary', 'hex', 'base36', 'bigint'],
    },
    scenario: { zh: '编码转换', en: 'Converters' },
  },
  {
    path: '/tools/design/radius',
    addedAt: '2026-11-17',
    summary: {
      zh: '可视化调节四角圆角，实时生成 border-radius CSS 并支持一键复制。',
      en: 'Adjust each corner visually and get ready-to-copy border-radius CSS in real time.',
    },
    keywords: {
      zh: ['圆角', 'border-radius', 'CSS', '可视化', '样式'],
      en: ['border radius', 'rounded', 'css', 'visual', 'style'],
    },
    scenario: { zh: '设计辅助', en: 'Design' },
  },
  {
    path: '/tools/design/unit',
    addedAt: '2026-11-17',
    summary: {
      zh: 'px / rem / pt / % / vw 多单位换算，可自定义根字号与视口宽度。',
      en: 'Convert px / rem / pt / % / vw with configurable root font size and viewport width.',
    },
    keywords: {
      zh: ['单位换算', 'px', 'rem', 'vw', '响应式', '根字号'],
      en: ['unit convert', 'px', 'rem', 'vw', 'responsive', 'root font size'],
    },
    scenario: { zh: '设计辅助', en: 'Design' },
  },
  {
    path: '/tools/design/contrast',
    addedAt: '2026-11-17',
    summary: {
      zh: '按 WCAG 计算前景 / 背景对比度，给出 AA、AAA 达标结论与改进建议色。',
      en: 'Check foreground / background contrast against WCAG with AA, AAA results and suggested fixes.',
    },
    keywords: {
      zh: ['对比度', 'WCAG', '无障碍', 'AA', 'AAA', '配色'],
      en: ['contrast', 'wcag', 'accessibility', 'aa', 'aaa', 'color'],
    },
    scenario: { zh: '设计辅助', en: 'Design' },
  },
  {
    path: '/tools/text/stats',
    addedAt: '2026-11-17',
    summary: {
      zh: '统计字符、汉字、单词、行数与段落，同时估算阅读时长与字节体积。',
      en: 'Count characters, CJK glyphs, words, lines and paragraphs, plus estimated reading time and bytes.',
    },
    keywords: {
      zh: ['文本统计', '字数', '词数', '行数', '阅读时长'],
      en: ['text stats', 'character count', 'word count', 'lines', 'reading time'],
    },
    scenario: { zh: '文本处理', en: 'Text' },
  },
  {
    path: '/tools/text/case',
    addedAt: '2026-11-17',
    summary: {
      zh: 'camelCase、PascalCase、snake_case、kebab-case、CONSTANT 等命名风格互转。',
      en: 'Convert between camelCase, PascalCase, snake_case, kebab-case and CONSTANT naming styles.',
    },
    keywords: {
      zh: ['命名风格', '驼峰', '下划线', '短横线', '大小写转换'],
      en: ['case convert', 'camel', 'snake', 'kebab', 'pascal', 'uppercase'],
    },
    scenario: { zh: '文本处理', en: 'Text' },
  },
  {
    path: '/tools/text/lines',
    addedAt: '2026-11-17',
    summary: {
      zh: '按行去重、排序、去空行、加前后缀与行号，适合批量整理清单与配置。',
      en: 'Deduplicate, sort, trim blank lines, add prefixes / suffixes or line numbers to batches of lines.',
    },
    keywords: {
      zh: ['行处理', '去重', '排序', '去空行', '批量', '行号'],
      en: ['line tools', 'dedupe', 'sort', 'blank lines', 'batch', 'line numbers'],
    },
    scenario: { zh: '文本处理', en: 'Text' },
  },
  {
    path: '/tools/text/mock',
    addedAt: '2026-11-17',
    summary: {
      zh: '按字段配置生成中文姓名、手机号、邮箱等假数据，可导出 JSON / CSV / SQL / TS。',
      en: 'Generate mock names, phones, emails by field and export as JSON, CSV, SQL or TypeScript.',
    },
    keywords: {
      zh: ['假数据', 'Mock', '测试数据', '姓名', '手机号', '导出'],
      en: ['mock data', 'fake data', 'test data', 'name', 'phone', 'export'],
    },
    scenario: { zh: '文本处理', en: 'Text' },
  },
  {
    path: '/tools/data/csv',
    addedAt: '2026-11-17',
    summary: {
      zh: 'CSV 与 JSON 双向转换，可指定分隔符与表头，自动处理引号转义。',
      en: 'Two-way CSV and JSON conversion with configurable delimiter and header, quoting handled.',
    },
    keywords: {
      zh: ['CSV', 'JSON', '表格', '分隔符', '转换', '导入导出'],
      en: ['csv', 'json', 'table', 'delimiter', 'convert', 'import export'],
    },
    scenario: { zh: '数据转换', en: 'Data' },
  },
  {
    path: '/tools/data/json-ts',
    addedAt: '2026-11-17',
    summary: {
      zh: '粘贴 JSON 自动推导 TypeScript interface，可选可选字段并兼容嵌套数组。',
      en: 'Turn JSON into TypeScript interfaces with optional fields and nested array support.',
    },
    keywords: {
      zh: ['JSON 转 TS', 'interface', '类型推导', 'TypeScript', '代码生成'],
      en: ['json to ts', 'interface', 'type inference', 'typescript', 'codegen'],
    },
    scenario: { zh: '数据转换', en: 'Data' },
  },
  {
    path: '/tools/data/sql',
    addedAt: '2026-11-17',
    summary: {
      zh: 'SQL 格式化与压缩，按词法切分保留字符串与注释，多词关键字正确缩进。',
      en: 'Format and minify SQL with tokenizer-based parsing that preserves strings, comments and multi-word keywords.',
    },
    keywords: {
      zh: ['SQL', '格式化', '压缩', '美化', '关键字', '词法分析'],
      en: ['sql', 'format', 'minify', 'beautify', 'keyword', 'tokenizer'],
    },
    scenario: { zh: '数据转换', en: 'Data' },
  },
  {
    path: '/tools/cheatsheet/css',
    addedAt: '2026-11-17',
    summary: {
      zh: '布局、弹性网格、选择器、动效等 CSS 高频写法速查，支持搜索与一键复制。',
      en: 'CSS cheatsheet for layout, flex / grid, selectors and animations with search and copy.',
    },
    keywords: {
      zh: ['CSS', '速查', 'Flex', 'Grid', '选择器', '布局'],
      en: ['css', 'cheatsheet', 'flex', 'grid', 'selector', 'layout'],
    },
    scenario: { zh: '前端速查', en: 'Cheatsheet' },
  },
  {
    path: '/tools/cheatsheet/js',
    addedAt: '2026-11-17',
    summary: {
      zh: '数组、对象、字符串、异步与类型判断的 JavaScript 常用片段速查。',
      en: 'JavaScript cheatsheet for arrays, objects, strings, async and type checks.',
    },
    keywords: {
      zh: ['JavaScript', '速查', '数组', '对象', 'Promise', '工具函数'],
      en: ['javascript', 'cheatsheet', 'array', 'object', 'promise', 'utils'],
    },
    scenario: { zh: '前端速查', en: 'Cheatsheet' },
  },
  {
    path: '/tools/cheatsheet/http',
    addedAt: '2026-11-17',
    summary: {
      zh: 'HTTP 方法、状态码、缓存头与跨域相关响应头速查表。',
      en: 'HTTP cheatsheet covering methods, status codes, cache headers and CORS headers.',
    },
    keywords: {
      zh: ['HTTP', '状态码', '缓存', 'CORS', '请求头', '速查'],
      en: ['http', 'status code', 'cache', 'cors', 'headers', 'cheatsheet'],
    },
    scenario: { zh: '前端速查', en: 'Cheatsheet' },
  },
  {
    path: '/tools/cheatsheet/git',
    addedAt: '2026-11-17',
    summary: {
      zh: '提交、分支、变基、回滚与排查类 Git 命令速查。',
      en: 'Git cheatsheet for commit, branch, rebase, rollback and troubleshooting commands.',
    },
    keywords: {
      zh: ['Git', '命令', '分支', 'rebase', '回滚', '速查'],
      en: ['git', 'command', 'branch', 'rebase', 'reset', 'cheatsheet'],
    },
    scenario: { zh: '前端速查', en: 'Cheatsheet' },
  },
  {
    path: '/tools/cheatsheet/vue',
    addedAt: '2026-11-17',
    summary: {
      zh: 'Vue 3 组合式 API、响应式、生命周期与组件通信写法速查。',
      en: 'Vue 3 cheatsheet for Composition API, reactivity, lifecycle and component communication.',
    },
    keywords: {
      zh: ['Vue3', '组合式 API', 'setup', '响应式', '生命周期', '速查'],
      en: ['vue3', 'composition api', 'setup', 'reactivity', 'lifecycle', 'cheatsheet'],
    },
    scenario: { zh: '前端速查', en: 'Cheatsheet' },
  },
  {
    path: '/tools/debug/device',
    addedAt: '2026-11-17',
    summary: {
      zh: '汇总屏幕尺寸、DPR、语言时区、CPU / 内存、网络、电量与 WebGL 渲染器等设备信息。',
      en: 'Inspect screen size, DPR, locale, CPU / memory, network, battery and WebGL renderer.',
    },
    keywords: {
      zh: ['设备信息', 'UA', '分辨率', 'DPR', 'WebGL', '网络类型'],
      en: ['device info', 'user agent', 'resolution', 'dpr', 'webgl', 'network'],
    },
    scenario: { zh: '调试检测', en: 'DevTools' },
  },
  {
    path: '/tools/debug/capability',
    addedAt: '2026-11-17',
    summary: {
      zh: '一键检测 40+ 项浏览器能力（WebGL、WebGPU、Observer、存储等），可只看不支持的项。',
      en: 'Detect 40+ browser capabilities (WebGL, WebGPU, observers, storage) and filter unsupported ones.',
    },
    keywords: {
      zh: ['能力检测', '特性检测', '兼容性', 'WebGPU', 'API', '浏览器'],
      en: ['capability', 'feature detect', 'compatibility', 'webgpu', 'api', 'browser'],
    },
    scenario: { zh: '调试检测', en: 'DevTools' },
  },
  {
    path: '/tools/debug/storage',
    addedAt: '2026-11-17',
    summary: {
      zh: '查看与编辑 localStorage、sessionStorage、Cookie，显示体积与 5MB 配额占比。',
      en: 'View and edit localStorage, sessionStorage and cookies with size and 5MB quota usage.',
    },
    keywords: {
      zh: ['本地存储', 'localStorage', 'sessionStorage', 'Cookie', '配额', '调试'],
      en: ['storage', 'localstorage', 'sessionstorage', 'cookie', 'quota', 'debug'],
    },
    scenario: { zh: '调试检测', en: 'DevTools' },
  },
  {
    path: '/tools/debug/perf',
    addedAt: '2026-11-17',
    summary: {
      zh: 'Performance API 性能面板：导航耗时、FP / FCP / LCP / CLS、资源汇总与最慢请求。',
      en: 'Performance panel with navigation timing, FP / FCP / LCP / CLS, resource summary and slowest requests.',
    },
    keywords: {
      zh: ['性能', 'LCP', 'CLS', 'FCP', 'PerformanceObserver', '加载耗时'],
      en: ['performance', 'lcp', 'cls', 'fcp', 'performanceobserver', 'timing'],
    },
    scenario: { zh: '调试检测', en: 'DevTools' },
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
  {
    key: 'convert',
    label: { zh: '编码与数据转换', en: 'Encoding & data' },
    desc: { zh: 'JWT、哈希、进制、CSV、SQL', en: 'JWT, hash, radix, CSV, SQL' },
    query: { zh: '转换', en: 'convert' },
    category: 'menus.tools',
  },
  {
    key: 'cheatsheet',
    label: { zh: '前端速查', en: 'Cheatsheet' },
    desc: { zh: 'CSS / JS / HTTP / Git / Vue3', en: 'CSS / JS / HTTP / Git / Vue3' },
    query: { zh: '速查', en: 'cheatsheet' },
    category: 'menus.tools',
  },
  {
    key: 'debug',
    label: { zh: '调试检测', en: 'DevTools' },
    desc: { zh: '设备、能力、存储与性能', en: 'Device, capability, storage, perf' },
    query: { zh: '调试', en: 'debug' },
    category: 'menus.tools',
  },
]
