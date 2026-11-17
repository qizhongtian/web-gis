import proj4 from 'proj4'

/**
 * 坐标转换工具
 * - WGS84 (EPSG:4326) <-> 香港 1980 方格网 (EPSG:2326)
 * - 同时提供常用的格式化方法，供示例页面复用
 */

export const WGS84 = 'EPSG:4326'
export const HK80 = 'EPSG:2326'

proj4.defs(
  HK80,
  '+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 ' +
    '+ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.24365,-1.15883,-1.09425 +units=m +no_defs',
)

/** 经纬度 -> HK80 东/北坐标（米） */
export function wgs84ToHk80(lon: number, lat: number): [easting: number, northing: number] {
  const [e, n] = proj4(WGS84, HK80, [lon, lat]) as [number, number]
  return [e, n]
}

/** HK80 东/北坐标（米） -> 经纬度 */
export function hk80ToWgs84(easting: number, northing: number): [lon: number, lat: number] {
  const [lon, lat] = proj4(HK80, WGS84, [easting, northing]) as [number, number]
  return [lon, lat]
}

/** 数字格式化：保留指定小数位，非法值返回 '-' */
export function formatNumber(v: number | null | undefined, digits = 6): string {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '-'
  return v.toFixed(digits)
}

/* ---------------------------- WGS84 ↔ ECEF（地心地固） ---------------------------- */

/** WGS84 椭球长半轴（米）与扁率 */
const WGS84_A = 6378137
const WGS84_F = 1 / 298.257223563
const WGS84_E2 = WGS84_F * (2 - WGS84_F)

export interface EcefPoint {
  /** 地心 X（米） */
  x: number
  /** 地心 Y（米） */
  y: number
  /** 地心 Z（米） */
  z: number
}

export interface GeodeticPoint {
  /** 经度（度） */
  lon: number
  /** 纬度（度） */
  lat: number
  /** 大地高（米） */
  height: number
}

/**
 * WGS84 大地坐标（度 / 米） -> ECEF 地心地固坐标（米）
 * 与 Cesium.Cartesian3.fromDegrees 使用同一椭球参数，误差在亚毫米级。
 */
export function geodeticToEcef(lon: number, lat: number, height = 0): EcefPoint {
  const lonRad = (lon * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  // 卯酉圈曲率半径
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)
  return {
    x: (n + height) * cosLat * Math.cos(lonRad),
    y: (n + height) * cosLat * Math.sin(lonRad),
    z: (n * (1 - WGS84_E2) + height) * sinLat,
  }
}

/**
 * ECEF 地心地固坐标（米） -> WGS84 大地坐标（度 / 米）
 * 逐次逼近法，6 次迭代可收敛到毫米级；极点（p≈0）单独处理。
 */
export function ecefToGeodetic(x: number, y: number, z: number): GeodeticPoint {
  const p = Math.hypot(x, y)
  const lon = (Math.atan2(y, x) * 180) / Math.PI

  // 极点附近 cos(lat) 趋近 0，用短半轴直接求高
  if (p < 1e-9) {
    const b = WGS84_A * (1 - WGS84_F)
    return { lon: 0, lat: z >= 0 ? 90 : -90, height: Math.abs(z) - b }
  }

  let latRad = Math.atan2(z, p * (1 - WGS84_E2))
  let height = 0
  for (let i = 0; i < 6; i++) {
    const sinLat = Math.sin(latRad)
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)
    height = p / Math.cos(latRad) - n
    latRad = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + height)))
  }

  return { lon, lat: (latRad * 180) / Math.PI, height }
}

/** 点到地心的距离（米） */
export function ecefDistanceToCenter(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z)
}


/** 经纬度格式化 */
export function formatLngLat(lon: number, lat: number, digits = 6): string {
  return `${formatNumber(lon, digits)}, ${formatNumber(lat, digits)}`
}

/** 距离格式化：< 1km 用米，否则用公里 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '-'
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`
}

/** 面积格式化：< 1km² 用平方米，否则用平方公里 */
export function formatArea(squareMeters: number): string {
  if (!Number.isFinite(squareMeters)) return '-'
  return squareMeters >= 1_000_000
    ? `${(squareMeters / 1_000_000).toFixed(3)} km²`
    : `${squareMeters.toFixed(1)} m²`
}
