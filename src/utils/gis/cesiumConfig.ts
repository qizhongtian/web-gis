/**
 * Cesium 全局配置：令牌、默认视角、默认底图 / 地形 / 倾斜摄影地址。
 * 所有值都可以用环境变量覆盖，换项目 / 换区域时不用改组件。
 *
 * 注意：运行时的 Cesium 是从 public/cesium 动态加载的（见 cesiumLoader），
 * 这里不 import 官方 npm 包，涉及坐标计算的函数统一由调用方传入运行时命名空间。
 */

/** Ion 访问令牌（只在使用 Cesium Ion 的影像、地形、3D Tiles 时需要） */
export const ionToken = import.meta.env.VITE_CESIUM_TOKEN ?? ''

/** 默认影像底图：香港地政总署公开 XYZ 切片，无需令牌 */
export const DEFAULT_IMAGERY_URL
  = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png'

/** 默认影像最大层级 */
export const DEFAULT_IMAGERY_MAX_LEVEL = 20

/**
 * 默认地形地址（quantized-mesh / CesiumTerrainProvider）。
 * 留空时回落到 `globalTerrainUrl`，仍然有真实地形可用。
 */
export const defaultTerrainUrl = import.meta.env.VITE_CESIUM_TERRAIN_URL ?? ''

/**
 * 免密钥的全球高程服务（ArcGIS World Elevation 3D），覆盖香港区域。
 * 没有自建地形切片时用它兜底，避免地图是「平的」。
 */
export const globalTerrainUrl
  = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'

/**
 * 页面默认使用的地形服务：优先 VITE_HK_TERRAIN_URL（自建 / 反代的 quantized-mesh 地址），
 * 未配置时直接用全球高程服务（ArcGIS，免密钥、无跨域问题）。
 * 所有示例页的默认地形地址都从这里取，改一处即可全站生效。
 */
export const defaultTerrainServiceUrl = import.meta.env.VITE_HK_TERRAIN_URL || globalTerrainUrl

/**
 * 是否为 ArcGIS 高程服务地址。
 * ImageServer 只能用 ArcGISTiledElevationTerrainProvider，
 * 用 CesiumTerrainProvider 去请求 layer.json 会直接 404。
 */
export function isArcGisTerrainUrl(url: string) {
  return /arcgis\.com|ImageServer|elevation3d/i.test(url)
}

/**
 * 按地址创建地形 provider，全项目统一入口：
 * - ArcGIS ImageServer → ArcGISTiledElevationTerrainProvider
 * - 其它（quantized-mesh，带 layer.json）→ CesiumTerrainProvider
 */
export async function createTerrainProvider(Cesium: any, url: string): Promise<any> {
  const target = (url || '').trim()
  if (!target) throw new Error('请填写地形服务地址')

  if (isArcGisTerrainUrl(target) && Cesium?.ArcGISTiledElevationTerrainProvider) {
    const ArcGisProvider = Cesium.ArcGISTiledElevationTerrainProvider
    return ArcGisProvider.fromUrl ? await ArcGisProvider.fromUrl(target) : new ArcGisProvider({ url: target })
  }

  const Provider = Cesium?.CesiumTerrainProvider
  if (!Provider?.fromUrl) throw new Error('当前 Cesium 版本不支持地形服务')
  try {
    return await Provider.fromUrl(target, { requestVertexNormals: true })
  } catch {
    // 部分服务不支持法线参数，去掉后重试一次
    return await Provider.fromUrl(target)
  }
}

/**
 * 香港地政总署 3D 网格模型（倾斜摄影建筑，带真实楼体与地表起伏）。
 * 可用 `VITE_CESIUM_MESH_URL` 覆盖，或传空字符串关闭。
 */
export const defaultMeshTilesetUrl = import.meta.env.VITE_CESIUM_MESH_URL
  ?? 'https://data.map.gov.hk/api/3d-data/meshmodel/WGS84/tileset.json?key=ad5940a63bd344c48b0351ef1c7a905e'

/**
 * 默认视野中心（屏幕正中落点对应的经纬度）。
 * 改这里就能整体平移默认视角，不用再手算相机坐标。
 */
export const DEFAULT_TARGET = {
  longitude: 113.979813,
  latitude: 22.390491,
}

/** 默认相机朝向与高度（与 TC_SSSS 首页保持一致的观察角度） */
const DEFAULT_HEADING = 5.325191
const DEFAULT_PITCH = -0.620536
const DEFAULT_ROLL = 0.00000583
const DEFAULT_CAMERA_HEIGHT = 248.4
/** 球面距离换算用的地球平均半径（米），仅用于相机定位，误差可忽略 */
const EARTH_RADIUS = 6371000

/**
 * 由视野中心反推相机位置：
 * 相机沿「视线反方向」后撤「高度 / tan(俯仰角)」的水平距离，
 * 这样目标点正好落在屏幕中心，且画面比例与原来完全一致。
 */
function cameraPositionFor(Cesium: any, targetLongitude: number, targetLatitude: number) {
  const groundDistance = DEFAULT_CAMERA_HEIGHT / Math.tan(-DEFAULT_PITCH)
  const deltaLat = (groundDistance * Math.cos(DEFAULT_HEADING)) / EARTH_RADIUS
  const deltaLon
    = (groundDistance * Math.sin(DEFAULT_HEADING))
      / (EARTH_RADIUS * Math.cos(Cesium.Math.toRadians(targetLatitude)))

  return Cesium.Cartesian3.fromDegrees(
    targetLongitude - Cesium.Math.toDegrees(deltaLon),
    targetLatitude - Cesium.Math.toDegrees(deltaLat),
    DEFAULT_CAMERA_HEIGHT,
  )
}

/** 默认 3D 视角：以 DEFAULT_TARGET 为屏幕中心 */
export function getDefaultCamera(Cesium: any) {
  return {
    destination: cameraPositionFor(Cesium, DEFAULT_TARGET.longitude, DEFAULT_TARGET.latitude),
    orientation: {
      heading: DEFAULT_HEADING,
      pitch: DEFAULT_PITCH,
      roll: DEFAULT_ROLL,
    },
  }
}

/** 2D 视角：同样以 DEFAULT_TARGET 为中心 */
export function getDefaultCamera2D(Cesium: any) {
  return {
    destination: Cesium.Cartesian3.fromDegrees(
      DEFAULT_TARGET.longitude,
      DEFAULT_TARGET.latitude,
      1352.690177506268,
    ),
    orientation: {
      heading: DEFAULT_HEADING,
      pitch: DEFAULT_PITCH,
      roll: 0,
    },
  }
}

/** 设置全局令牌；没有配置时保持 cesium 默认值，避免误覆盖 */
export function applyIonToken(Cesium: any) {
  if (ionToken && Cesium?.Ion) Cesium.Ion.defaultAccessToken = ionToken
}
