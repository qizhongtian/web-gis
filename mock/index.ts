import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/**
 * 轻量 Mock 服务（Vite Dev 中间件，无额外依赖）
 * 生产环境可无缝切换为真实后端（配置 server.proxy 即可）
 */

interface MockUser {
  id: number
  username: string
  password: string
  nickname: string
  roles: string[]
  permissions: string[]
}

const db = {
  users: [
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
  ] as MockUser[],
  roles: [
    { id: 1, key: 'admin', name: '管理员', remark: '拥有全部权限' },
    { id: 2, key: 'viewer', name: '演示用户', remark: '仅可查看示例' },
  ],
  menus: [
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
        ]),
        group(22, 'Geojson', 'Geojson', 'menus.cesiumGeojson', 'DataLine', '/cesium/geojson', [
          leaf(2201, 'GeoJSON加载', 'Load GeoJSON', 'menus.cesiumGeojsonLoad', '/cesium/geojson/load', 'cesium/geojson/load/index.vue'),
        ]),
        group(23, '工具', 'Tools', 'menus.cesiumTool', 'Tools', '/cesium/tool', [
          leaf(2301, '空间量算', 'Measure', 'menus.cesiumMeasure', '/cesium/tool/measure', 'cesium/tool/measure/index.vue'),
          leaf(2302, '坐标拾取', 'Pick Position', 'menus.cesiumPick', '/cesium/tool/pick', 'cesium/tool/pick/index.vue'),
          leaf(2303, '场景导航', 'Navigation', 'menus.cesiumNavigation', '/cesium/tool/navigation', 'cesium/tool/navigation/index.vue'),
          leaf(2304, '交互绘制', 'Draw', 'menus.cesiumDraw', '/cesium/tool/draw', 'cesium/tool/draw/index.vue'),
          leaf(2305, '天气特效', 'Weather', 'menus.cesiumWeather', '/cesium/tool/weather', 'cesium/tool/weather/index.vue'),
          leaf(2306, '矢量上传', 'Vector Upload', 'menus.cesiumVector', '/cesium/tool/vector', 'cesium/tool/vector/index.vue'),
          leaf(2307, '高程提取', 'Surface Elevation', 'menus.cesiumElevation', '/cesium/tool/elevation', 'cesium/tool/elevation/index.vue'),
        ]),
        group(24, '图层', 'Layers', 'menus.cesiumLayer', 'Menu', '/cesium/layer', [
          leaf(2401, '影像图层切换', 'Imagery Switch', 'menus.cesiumImagery', '/cesium/layer/imagery', 'cesium/layer/imagery/index.vue'),
          leaf(2402, '地形与高程', 'Terrain & Elevation', 'menus.cesiumTerrain', '/cesium/layer/terrain', 'cesium/layer/terrain/index.vue'),
          leaf(2403, 'GeoServer 服务', 'GeoServer', 'menus.cesiumGeoServer', '/cesium/layer/geoserver', 'cesium/layer/geoserver/index.vue'),
        ]),
        group(25, '3D Tiles', '3D Tiles', 'menus.cesiumTiles', 'Box', '/cesium/tiles', [
          leaf(2501, 'OSM建筑', 'OSM Buildings', 'menus.cesiumOsm', '/cesium/tiles/osm', 'cesium/tiles/osm/index.vue'),
          leaf(2502, '加载与拾取', 'Load & Pick', 'menus.cesiumTilesLoad', '/cesium/tiles/3dtiles', 'cesium/tiles/3dtiles/index.vue'),
        ]),
        group(213, '模型', 'Model', 'menus.cesiumModelGroup', 'Coordinate', '/cesium/model', [
          leaf(2130, 'glTF / GLB', 'glTF / GLB', 'menus.cesiumModel', '/cesium/model/gltf', 'cesium/model/gltf/index.vue'),
        ]),
        group(27, '飞入', 'Fly To', 'menus.cesiumFly', 'Promotion', '/cesium/fly', [
          leaf(2701, '城市漫游', 'City Roaming', 'menus.cesiumFlyTo', '/cesium/fly/city', 'cesium/fly/city/index.vue'),
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
        group(31, '基础', 'Basic', 'menus.olBasic', 'SetUp', '/openlayer/basic', [
          leaf(3101, '地图初始化', 'Init Map', 'menus.olMap', '/openlayer/basic/map', 'openlayer/basic/map/index.vue'),
        ]),
        group(32, '图层', 'Layers', 'menus.olLayer', 'Menu', '/openlayer/layer', [
          leaf(3201, '矢量要素', 'Vector Layer', 'menus.olVector', '/openlayer/layer/vector', 'openlayer/layer/vector/index.vue'),
        ]),
        group(33, '工具', 'Tools', 'menus.olTool', 'Tools', '/openlayer/tool', [
          leaf(3301, '绘制图形', 'Draw', 'menus.olDraw', '/openlayer/tool/draw', 'openlayer/tool/draw/index.vue'),
          leaf(3302, '距离量算', 'Measure', 'menus.olMeasure', '/openlayer/tool/measure', 'openlayer/tool/measure/index.vue'),
        ]),
        group(34, '交互', 'Interaction', 'menus.olInteraction', 'Pointer', '/openlayer/interaction', [
          leaf(3401, '要素选择', 'Select', 'menus.olSelect', '/openlayer/interaction/select', 'openlayer/interaction/select/index.vue'),
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
          leaf(4101, '旋转立方体', 'Rotating Cube', 'menus.threeCube', '/three/basic/cube', 'three/basic/cube/index.vue'),
        ]),
        group(42, '几何体', 'Geometry', 'menus.threeGeometry', 'Box', '/three/geometry', [
          leaf(4201, '基础几何体', 'Shapes', 'menus.threeShapes', '/three/geometry/shapes', 'three/geometry/shapes/index.vue'),
        ]),
        group(43, '材质', 'Material', 'menus.threeMaterial', 'PictureFilled', '/three/material', [
          leaf(4301, '材质展示', 'Materials', 'menus.threeMats', '/three/material/mats', 'three/material/mats/index.vue'),
        ]),
        group(44, '动画', 'Animation', 'menus.threeAnimation', 'VideoPlay', '/three/animation', [
          leaf(4401, '粒子动画', 'Particles', 'menus.threeParticles', '/three/animation/particles', 'three/animation/particles/index.vue'),
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
        ]),
        group(62, '图层', 'Layers', 'menus.leafletLayer', 'Menu', '/leaflet/layer', [
          leaf(6201, '矢量要素', 'Vector Layer', 'menus.leafletVector', '/leaflet/layer/vector', 'leaflet/layer/vector/index.vue'),
        ]),
        group(63, '工具', 'Tools', 'menus.leafletTool', 'Tools', '/leaflet/tool', [
          leaf(6301, '绘制与量算', 'Draw & Measure', 'menus.leafletDraw', '/leaflet/tool/draw', 'leaflet/tool/draw/index.vue'),
        ]),
        group(64, '交互', 'Interaction', 'menus.leafletInteraction', 'Pointer', '/leaflet/interaction', [
          leaf(6401, '点击弹窗', 'Popup', 'menus.leafletPopup', '/leaflet/interaction/popup', 'leaflet/interaction/popup/index.vue'),
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
  ],
}

function group(id: number, label: string, labelEn: string, key: string, icon: string, path: string, children: any[]) {
  return { id, label, labelEn, key, icon, path, component: '', roles: ['admin', 'viewer'], children }
}
function leaf(id: number, label: string, labelEn: string, key: string, path: string, component: string) {
  return { id, label, labelEn, key, icon: '', path, component, roles: ['admin', 'viewer'], children: [] }
}

// ---------- helpers ----------
const tokens = new Map<string, MockUser>()

function json(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}
const ok = (res: ServerResponse, data: any = null) => json(res, { code: 0, message: 'ok', data })
const fail = (res: ServerResponse, message: string, status = 400) => json(res, { code: 1, message, data: null }, status)

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function currentUser(req: IncomingMessage): MockUser | null {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  return tokens.get(token) || null
}

function filterMenus(node: any, roles: string[]): any {
  if (!node.roles?.some((r: string) => roles.includes(r))) return null
  const children = (node.children || []).map((c: any) => filterMenus(c, roles)).filter(Boolean)
  return { ...node, children }
}

// ---------- plugin ----------
export default function mockServerPlugin(): Plugin {
  return {
    name: 'web-gis-mock-server',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        void handle(req as IncomingMessage, res as ServerResponse)
      })
    },
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = (req.url || '').split('?')[0]
  const method = (req.method || 'GET').toUpperCase()

  // 登录
  if (method === 'POST' && url === '/login') {
    const { username, password } = await readBody(req)
    const user = db.users.find((u) => u.username === username && u.password === password)
    if (!user) return fail(res, '用户名或密码错误')
    const token = `mock-token-${user.username}-${Date.now()}`
    tokens.set(token, user)
    return ok(res, { token })
  }

  // 以下接口需要鉴权
  const user = currentUser(req)
  if (!user) return fail(res, '未登录或登录已过期', 401)

  if (url === '/user/info') {
    const { password: _p, ...info } = user
    return ok(res, info)
  }

  if (url === '/menus') {
    return ok(res, db.menus.map((m) => filterMenus(m, user.roles)).filter(Boolean))
  }

  if (url === '/users' && method === 'GET') {
    return ok(res, db.users.map(({ password: _p, ...rest }) => rest))
  }
  if (url === '/users' && method === 'POST') {
    const body = await readBody(req)
    if (db.users.some((u) => u.username === body.username)) return fail(res, '用户名已存在')
    const id = Math.max(...db.users.map((u) => u.id)) + 1
    db.users.push({ id, username: body.username, password: body.password || '123456', nickname: body.nickname || body.username, roles: body.roles || ['viewer'], permissions: [] })
    return ok(res)
  }
  if (url.startsWith('/users/') && method === 'DELETE') {
    const id = Number(url.split('/')[2])
    db.users = db.users.filter((u) => u.id !== id)
    return ok(res)
  }

  if (url === '/roles' && method === 'GET') return ok(res, db.roles)
  if (url === '/roles' && method === 'POST') {
    const body = await readBody(req)
    db.roles.push({ id: db.roles.length + 1, key: body.key, name: body.name, remark: body.remark || '' })
    return ok(res)
  }

  if (url === '/logout') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    tokens.delete(token)
    return ok(res)
  }

  fail(res, '接口不存在: ' + url, 404)
}
