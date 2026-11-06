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
