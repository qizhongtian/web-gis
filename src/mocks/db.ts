/**
 * Mock 数据源（唯一来源）
 *
 * 两个消费者：
 *  1) mock/index.ts        —— 开发环境 Vite 中间件（真 HTTP）
 *  2) src/mocks/staticMock.ts —— 生产环境静态托管（GitHub Pages 等没有后端）
 * 改数据只改这里，两边自动保持一致。
 */

import { chartItemsByLibrary } from '../utils/charts/examples'
import { chartExamplePath, chartLevelLabels, chartLevels, libraries, libraryMetas } from '../utils/charts/model'

export interface MockUser {
  id: number
  username: string
  password: string
  nickname: string
  roles: string[]
  permissions: string[]
}

export interface MockMenu {
  id: number
  label: string
  labelEn?: string
  key: string
  icon: string
  path: string
  component: string
  roles: string[]
  children: MockMenu[]
}

export interface MockRole {
  id: number
  key: string
  name: string
  remark: string
}

export const TOKEN_PREFIX = 'mock-token-'

export const mockUsers: MockUser[] = [
  {
    id: 1,
    username: 'admin',
    password: '123456',
    nickname: '超级管理员',
    roles: ['admin'],
    permissions: ['sys:user:add', 'sys:user:delete', 'sys:role:edit', 'sys:menu:edit', 'gis:measure', 'gis:draw'],
  },
  {
    id: 2,
    username: 'viewer',
    password: '123456',
    nickname: '演示用户',
    roles: ['viewer'],
    permissions: ['gis:measure'],
  },
]

export const mockRoles: MockRole[] = [
  { id: 1, key: 'admin', name: '管理员', remark: '拥有全部权限' },
  { id: 2, key: 'viewer', name: '演示用户', remark: '仅可查看示例' },
]

function group(
  id: number,
  label: string,
  labelEn: string,
  key: string,
  icon: string,
  path: string,
  children: MockMenu[],
): MockMenu {
  return { id, label, labelEn, key, icon, path, component: '', roles: ['admin', 'viewer'], children }
}

function leaf(
  id: number,
  label: string,
  labelEn: string,
  key: string,
  path: string,
  component: string,
): MockMenu {
  return { id, label, labelEn, key, icon: '', path, component, roles: ['admin', 'viewer'], children: [] }
}

