/**
 * OpenLayers 示例公共工具
 *
 * 示例页只关心「业务逻辑」，底图、视图、随机点、缓冲面等重复代码收敛到这里，
 * 保证 38 个示例的交互与视觉一致，也方便后续统一替换底图服务。
 */

export type BaseKind = 'osm' | 'imagery' | 'light' | 'topo' | 'none'

export interface DemoMapOptions {
  /** 中心点（经纬度） */
  center?: [number, number]
  zoom?: number
  /** 底图类型，none 表示不加载底图 */
  base?: BaseKind
  layers?: any[]
  /** 是否使用默认控件（缩放按钮、比例尺等） */
  controls?: boolean
  minZoom?: number
  maxZoom?: number
}

/** 常用在线底图（XYZ / OSM） */
export function createBaseLayer(ol: any, kind: BaseKind = 'osm', visible = true) {
  const { TileLayer, XYZ, OSM } = ol
  if (kind === 'none') return null
  if (kind === 'imagery') {
    return new TileLayer({
      visible,
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Esri World Imagery',
        maxZoom: 19,
      }),
    })
  }
  if (kind === 'light') {
    return new TileLayer({
      visible,
      source: new XYZ({
        url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attributions: '&copy; CARTO',
        maxZoom: 19,
      }),
    })
  }
  if (kind === 'topo') {
    return new TileLayer({
      visible,
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Esri Topo',
        maxZoom: 19,
      }),
    })
  }
  return new TileLayer({ visible, source: new OSM() })
}

/** 创建带底图与默认视图的地图 */
export function createDemoMap(ol: any, el: HTMLElement, opts: DemoMapOptions = {}) {
  const base = createBaseLayer(ol, opts.base ?? 'osm')
  const layers = [...(base ? [base] : []), ...(opts.layers || [])]
  return new ol.Map({
    target: el,
    layers,
    view: new ol.View({
      center: ol.fromLonLat(opts.center ?? [116.407, 39.904]),
      zoom: opts.zoom ?? 10,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
    }),
    controls: opts.controls === false ? [] : undefined,
  })
}

/** 在经纬度范围内生成随机点要素 */
export function randomPoints(
  ol: any,
  count: number,
  bbox: [number, number, number, number] = [116.0, 39.6, 116.8, 40.2],
  props?: (i: number) => Record<string, any>,
) {
  const features: any[] = []
  for (let i = 0; i < count; i++) {
    const lon = bbox[0] + Math.random() * (bbox[2] - bbox[0])
    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1])
    features.push(
      new ol.Feature({
        geometry: new ol.Point(ol.fromLonLat([lon, lat])),
        ...(props ? props(i) : {}),
      }),
    )
  }
  return features
}

/** 生成一个用于 ImageLayer 的本地画布图片（dataURL），避免依赖外部图片 */
export function createCanvasImage(width = 900, height = 600) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, 'rgba(34,211,238,0.85)')
  grad.addColorStop(0.5, 'rgba(59,130,246,0.55)')
  grad.addColorStop(1, 'rgba(249,115,22,0.8)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  const step = 60
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText('ImageStatic 图片图层', 40, height / 2)
  ctx.font = '22px sans-serif'
  ctx.fillText('ol/source/ImageStatic · 按地理范围拉伸', 40, height / 2 + 48)
  return canvas.toDataURL('image/png')
}

/** 面积格式化：平方米 → 万平方米 / 公顷 / 平方公里 */
export function formatArea(m2: number) {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(2)} 万 m²`
  return `${m2.toFixed(0)} m²`
}

/** 长度格式化：米 → 米 / 公里 */
export function formatLength(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

function signedArea(ring: number[][]) {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

function outwardNormal(p: number[], q: number[]) {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const len = Math.hypot(dx, dy) || 1
  // 逆时针环的外法线方向为 (dy, -dx)
  return [dy / len, -dx / len]
}

/**
 * 简化版多边形缓冲：按顶点外法线 + 斜接（miter）偏移。
 * 生产环境建议使用 turf.buffer / JSTS 做严格几何运算，这里用于演示缓冲思路。
 * 注意：坐标需为投影坐标（米），半径单位为米。
 */
export function bufferPolygon(ol: any, geometry: any, meters: number) {
  const raw = geometry.getCoordinates()[0] as number[][]
  const ring = raw.slice()
  if (ring.length > 1) {
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) ring.pop()
  }
  const pts = signedArea(ring) < 0 ? ring.slice().reverse() : ring
  const n = pts.length
  const out: number[][] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    const n1 = outwardNormal(prev, cur)
    const n2 = outwardNormal(cur, next)
    let nx = n1[0] + n2[0]
    let ny = n1[1] + n2[1]
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    const cos = Math.max(nx * n1[0] + ny * n1[1], 0.35)
    const miter = Math.min(1 / cos, 2.5)
    out.push([cur[0] + nx * meters * miter, cur[1] + ny * meters * miter])
  }
  out.push(out[0])
  return new ol.Polygon([out])
}

/** 缩放地图到要素范围 */
export function fitSource(map: any, source: any, padding = 60) {
  const extent = source.getExtent()
  if (!extent || extent.some((v: number) => !Number.isFinite(v))) return
  map.getView().fit(extent, { padding: [padding, padding, padding, padding], maxZoom: 16 })
}
