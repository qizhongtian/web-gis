/** 点表解析：GeoJSON / Excel(CSV) 行 -> 经纬度点集 */

export interface TablePoint {
  id: string
  lon: number
  lat: number
}

const LON_KEYS = ['longitude', 'lon', 'lng', 'x', '经度']
const LAT_KEYS = ['latitude', 'lat', 'y', '纬度']
const ID_KEYS = ['id', 'fid', '编号', '名称', 'name']

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function findIndex(row: string[], keys: string[]): number {
  return row.findIndex((cell) => keys.includes(normalize(cell)))
}

function toPoint(id: string, lon: string | number, lat: string | number): TablePoint | null {
  const x = Number(lon)
  const y = Number(lat)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x < -180 || x > 180 || y < -90 || y > 90) return null
  return { id: id.trim() || '—', lon: x, lat: y }
}

/** 表格行转点集：优先识别表头（ID / Longitude / Latitude，兼容中文），否则按 序号,经度,纬度 解析 */
export function rowsToPoints(rows: string[][]): TablePoint[] {
  if (!rows.length) return []

  let headerRow = -1
  let idIndex = 0
  let lonIndex = 1
  let latIndex = 2
  const scanLimit = Math.min(rows.length, 5)
  for (let i = 0; i < scanLimit; i++) {
    const lon = findIndex(rows[i], LON_KEYS)
    const lat = findIndex(rows[i], LAT_KEYS)
    if (lon >= 0 && lat >= 0) {
      headerRow = i
      lonIndex = lon
      latIndex = lat
      idIndex = findIndex(rows[i], ID_KEYS)
      break
    }
  }

  const points: TablePoint[] = []
  const start = headerRow >= 0 ? headerRow + 1 : 0
  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    if (!row.length) continue
    const lon = row[lonIndex]
    const lat = row[latIndex]
    if (lon === undefined || lat === undefined) continue
    if (lon.trim() === '' || lat.trim() === '') continue
    const rawId = idIndex >= 0 ? row[idIndex] : ''
    const point = toPoint(rawId || String(points.length + 1), lon, lat)
    if (point) points.push(point)
  }
  return points
}

/** GeoJSON 点集解析：支持 FeatureCollection / Feature / Point 数组 */
export function parseGeoJsonPoints(json: any): TablePoint[] {
  const features: any[] = Array.isArray(json)
    ? json
    : json?.type === 'FeatureCollection'
      ? json.features ?? []
      : [json]

  const points: TablePoint[] = []
  const push = (id: unknown, lon: unknown, lat: unknown) => {
    const point = toPoint(String(id ?? points.length + 1), lon as number, lat as number)
    if (point) points.push(point)
  }

  for (const feature of features) {
    if (!feature) continue
    const props = feature.properties ?? {}
    const id = props.ID ?? props.id ?? props.Name ?? props.name ?? props['编号'] ?? points.length + 1
    if (feature.type === 'Feature' || feature.geometry) {
      const geometry = feature.geometry
      if (!geometry) continue
      if (geometry.type === 'Point') push(id, geometry.coordinates?.[0], geometry.coordinates?.[1])
      else if (geometry.type === 'MultiPoint') {
        ;(geometry.coordinates ?? []).forEach((coord: any, i: number) =>
          push(`${id}-${i + 1}`, coord?.[0], coord?.[1]),
        )
      }
      continue
    }
    // 也兼容 [{ id, lon, lat }] 这类简洁写法
    if (feature.type === 'Point') push(id, feature.coordinates?.[0], feature.coordinates?.[1])
    else if (feature.lon !== undefined || feature.lng !== undefined) {
      push(feature.id ?? points.length + 1, feature.lon ?? feature.lng, feature.lat)
    }
  }
  return points
}