export const mockMenus: MockMenu[] = [
  {
    id: 1,
    label: '首页',
    labelEn: 'Home',
    key: 'menus.home',
    icon: 'HomeFilled',
    path: '/home',
    component: 'dashboard/index.vue',
    roles: ['admin', 'viewer'],
    children: [],
  },
  {
    id: 2,
    label: 'Cesium',
    key: 'menus.cesium',
    icon: 'Platform',
    path: '/cesium',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(21, '基础', 'Basic', 'menus.cesiumBasic', 'SetUp', '/cesium/basic', [
        leaf(2101, '地球初始化', 'Init Globe', 'menus.cesiumInit', '/cesium/basic/init', 'cesium/basic/init/index.vue'),
        leaf(2102, '相机控制', 'Camera', 'menus.cesiumCamera', '/cesium/basic/camera', 'cesium/basic/camera/index.vue'),
        leaf(2103, '地形', 'Terrain', 'menus.cesiumTerrain', '/cesium/basic/terrain', 'cesium/basic/terrain/index.vue'),
        leaf(2104, '3D Tiles 倾斜', '3D Tiles', 'menus.cesiumTiles', '/cesium/basic/3dtiles', 'cesium/basic/3dtiles/index.vue'),
        leaf(2105, '高斯泼溅', 'Gaussian Splatting', 'menus.cesiumGaussian', '/cesium/basic/gaussian', 'cesium/basic/gaussian/index.vue'),
        leaf(2106, '模型', 'Model', 'menus.cesiumModel', '/cesium/basic/model', 'cesium/basic/model/index.vue'),
        leaf(2107, '点图层', 'Point Layer', 'menus.cesiumPoint', '/cesium/basic/point', 'cesium/basic/point/index.vue'),
        leaf(2108, '线图层', 'Line Layer', 'menus.cesiumLine', '/cesium/basic/line', 'cesium/basic/line/index.vue'),
        leaf(2109, '面图层', 'Polygon Layer', 'menus.cesiumPolygon', '/cesium/basic/polygon', 'cesium/basic/polygon/index.vue'),
        leaf(2201, '精灵线', 'Sprite Line', 'menus.cesiumSpriteLine', '/cesium/basic/sprite-line', 'cesium/basic/sprite-line/index.vue'),
        leaf(2202, '扩散圆', 'Ripple Circle', 'menus.cesiumRippleCircle', '/cesium/basic/ripple-circle', 'cesium/basic/ripple-circle/index.vue'),
        leaf(2203, '扩散多边形', 'Ripple Polygon', 'menus.cesiumRipplePolygon', '/cesium/basic/ripple-polygon', 'cesium/basic/ripple-polygon/index.vue'),
        leaf(2204, '电子围栏', 'E-Fence', 'menus.cesiumFence', '/cesium/basic/fence', 'cesium/basic/fence/index.vue'),
      ]),
      group(23, '工具', 'Tools', 'menus.cesiumTool', 'Tools', '/cesium/tool', [
        leaf(2301, '空间量算', 'Measure', 'menus.cesiumMeasure', '/cesium/tool/measure', 'cesium/tool/measure/index.vue'),
        leaf(2302, '坐标拾取', 'Pick Position', 'menus.cesiumPick', '/cesium/tool/pick', 'cesium/tool/pick/index.vue'),
        leaf(2303, '场景导航', 'Navigation', 'menus.cesiumNavigation', '/cesium/tool/navigation', 'cesium/tool/navigation/index.vue'),
        leaf(2304, '交互绘制', 'Draw', 'menus.cesiumDraw', '/cesium/tool/draw', 'cesium/tool/draw/index.vue'),
        leaf(2305, '天气特效', 'Weather', 'menus.cesiumWeather', '/cesium/tool/weather', 'cesium/tool/weather/index.vue'),
        leaf(2306, '矢量上传', 'Vector Upload', 'menus.cesiumVector', '/cesium/tool/vector', 'cesium/tool/vector/index.vue'),
        leaf(2307, '高程提取', 'Surface Elevation', 'menus.cesiumElevation', '/cesium/tool/elevation', 'cesium/tool/elevation/index.vue'),
        leaf(2308, '数据探查', 'Data Inspector', 'menus.cesiumInspect', '/cesium/tool/inspect', 'cesium/tool/inspect/index.vue'),
      ]),
      group(28, '坐标转换', 'Coord Transform', 'menus.cesiumCoord', 'Switch', '/cesium/coord', [
        leaf(2801, '经纬度/笛卡尔转换', 'WGS84 <-> Cartesian', 'menus.cesiumTransform', '/cesium/coord/transform', 'cesium/coord/transform/index.vue'),
        leaf(2802, 'WGS84 / HK80', 'WGS84 / HK80', 'menus.cesiumHk80', '/cesium/coord/hk80', 'cesium/coord/hk80/index.vue'),
      ]),
      group(29, '视频融合', 'Video Fusion', 'menus.cesiumVideo', 'VideoCamera', '/cesium/video', [
        leaf(2901, '视频投影(简化)', 'Video Projection', 'menus.cesiumVideoProject', '/cesium/video/project', 'cesium/video/project/index.vue'),
      ]),
      group(210, '聚合', 'Cluster', 'menus.cesiumCluster', 'Grid', '/cesium/cluster', [
        leaf(2100, '点位聚合', 'Point Cluster', 'menus.cesiumClusterPoints', '/cesium/cluster/points', 'cesium/cluster/points/index.vue'),
        leaf(2101, '聚合点详情', 'Cluster Details', 'menus.cesiumClusterDetail', '/cesium/cluster/detail', 'cesium/cluster/detail/index.vue'),
      ]),
      group(211, '空间分析', 'Spatial Analysis', 'menus.cesiumAnalysis', 'DataAnalysis', '/cesium/analysis', [
        leaf(2110, '拾取与通视', 'Pick & Sight', 'menus.cesiumAnalysisPick', '/cesium/analysis/pick', 'cesium/analysis/pick/index.vue'),
      ]),
      group(212, '综合应用', 'Compose', 'menus.cesiumCompose', 'Odometer', '/cesium/compose', [
        leaf(2120, '综合示例', 'Compose Demo', 'menus.cesiumComposeDemo', '/cesium/compose/demo', 'cesium/compose/demo/index.vue'),
        leaf(2121, '轨迹回放', 'Track Playback', 'menus.cesiumTrack', '/cesium/compose/trackplayback', 'cesium/compose/trackplayback/index.vue'),
        leaf(2122, '双屏联动', 'Dual Screen', 'menus.cesiumDual', '/cesium/compose/dualscreen', 'cesium/compose/dualscreen/index.vue'),
        leaf(2123, '模型节点分层', 'Model Floors', 'menus.cesiumFloor', '/cesium/compose/floor', 'cesium/compose/floor/index.vue'),
      ]),
      group(215, '常见问题解决', 'FAQ Solutions', 'menus.cesiumFaq', 'QuestionFilled', '/cesium/faq', [
        leaf(2151, '点位贴地(无高程)', 'Clamp Point to Ground', 'menus.cesiumFaqClamp', '/cesium/faq/clamp', 'cesium/faq/clamp/index.vue'),
        leaf(2152, '点位高度取值', 'Point Elevation Sampling', 'menus.cesiumFaqElevation', '/cesium/faq/elevation', 'cesium/faq/elevation/index.vue'),
        leaf(2153, '海量 label 避让', 'Label Declutter', 'menus.cesiumFaqLabel', '/cesium/faq/label', 'cesium/faq/label-collision/index.vue'),
        leaf(2154, '弹窗跟随与边缘避让', 'Viewport Popup', 'menus.cesiumFaqPopup', '/cesium/faq/popup', 'cesium/faq/popup/index.vue'),
        leaf(2155, '海量点图标随视角缩放', 'Point Scale by Distance', 'menus.cesiumFaqPointScale', '/cesium/faq/pointscale', 'cesium/faq/point-scale/index.vue'),
        leaf(2156, '点选高亮单条', 'Highlight Picked Point', 'menus.cesiumFaqPointPick', '/cesium/faq/pointpick', 'cesium/faq/point-pick/index.vue'),
        leaf(2158, '海量点位：缩放·高亮·贴地', 'Mass Points: Scale, Pick, Clamp', 'menus.cesiumFaqPointSurface', '/cesium/faq/pointsurface', 'cesium/faq/point-surface/index.vue'),
        leaf(2157, '地形贴图标注', 'Terrain Surface Label', 'menus.cesiumFaqTerrainLabel', '/cesium/faq/terrainlabel', 'cesium/faq/terrain-label/index.vue'),
      ]),
    ],
  },
  {
    id: 3,
    label: 'Openlayer',
    key: 'menus.openlayer',
    icon: 'MapLocation',
    path: '/openlayer',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(31, '地图基础', 'Map Basics', 'menus.olBasic', 'SetUp', '/openlayer/basic', [
        leaf(3101, '地图初始化', 'Init Map', 'menus.olMap', '/openlayer/basic/map', 'openlayer/basic/map/index.vue'),
        leaf(3102, '底图', 'Basemap', 'menus.olBasemap', '/openlayer/basic/basemap', 'openlayer/basic/basemap/index.vue'),
        leaf(3103, '视图', 'View', 'menus.olView', '/openlayer/basic/view', 'openlayer/basic/view/index.vue'),
        leaf(
          3104,
          '坐标系',
          'Projection',
          'menus.olProjection',
          '/openlayer/basic/projection',
          'openlayer/basic/projection/index.vue',
        ),
        leaf(3105, '地图事件', 'Map Events', 'menus.olEvent', '/openlayer/basic/event', 'openlayer/basic/event/index.vue'),
      ]),
      group(32, '图层管理', 'Layer Management', 'menus.olLayer', 'Menu', '/openlayer/layer', [
        leaf(3201, 'TileLayer', 'TileLayer', 'menus.olTileLayer', '/openlayer/layer/tile', 'openlayer/layer/tile/index.vue'),
        leaf(
          3202,
          'ImageLayer',
          'ImageLayer',
          'menus.olImageLayer',
          '/openlayer/layer/image',
          'openlayer/layer/image/index.vue',
        ),
        leaf(3203, 'VectorLayer', 'VectorLayer', 'menus.olVector', '/openlayer/layer/vector', 'openlayer/layer/vector/index.vue'),
        leaf(3204, '图层树', 'Layer Tree', 'menus.olLayerTree', '/openlayer/layer/tree', 'openlayer/layer/tree/index.vue'),
        leaf(
          3205,
          '显隐与排序',
          'Visibility & Order',
          'menus.olLayerOrder',
          '/openlayer/layer/order',
          'openlayer/layer/order/index.vue',
        ),
      ]),
      group(33, '空间数据与要素', 'Spatial Data & Features', 'menus.olData', 'Document', '/openlayer/data', [
        leaf(3301, 'GeoJSON', 'GeoJSON', 'menus.olGeojson', '/openlayer/data/geojson', 'openlayer/data/geojson/index.vue'),
        leaf(3302, 'WKT', 'WKT', 'menus.olWkt', '/openlayer/data/wkt', 'openlayer/data/wkt/index.vue'),
        leaf(3303, '点线面', 'Geometry', 'menus.olGeometry', '/openlayer/data/geometry', 'openlayer/data/geometry/index.vue'),
        leaf(3304, 'Feature', 'Feature', 'menus.olFeature', '/openlayer/data/feature', 'openlayer/data/feature/index.vue'),
        leaf(3305, 'Style', 'Style', 'menus.olStyle', '/openlayer/data/style', 'openlayer/data/style/index.vue'),
        leaf(3306, '数据增删改查', 'Feature CRUD', 'menus.olCrud', '/openlayer/data/crud', 'openlayer/data/crud/index.vue'),
      ]),
      group(34, '地图交互', 'Map Interaction', 'menus.olService', 'Connection', '/openlayer/service', [
        leaf(3401, 'WMS', 'WMS', 'menus.olWms', '/openlayer/service/wms', 'openlayer/service/wms/index.vue'),
        leaf(3402, 'WFS', 'WFS', 'menus.olWfs', '/openlayer/service/wfs', 'openlayer/service/wfs/index.vue'),
        leaf(3403, 'WMTS', 'WMTS', 'menus.olWmts', '/openlayer/service/wmts', 'openlayer/service/wmts/index.vue'),
        leaf(3404, 'XYZ', 'XYZ', 'menus.olXyz', '/openlayer/service/xyz', 'openlayer/service/xyz/index.vue'),
        leaf(3405, 'MVT', 'MVT', 'menus.olMvt', '/openlayer/service/mvt', 'openlayer/service/mvt/index.vue'),
        leaf(
          3406,
          'GeoServer',
          'GeoServer',
          'menus.olGeoserver',
          '/openlayer/service/geoserver',
          'openlayer/service/geoserver/index.vue',
        ),
      ]),
      group(35, '空间分析', 'Spatial Analysis', 'menus.olAnalysis', 'DataAnalysis', '/openlayer/analysis', [
        leaf(3501, '缓冲区', 'Buffer', 'menus.olBuffer', '/openlayer/analysis/buffer', 'openlayer/analysis/buffer/index.vue'),
        leaf(
          3502,
          '相交',
          'Intersect',
          'menus.olIntersect',
          '/openlayer/analysis/intersect',
          'openlayer/analysis/intersect/index.vue',
        ),
        leaf(
          3503,
          '包含',
          'Contains',
          'menus.olContains',
          '/openlayer/analysis/contains',
          'openlayer/analysis/contains/index.vue',
        ),
        leaf(
          3504,
          '距离',
          'Distance',
          'menus.olDistance',
          '/openlayer/analysis/distance',
          'openlayer/analysis/distance/index.vue',
        ),
        leaf(3505, '面积', 'Area', 'menus.olArea', '/openlayer/analysis/area', 'openlayer/analysis/area/index.vue'),
        leaf(3506, '空间查询', 'Spatial Query', 'menus.olQuery', '/openlayer/analysis/query', 'openlayer/analysis/query/index.vue'),
      ]),
      group(36, '高级 GIS 功能', 'Advanced GIS', 'menus.olAdvanced', 'MagicStick', '/openlayer/advanced', [
        leaf(3601, '轨迹回放', 'Track Playback', 'menus.olTrack', '/openlayer/advanced/track', 'openlayer/advanced/track/index.vue'),
        leaf(3602, '热力图', 'Heatmap', 'menus.olHeatmap', '/openlayer/advanced/heatmap', 'openlayer/advanced/heatmap/index.vue'),
        leaf(3603, '聚合', 'Cluster', 'menus.olCluster', '/openlayer/advanced/cluster', 'openlayer/advanced/cluster/index.vue'),
        leaf(
          3604,
          '专题图',
          'Thematic Map',
          'menus.olThematic',
          '/openlayer/advanced/thematic',
          'openlayer/advanced/thematic/index.vue',
        ),
        leaf(
          3605,
          '动态渲染',
          'Dynamic Render',
          'menus.olDynamic',
          '/openlayer/advanced/dynamic',
          'openlayer/advanced/dynamic/index.vue',
        ),
      ]),
      group(37, '性能与架构', 'Performance & Architecture', 'menus.olPerf', 'Odometer', '/openlayer/performance', [
        leaf(
          3701,
          '海量数据',
          'Massive Data',
          'menus.olBigdata',
          '/openlayer/performance/bigdata',
          'openlayer/performance/bigdata/index.vue',
        ),
        leaf(3702, 'WebGL', 'WebGL', 'menus.olWebgl', '/openlayer/performance/webgl', 'openlayer/performance/webgl/index.vue'),
        leaf(
          3703,
          '矢量瓦片',
          'Vector Tile',
          'menus.olVectorTile',
          '/openlayer/performance/vectortile',
          'openlayer/performance/vectortile/index.vue',
        ),
        leaf(3704, 'Worker', 'Worker', 'menus.olWorker', '/openlayer/performance/worker', 'openlayer/performance/worker/index.vue'),
        leaf(
          3705,
          '模块化封装',
          'Modular Wrapper',
          'menus.olModule',
          '/openlayer/performance/module',
          'openlayer/performance/module/index.vue',
        ),
      ]),
    ],
  },
  {
    id: 4,
    label: 'Three',
    key: 'menus.three',
    icon: 'Cpu',
    path: '/three',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(41, '基础', 'Basic', 'menus.threeBasic', 'SetUp', '/three/basic', [
        leaf(4101, '场景', 'Scene', 'menus.threeScene', '/three/basic/scene', 'three/basic/scene/index.vue'),
        leaf(4102, '相机', 'Camera', 'menus.threeCamera', '/three/basic/camera', 'three/basic/camera/index.vue'),
        leaf(4103, '渲染器', 'Renderer', 'menus.threeRenderer', '/three/basic/renderer', 'three/basic/renderer/index.vue'),
        leaf(4104, '坐标系', 'Coordinate', 'menus.threeCoordinate', '/three/basic/coordinate', 'three/basic/coordinate/index.vue'),
        leaf(4105, '几何体', 'Geometry', 'menus.threeGeometryShape', '/three/basic/geometry', 'three/basic/geometry/index.vue'),
        leaf(4106, '网格模型', 'Mesh', 'menus.threeMesh', '/three/basic/mesh', 'three/basic/mesh/index.vue'),
      ]),
      group(42, '场景交互', 'Interaction', 'menus.threeInteraction', 'Pointer', '/three/interaction', [
        leaf(4201, '轨道控制器', 'OrbitControls', 'menus.threeControls', '/three/interaction/controls', 'three/interaction/controls/index.vue'),
        leaf(4202, '射线拾取', 'Raycasting', 'menus.threeRaycast', '/three/interaction/raycast', 'three/interaction/raycast/index.vue'),
        leaf(4203, '鼠标事件', 'Pointer Events', 'menus.threeEvents', '/three/interaction/events', 'three/interaction/events/index.vue'),
        leaf(4204, '坐标转换', 'Screen to World', 'menus.threeCoordConvert', '/three/interaction/coord', 'three/interaction/coord/index.vue'),
        leaf(4205, '动画循环', 'Animation Loop', 'menus.threeLoop', '/three/interaction/loop', 'three/interaction/loop/index.vue'),
      ]),
      group(43, '模型与动画', 'Model & Animation', 'menus.threeModel', 'VideoPlay', '/three/model', [
        leaf(4301, 'GLTF / GLB', 'GLTF / GLB', 'menus.threeGltf', '/three/model/gltf', 'three/model/gltf/index.vue'),
        leaf(4302, 'FBX 模型', 'FBX', 'menus.threeFbx', '/three/model/fbx', 'three/model/fbx/index.vue'),
        leaf(4303, '骨骼动画', 'Skinned Mesh', 'menus.threeSkeleton', '/three/model/skeleton', 'three/model/skeleton/index.vue'),
        leaf(4304, '模型加载', 'Asset Loading', 'menus.threeLoader', '/three/model/loader', 'three/model/loader/index.vue'),
        leaf(4305, '模型编辑', 'Model Editing', 'menus.threeEdit', '/three/model/edit', 'three/model/edit/index.vue'),
        leaf(4306, '路径动画', 'Path Animation', 'menus.threePath', '/three/model/path', 'three/model/path/index.vue'),
      ]),
      group(44, '材质与光照', 'Material & Light', 'menus.threeMaterial', 'PictureFilled', '/three/material', [
        leaf(4401, '标准材质', 'MeshStandardMaterial', 'menus.threeStandard', '/three/material/standard', 'three/material/standard/index.vue'),
        leaf(4402, 'PBR 参数', 'PBR', 'menus.threePbr', '/three/material/pbr', 'three/material/pbr/index.vue'),
        leaf(4403, '纹理', 'Texture', 'menus.threeTexture', '/three/material/texture', 'three/material/texture/index.vue'),
        leaf(4404, '环境贴图', 'Environment', 'menus.threeEnv', '/three/material/env', 'three/material/env/index.vue'),
        leaf(4405, '阴影', 'Shadow', 'menus.threeShadow', '/three/material/shadow', 'three/material/shadow/index.vue'),
        leaf(4406, '后处理', 'Post Processing', 'menus.threePost', '/three/material/post', 'three/material/post/index.vue'),
      ]),
      group(45, '高级几何与空间计算', 'Advanced Geometry', 'menus.threeAdvanced', 'Grid', '/three/geometry', [
        leaf(4501, 'BufferGeometry', 'BufferGeometry', 'menus.threeBuffer', '/three/geometry/buffer', 'three/geometry/buffer/index.vue'),
        leaf(4502, 'InstancedMesh', 'InstancedMesh', 'menus.threeInstanced', '/three/geometry/instanced', 'three/geometry/instanced/index.vue'),
        leaf(4503, '曲线', 'Curve', 'menus.threeCurve', '/three/geometry/curve', 'three/geometry/curve/index.vue'),
        leaf(4504, '布尔运算', 'CSG', 'menus.threeBoolean', '/three/geometry/boolean', 'three/geometry/boolean/index.vue'),
        leaf(4505, '空间索引', 'Spatial Index', 'menus.threeSpatial', '/three/geometry/spatial', 'three/geometry/spatial/index.vue'),
      ]),
      group(46, 'Shader 编程', 'Shader', 'menus.threeShader', 'MagicStick', '/three/shader', [
        leaf(4601, 'GLSL 基础', 'GLSL Basics', 'menus.threeGlsl', '/three/shader/glsl', 'three/shader/glsl/index.vue'),
        leaf(4602, '顶点着色器', 'Vertex Shader', 'menus.threeVertexShader', '/three/shader/vertex', 'three/shader/vertex/index.vue'),
        leaf(4603, '片元着色器', 'Fragment Shader', 'menus.threeFragmentShader', '/three/shader/fragment', 'three/shader/fragment/index.vue'),
        leaf(4604, '流光', 'Flowing Light', 'menus.threeFlow', '/three/shader/flow', 'three/shader/flow/index.vue'),
        leaf(4605, '扫描', 'Scanning', 'menus.threeScan', '/three/shader/scan', 'three/shader/scan/index.vue'),
        leaf(4606, '粒子', 'Particles', 'menus.threeParticle', '/three/shader/particle', 'three/shader/particle/index.vue'),
        leaf(4607, '后期特效', 'Post Effect', 'menus.threeEffect', '/three/shader/effect', 'three/shader/effect/index.vue'),
      ]),
      group(47, '性能优化与工程化', 'Performance', 'menus.threePerformance', 'Odometer', '/three/performance', [
        leaf(4701, 'DrawCall', 'DrawCall', 'menus.threeDrawcall', '/three/performance/drawcall', 'three/performance/drawcall/index.vue'),
        leaf(4702, 'LOD', 'LOD', 'menus.threeLod', '/three/performance/lod', 'three/performance/lod/index.vue'),
        leaf(4703, 'GPU Instancing', 'GPU Instancing', 'menus.threeGpuInstancing', '/three/performance/instancing', 'three/performance/instancing/index.vue'),
        leaf(4704, 'Web Worker', 'Web Worker', 'menus.threeWorker', '/three/performance/worker', 'three/performance/worker/index.vue'),
        leaf(4705, '内存管理', 'Memory', 'menus.threeMemory', '/three/performance/memory', 'three/performance/memory/index.vue'),
        leaf(4706, '资源调度', 'Scheduling', 'menus.threeScheduler', '/three/performance/scheduler', 'three/performance/scheduler/index.vue'),
      ]),
    ],
  },
  {
    id: 6,
    label: 'Leaflet',
    key: 'menus.leaflet',
    icon: 'Place',
    path: '/leaflet',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(61, '基础', 'Basic', 'menus.leafletBasic', 'SetUp', '/leaflet/basic', [
        leaf(6101, '地图初始化', 'Init Map', 'menus.leafletMap', '/leaflet/basic/map', 'leaflet/basic/map/index.vue'),
        leaf(6102, '底图切换', 'Basemap', 'menus.leafletBasemap', '/leaflet/basic/basemap', 'leaflet/basic/basemap/index.vue'),
        leaf(6103, '坐标与投影', 'Projection', 'menus.leafletProjection', '/leaflet/basic/projection', 'leaflet/basic/projection/index.vue'),
        leaf(6104, '缩放控制', 'Zoom', 'menus.leafletZoom', '/leaflet/basic/zoom', 'leaflet/basic/zoom/index.vue'),
        leaf(6105, '平移与视角', 'Pan', 'menus.leafletPan', '/leaflet/basic/pan', 'leaflet/basic/pan/index.vue'),
        leaf(6106, '图层控制', 'Layer Control', 'menus.leafletLayers', '/leaflet/basic/layers', 'leaflet/basic/layers/index.vue'),
      ]),
      group(62, '核心地图功能', 'Core Features', 'menus.leafletCore', 'Menu', '/leaflet/core', [
        leaf(6201, 'Marker 标注', 'Marker', 'menus.leafletMarker', '/leaflet/core/marker', 'leaflet/core/marker/index.vue'),
        leaf(6202, 'Polyline 折线', 'Polyline', 'menus.leafletPolyline', '/leaflet/core/polyline', 'leaflet/core/polyline/index.vue'),
        leaf(6203, 'Polygon 多边形', 'Polygon', 'menus.leafletPolygon', '/leaflet/core/polygon', 'leaflet/core/polygon/index.vue'),
        leaf(6204, 'GeoJSON 数据', 'GeoJSON', 'menus.leafletGeojson', '/leaflet/core/geojson', 'leaflet/core/geojson/index.vue'),
        leaf(6205, 'WMS 服务', 'WMS', 'menus.leafletWms', '/leaflet/core/wms', 'leaflet/core/wms/index.vue'),
        leaf(6206, 'WFS 服务', 'WFS', 'menus.leafletWfs', '/leaflet/core/wfs', 'leaflet/core/wfs/index.vue'),
      ]),
      group(63, '地图交互进阶', 'Interaction', 'menus.leafletInteraction', 'Pointer', '/leaflet/interaction', [
        leaf(6301, '事件监听', 'Events', 'menus.leafletEvent', '/leaflet/interaction/event', 'leaflet/interaction/event/index.vue'),
        leaf(6302, '弹窗', 'Popup', 'menus.leafletPopup', '/leaflet/interaction/popup', 'leaflet/interaction/popup/index.vue'),
        leaf(6303, '绘制', 'Draw', 'menus.leafletDraw', '/leaflet/interaction/draw', 'leaflet/interaction/draw/index.vue'),
        leaf(6304, '要素编辑', 'Edit', 'menus.leafletEdit', '/leaflet/interaction/edit', 'leaflet/interaction/edit/index.vue'),
        leaf(6305, '点聚合', 'Cluster', 'menus.leafletCluster', '/leaflet/interaction/cluster', 'leaflet/interaction/cluster/index.vue'),
        leaf(6306, '轨迹回放', 'Track Playback', 'menus.leafletTrack', '/leaflet/interaction/track', 'leaflet/interaction/track/index.vue'),
      ]),
      group(64, 'GIS 空间分析', 'Spatial Analysis', 'menus.leafletAnalysis', 'DataAnalysis', '/leaflet/analysis', [
        leaf(6401, '空间关系', 'Relations', 'menus.leafletRelation', '/leaflet/analysis/relation', 'leaflet/analysis/relation/index.vue'),
        leaf(6402, '距离计算', 'Distance', 'menus.leafletDistance', '/leaflet/analysis/distance', 'leaflet/analysis/distance/index.vue'),
        leaf(6403, '面积计算', 'Area', 'menus.leafletArea', '/leaflet/analysis/area', 'leaflet/analysis/area/index.vue'),
        leaf(6404, '缓冲区分析', 'Buffer', 'menus.leafletBuffer', '/leaflet/analysis/buffer', 'leaflet/analysis/buffer/index.vue'),
        leaf(6405, '空间查询', 'Spatial Query', 'menus.leafletSpatialQuery', '/leaflet/analysis/spatial-query', 'leaflet/analysis/spatial-query/index.vue'),
        leaf(6406, '坐标转换', 'Coordinate Transform', 'menus.leafletTransform', '/leaflet/analysis/transform', 'leaflet/analysis/transform/index.vue'),
      ]),
      group(65, '高级地图可视化', 'Visualization', 'menus.leafletVisual', 'DataLine', '/leaflet/advanced', [
        leaf(6501, '热力图', 'Heatmap', 'menus.leafletHeatmap', '/leaflet/advanced/heatmap', 'leaflet/advanced/heatmap/index.vue'),
        leaf(6502, '等值面', 'Isoline', 'menus.leafletIsoline', '/leaflet/advanced/isoline', 'leaflet/advanced/isoline/index.vue'),
        leaf(6503, '专题图', 'Thematic Map', 'menus.leafletThematic', '/leaflet/advanced/thematic', 'leaflet/advanced/thematic/index.vue'),
        leaf(6504, 'Canvas 渲染', 'Canvas Render', 'menus.leafletCanvas', '/leaflet/advanced/canvas', 'leaflet/advanced/canvas/index.vue'),
        leaf(6505, 'WebGL 渲染', 'WebGL Render', 'menus.leafletWebgl', '/leaflet/advanced/webgl', 'leaflet/advanced/webgl/index.vue'),
        leaf(6506, '大数据渲染', 'Big Data', 'menus.leafletBigdata', '/leaflet/advanced/bigdata', 'leaflet/advanced/bigdata/index.vue'),
      ]),
      group(66, '性能与架构优化', 'Performance', 'menus.leafletPerformance', 'Odometer', '/leaflet/performance', [
        leaf(6601, '图层管理', 'Layer Manager', 'menus.leafletLayerManager', '/leaflet/performance/layer-manager', 'leaflet/performance/layer-manager/index.vue'),
        leaf(6602, '分级加载', 'Lazy Load', 'menus.leafletLazyLoad', '/leaflet/performance/lazy-load', 'leaflet/performance/lazy-load/index.vue'),
        leaf(6603, '聚合性能', 'Cluster Perf', 'menus.leafletClusterPerf', '/leaflet/performance/cluster-perf', 'leaflet/performance/cluster-perf/index.vue'),
        leaf(6604, '缓存策略', 'Cache', 'menus.leafletCache', '/leaflet/performance/cache', 'leaflet/performance/cache/index.vue'),
        leaf(6605, '内存管理', 'Memory', 'menus.leafletMemory', '/leaflet/performance/memory', 'leaflet/performance/memory/index.vue'),
        leaf(6606, '插件开发', 'Plugin', 'menus.leafletPlugin', '/leaflet/performance/plugin', 'leaflet/performance/plugin/index.vue'),
      ]),
      group(67, '企业级 GIS 项目', 'Enterprise', 'menus.leafletEnterprise', 'OfficeBuilding', '/leaflet/enterprise', [
        leaf(6701, '实时定位', 'Realtime Tracking', 'menus.leafletRealtime', '/leaflet/enterprise/realtime', 'leaflet/enterprise/realtime/index.vue'),
        leaf(6702, '物联网监控', 'IoT Monitor', 'menus.leafletIot', '/leaflet/enterprise/iot', 'leaflet/enterprise/iot/index.vue'),
        leaf(6703, '电子围栏', 'Geo-fence', 'menus.leafletFence', '/leaflet/enterprise/fence', 'leaflet/enterprise/fence/index.vue'),
        leaf(6704, '轨迹分析', 'Track Analysis', 'menus.leafletTrackAnalysis', '/leaflet/enterprise/track', 'leaflet/enterprise/track/index.vue'),
        leaf(6705, '多源数据融合', 'Data Fusion', 'menus.leafletFusion', '/leaflet/enterprise/fusion', 'leaflet/enterprise/fusion/index.vue'),
      ]),
    ],
  },
  {
    id: 10,
    label: 'MapLibre',
    key: 'menus.maplibre',
    icon: 'Compass',
    path: '/maplibre',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(75, '基础', 'Basic', 'menus.maplibreBasic', 'SetUp', '/maplibre/basic', [
        leaf(7501, '地图初始化', 'Init Map', 'menus.mlMap', '/maplibre/basic/map', 'maplibre/basic/map/index.vue'),
        leaf(7502, '样式与底图', 'Style & Basemap', 'menus.mlStyle', '/maplibre/basic/style', 'maplibre/basic/style/index.vue'),
        leaf(7503, '相机控制', 'Camera', 'menus.mlCamera', '/maplibre/basic/camera', 'maplibre/basic/camera/index.vue'),
      ]),
      group(76, '数据与图层', 'Data & Layers', 'menus.maplibreData', 'Menu', '/maplibre/data', [
        leaf(7601, 'GeoJSON 图层', 'GeoJSON Layer', 'menus.mlGeojson', '/maplibre/data/geojson', 'maplibre/data/geojson/index.vue'),
        leaf(7602, '标记与弹窗', 'Marker & Popup', 'menus.mlMarker', '/maplibre/data/marker', 'maplibre/data/marker/index.vue'),
        leaf(7603, '栅格图层', 'Raster Layer', 'menus.mlRaster', '/maplibre/data/raster', 'maplibre/data/raster/index.vue'),
        leaf(7604, '图层管理', 'Layer Manager', 'menus.mlLayers', '/maplibre/data/layers', 'maplibre/data/layers/index.vue'),
      ]),
      group(77, '三维可视化', '3D Visualization', 'menus.maplibre3d', 'DataLine', '/maplibre/3d', [
        leaf(7701, '3D 建筑', '3D Buildings', 'menus.mlBuildings', '/maplibre/3d/buildings', 'maplibre/3d/buildings/index.vue'),
        leaf(7702, '地形起伏', 'Terrain', 'menus.mlTerrain', '/maplibre/3d/terrain', 'maplibre/3d/terrain/index.vue'),
        leaf(7703, '热力图', 'Heatmap', 'menus.mlHeatmap', '/maplibre/3d/heatmap', 'maplibre/3d/heatmap/index.vue'),
      ]),
      group(78, '高级进阶', 'Advanced', 'menus.maplibreAdvanced', 'Odometer', '/maplibre/advanced', [
        leaf(7801, '点聚合', 'Cluster', 'menus.mlCluster', '/maplibre/advanced/cluster', 'maplibre/advanced/cluster/index.vue'),
        leaf(7802, '大数据渲染', 'Big Data', 'menus.mlBigdata', '/maplibre/advanced/bigdata', 'maplibre/advanced/bigdata/index.vue'),
        leaf(7803, '自定义图层', 'Custom Layer', 'menus.mlCustom', '/maplibre/advanced/custom', 'maplibre/advanced/custom/index.vue'),
        leaf(7804, '路径动画', 'Path Animation', 'menus.mlAnimate', '/maplibre/advanced/animate', 'maplibre/advanced/animate/index.vue'),
      ]),
    ],
  },
  {
    id: 11,
    label: 'Mapbox',
    key: 'menus.mapbox',
    icon: 'Position',
    path: '/mapbox',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(85, '基础', 'Basic', 'menus.mapboxBasic', 'SetUp', '/mapbox/basic', [
        leaf(8501, '地图初始化', 'Init Map', 'menus.mbxMap', '/mapbox/basic/map', 'mapbox/basic/map/index.vue'),
        leaf(8502, '样式切换', 'Style Switch', 'menus.mbxStyle', '/mapbox/basic/style', 'mapbox/basic/style/index.vue'),
        leaf(8503, '相机动画', 'Camera', 'menus.mbxCamera', '/mapbox/basic/camera', 'mapbox/basic/camera/index.vue'),
      ]),
      group(86, '数据与图层', 'Data & Layers', 'menus.mapboxData', 'Menu', '/mapbox/data', [
        leaf(8601, 'GeoJSON 图层', 'GeoJSON Layer', 'menus.mbxGeojson', '/mapbox/data/geojson', 'mapbox/data/geojson/index.vue'),
        leaf(8602, '标记与弹窗', 'Marker & Popup', 'menus.mbxMarker', '/mapbox/data/marker', 'mapbox/data/marker/index.vue'),
        leaf(8603, '栅格图层', 'Raster Layer', 'menus.mbxRaster', '/mapbox/data/raster', 'mapbox/data/raster/index.vue'),
      ]),
      group(87, '三维可视化', '3D Visualization', 'menus.mapbox3d', 'DataLine', '/mapbox/3d', [
        leaf(8701, '3D 建筑', '3D Buildings', 'menus.mbxBuildings', '/mapbox/3d/buildings', 'mapbox/3d/buildings/index.vue'),
        leaf(8702, '地形起伏', 'Terrain', 'menus.mbxTerrain', '/mapbox/3d/terrain', 'mapbox/3d/terrain/index.vue'),
        leaf(8703, '热力图', 'Heatmap', 'menus.mbxHeatmap', '/mapbox/3d/heatmap', 'mapbox/3d/heatmap/index.vue'),
      ]),
      group(88, '高级进阶', 'Advanced', 'menus.mapboxAdvanced', 'Odometer', '/mapbox/advanced', [
        leaf(8801, '点聚合', 'Cluster', 'menus.mbxCluster', '/mapbox/advanced/cluster', 'mapbox/advanced/cluster/index.vue'),
        leaf(8802, '大数据渲染', 'Big Data', 'menus.mbxBigdata', '/mapbox/advanced/bigdata', 'mapbox/advanced/bigdata/index.vue'),
        leaf(8803, '自定义图层', 'Custom Layer', 'menus.mbxCustom', '/mapbox/advanced/custom', 'mapbox/advanced/custom/index.vue'),
        leaf(8804, '要素查询', 'Feature Query', 'menus.mbxQuery', '/mapbox/advanced/query', 'mapbox/advanced/query/index.vue'),
      ]),
    ],
  },
  {
    id: 8,
    label: '视频监控',
    labelEn: 'Video Monitor',
    key: 'menus.video',
    icon: 'VideoCamera',
    path: '/video',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(81, 'WSPlayer', 'WSPlayer', 'menus.videoWsplayer', 'VideoPlay', '/video/wsplayer', [
        leaf(
          8101,
          '实时画面',
          'Realtime',
          'menus.videoRealtime',
          '/video/wsplayer/real',
          'video/wsplayer/real/index.vue',
        ),
        leaf(
          8102,
          '历史回放',
          'Playback',
          'menus.videoPlayback',
          '/video/wsplayer/record',
          'video/wsplayer/record/index.vue',
        ),
        leaf(8103, '流解析错误码', 'Stream Error Codes', 'menus.videoWsErrors', '/video/wsplayer/errors', 'video/wsplayer/errors.vue'),
      ]),
      leaf(8201, 'Flv.js', 'Flv.js', 'menus.videoFlv', '/video/flv', 'video/flv/index.vue'),
      leaf(8301, 'Hls.js', 'Hls.js', 'menus.videoHls', '/video/hls', 'video/hls/index.vue'),
      leaf(
        8401,
        'EasyPlayer.js',
        'EasyPlayer.js',
        'menus.videoEasyplayer',
        '/video/easyplayer',
        'video/easyplayer/index.vue',
      ),
      leaf(
        8501,
        'ZLMRTCClient.js',
        'ZLMRTCClient.js',
        'menus.videoZlmrtc',
        '/video/zlmrtc',
        'video/zlmrtc/index.vue',
      ),
      leaf(8601, 'Jessibuca', 'Jessibuca', 'menus.videoJessibuca', '/video/jessibuca', 'video/jessibuca/index.vue'),
      leaf(8701, 'h265web.js', 'h265web.js', 'menus.videoH265web', '/video/h265web', 'video/h265web/index.vue'),
      leaf(8901, 'WebRTC', 'WebRTC', 'menus.videoWebrtc', '/video/webrtc', 'video/webrtc/index.vue'),
    ],
  },
  group(12, '图表基础库', 'Chart Libraries', 'menus.charts', 'DataAnalysis', '/charts',
    libraries.map((library, libraryIndex) => {
      const name = libraryMetas[library].name
      const path = `/charts/${library}`
      const keys = { echarts: 'chartEcharts', g2: 'chartG2', d3: 'chartD3', plotly: 'chartPlotly' }
      return group(1201 + libraryIndex, name, name, `menus.${keys[library]}`, '', path,
        chartLevels.map((level, levelIndex) => group(
          12000 + libraryIndex * 100 + levelIndex,
          ...chartLevelLabels[level], `menus.chartLevel_${level}`, '', `${path}/${level}`,
          chartItemsByLibrary[library].filter(item => item.level === level).map((item, index) => leaf(
            120000 + libraryIndex * 1000 + levelIndex * 100 + index,
            ...item.title, `menus.chartExample_${item.id}`, chartExamplePath(item), 'charts/index.vue',
          )),
        )),
      )
    }),
  ),
  {
    id: 9,
    label: '在线工具',
    labelEn: 'Toolkit',
    key: 'menus.tools',
    icon: 'Suitcase',
    path: '/tools',
    component: '',
    roles: ['admin', 'viewer'],
    children: [
      group(91, '编辑器', 'Editors', 'menus.toolsEditor', 'EditPen', '/tools/editor', [
        leaf(9101, 'Markdown', 'Markdown', 'menus.toolsMarkdown', '/tools/editor/markdown', 'tools/editor/markdown/index.vue'),
        leaf(9102, '富文本', 'Rich Text', 'menus.toolsRichtext', '/tools/editor/richtext', 'tools/editor/richtext/index.vue'),
        leaf(9103, '代码比对', 'Code Diff', 'menus.toolsDiff', '/tools/editor/diff', 'tools/editor/diff/index.vue'),
      ]),
      group(92, '编码转换', 'Converters', 'menus.toolsCodec', 'Switch', '/tools/codec', [
        leaf(9201, 'JSON 工具', 'JSON Tools', 'menus.toolsJson', '/tools/codec/json', 'tools/codec/json/index.vue'),
        leaf(9202, '正则测试', 'Regex Test', 'menus.toolsRegex', '/tools/codec/regex', 'tools/codec/regex/index.vue'),
        leaf(9203, '编码解码', 'Encode / Decode', 'menus.toolsEncode', '/tools/codec/encode', 'tools/codec/encode/index.vue'),
        leaf(9204, '时间戳转换', 'Timestamp', 'menus.toolsTimestamp', '/tools/codec/timestamp', 'tools/codec/timestamp/index.vue'),
        leaf(9205, 'JWT 解析', 'JWT Parser', 'menus.toolsJwt', '/tools/codec/jwt', 'tools/codec/jwt/index.vue'),
        leaf(9206, '哈希计算', 'Hash', 'menus.toolsHash', '/tools/codec/hash', 'tools/codec/hash/index.vue'),
        leaf(9207, '进制转换', 'Radix', 'menus.toolsRadix', '/tools/codec/radix', 'tools/codec/radix/index.vue'),
      ]),
      group(93, '设计辅助', 'Design', 'menus.toolsDesign', 'Brush', '/tools/design', [
        leaf(9301, '颜色工具', 'Color', 'menus.toolsColor', '/tools/design/color', 'tools/design/color/index.vue'),
        leaf(9302, '渐变生成', 'Gradient', 'menus.toolsGradient', '/tools/design/gradient', 'tools/design/gradient/index.vue'),
        leaf(9303, '阴影生成', 'Box Shadow', 'menus.toolsShadow', '/tools/design/shadow', 'tools/design/shadow/index.vue'),
        leaf(9304, '电子签名', 'Signature', 'menus.toolsSignature', '/tools/design/signature', 'tools/design/signature/index.vue'),
        leaf(9305, '圆角生成', 'Border Radius', 'menus.toolsRadius', '/tools/design/radius', 'tools/design/radius/index.vue'),
        leaf(9306, '单位换算', 'Units', 'menus.toolsUnit', '/tools/design/unit', 'tools/design/unit/index.vue'),
        leaf(9307, '对比度检测', 'Contrast', 'menus.toolsContrast', '/tools/design/contrast', 'tools/design/contrast/index.vue'),
      ]),
      group(94, '图片工具', 'Images', 'menus.toolsImage', 'Picture', '/tools/image', [
        leaf(9401, '图片 Base64', 'Image Base64', 'menus.toolsImageBase64', '/tools/image/base64', 'tools/image/base64/index.vue'),
        leaf(9402, '图片压缩', 'Image Compress', 'menus.toolsImageCompress', '/tools/image/compress', 'tools/image/compress/index.vue'),
        leaf(9403, '二维码生成', 'QR Code', 'menus.toolsQrcode', '/tools/image/qrcode', 'tools/image/qrcode/index.vue'),
      ]),
      group(95, '文本处理', 'Text', 'menus.toolsText', 'Notebook', '/tools/text', [
        leaf(9501, '文本统计', 'Text Stats', 'menus.toolsTextStats', '/tools/text/stats', 'tools/text/stats/index.vue'),
        leaf(9502, '命名风格', 'Case Convert', 'menus.toolsTextCase', '/tools/text/case', 'tools/text/case/index.vue'),
        leaf(9503, '行处理', 'Line Tools', 'menus.toolsTextLines', '/tools/text/lines', 'tools/text/lines/index.vue'),
        leaf(9504, '假数据生成', 'Mock Data', 'menus.toolsTextMock', '/tools/text/mock', 'tools/text/mock/index.vue'),
      ]),
      group(96, '数据转换', 'Data', 'menus.toolsDataGroup', 'Files', '/tools/data', [
        leaf(9601, 'CSV ↔ JSON', 'CSV / JSON', 'menus.toolsCsv', '/tools/data/csv', 'tools/data/csv/index.vue'),
        leaf(9602, 'JSON → TS', 'JSON to TS', 'menus.toolsJsonTs', '/tools/data/json-ts', 'tools/data/json-ts/index.vue'),
        leaf(9603, 'SQL 格式化', 'SQL Format', 'menus.toolsSql', '/tools/data/sql', 'tools/data/sql/index.vue'),
      ]),
      group(97, '前端速查', 'Cheatsheet', 'menus.toolsCheatsheet', 'Reading', '/tools/cheatsheet', [
        leaf(9701, 'CSS 速查', 'CSS', 'menus.cheatCss', '/tools/cheatsheet/css', 'tools/cheatsheet/css/index.vue'),
        leaf(9702, 'JS 速查', 'JavaScript', 'menus.cheatJs', '/tools/cheatsheet/js', 'tools/cheatsheet/js/index.vue'),
        leaf(9703, 'HTTP 速查', 'HTTP', 'menus.cheatHttp', '/tools/cheatsheet/http', 'tools/cheatsheet/http/index.vue'),
        leaf(9704, 'Git 速查', 'Git', 'menus.cheatGit', '/tools/cheatsheet/git', 'tools/cheatsheet/git/index.vue'),
        leaf(9705, 'Vue3 速查', 'Vue 3', 'menus.cheatVue', '/tools/cheatsheet/vue', 'tools/cheatsheet/vue/index.vue'),
      ]),
      group(98, '调试检测', 'DevTools', 'menus.toolsDebug', 'Monitor', '/tools/debug', [
        leaf(9801, '设备信息', 'Device Info', 'menus.debugDevice', '/tools/debug/device', 'tools/debug/device/index.vue'),
        leaf(9802, '能力探测', 'Capability', 'menus.debugCapability', '/tools/debug/capability', 'tools/debug/capability/index.vue'),
        leaf(9803, '存储管理', 'Storage', 'menus.debugStorage', '/tools/debug/storage', 'tools/debug/storage/index.vue'),
        leaf(9804, '性能面板', 'Performance', 'menus.debugPerf', '/tools/debug/perf', 'tools/debug/perf/index.vue'),
      ]),
    ],
  },
  {
    id: 5,
    label: '系统管理',
    labelEn: 'System',
    key: 'menus.system',
    icon: 'Setting',
    path: '/system',
    component: '',
    roles: ['admin'],
    children: [
      leaf(51, '用户管理', 'Users', 'menus.systemUser', '/system/user', 'system/user/index.vue'),
      leaf(52, '角色管理', 'Roles', 'menus.systemRole', '/system/role', 'system/role/index.vue'),
      leaf(53, '菜单管理', 'Menus', 'menus.systemMenu', '/system/menu', 'system/menu/index.vue'),
    ],
  },
]

/** 按角色过滤菜单树（父节点无权限时整枝裁掉） */
export function filterMenus(node: MockMenu, roles: string[]): MockMenu | null {
  if (!node.roles?.some((r) => roles.includes(r))) return null
  const children = (node.children || [])
    .map((c) => filterMenus(c, roles))
    .filter((c): c is MockMenu => !!c)
  return { ...node, children }
}

/** 生成形如 mock-token-admin-1710000000000 的 token */
export function makeToken(username: string): string {
  return `${TOKEN_PREFIX}${username}-${Date.now()}`
}

/** 从 token 反解用户（无状态实现：刷新页面后依然有效） */
export function userFromToken(token: string): MockUser | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null
  const rest = token.slice(TOKEN_PREFIX.length)
  const sep = rest.lastIndexOf('-')
  const username = sep > 0 ? rest.slice(0, sep) : rest
  return mockUsers.find((u) => u.username === username) || null
}

/** 去掉密码字段 */
export function publicUser(user: MockUser) {
  const { password: _password, ...rest } = user
  return rest
}
