/**
 * Leaflet 示例公共工具
 *
 * 41 个示例里有大量重复的「建图 + 底图 + 随机数据 + Canvas 覆盖层」，
 * 收敛到这里，保证交互与配色一致，也方便统一换底图服务。
 * 注意：Leaflet 只提供经纬度坐标，涉及米制运算的（缓冲、距离）需先投影。
 */

export type BaseKind = 'osm' | 'imagery' | 'light' | 'topo' | 'dark'

export interface DemoMapOptions {
  center?: [number, number]
  zoom?: number
  base?: BaseKind | 'none'
  /** 是否加比例尺 */
  scale?: boolean
  /** 缩放范围 */
  minZoom?: number
  maxZoom?: number
}

const BASE_URLS: Record<BaseKind, { url: string; attr: string }> = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap' },
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Esri World Imagery',
  },
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Esri Light Gray',
  },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: 'Esri Topo',
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Esri Dark Gray',
  },
}

/** 常用在线底图（免 Key） */
export function createBaseLayer(L: any, kind: BaseKind = 'osm') {
  const cfg = BASE_URLS[kind] ?? BASE_URLS.osm
  return L.tileLayer(cfg.url, { maxZoom: 19, attribution: cfg.attr })
}

/** 创建带底图、比例尺的示例地图 */
export function createDemoMap(L: any, el: HTMLElement, opts: DemoMapOptions = {}) {
  const map = L.map(el, {
    zoomControl: true,
    minZoom: opts.minZoom ?? 3,
    maxZoom: opts.maxZoom ?? 18,
  }).setView(opts.center ?? [39.9042, 116.4074], opts.zoom ?? 10)
  if (opts.base !== 'none') createBaseLayer(L, (opts.base as BaseKind) ?? 'osm').addTo(map)
  if (opts.scale !== false) L.control.scale({ imperial: false }).addTo(map)
  return map
}

/** 可复现的伪随机数（同一次刷新里数据稳定，便于截图对照） */
export function seeded(seed = 20241119) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 在经纬度范围内生成随机点 */
export function randomPoints(
  count: number,
  bbox: [number, number, number, number] = [116.0, 39.6, 116.8, 40.2],
  seed?: number,
): [number, number][] {
  const rnd = seeded(seed)
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    out.push([bbox[1] + rnd() * (bbox[3] - bbox[1]), bbox[0] + rnd() * (bbox[2] - bbox[0])])
  }
  return out
}

export interface CanvasContext {
  ctx: CanvasRenderingContext2D
  map: any
  size: { x: number; y: number }
}

/**
 * 通用 Canvas 覆盖层：
 * 把「按屏幕像素绘制」的图层封装成 L.Layer，地图移动结束自动重绘。
 * 热力图、等值面、大数据渲染、WebGL 之外的场景都基于它。
 */
export function createCanvasLayer(L: any, draw: (c: CanvasContext) => void) {
  const CanvasLayer = L.Layer.extend({
    onAdd(this: any, map: any) {
      this._map = map
      const canvas = L.DomUtil.create('canvas', 'leaflet-canvas-layer')
      canvas.style.position = 'absolute'
      canvas.style.pointerEvents = 'none'
      this._canvas = canvas
      map.getPanes().overlayPane.appendChild(canvas)
      map.on('moveend zoomend resize viewreset', this._reset, this)
      this._reset()
    },
    onRemove(this: any, map: any) {
      map.off('moveend zoomend resize viewreset', this._reset, this)
      this._canvas?.remove()
    },
    _reset(this: any) {
      const map = this._map
      const size = map.getSize()
      const canvas = this._canvas
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]))
      canvas.width = size.x
      canvas.height = size.y
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, size.x, size.y)
      draw({ ctx, map, size })
    },
  })
  return new CanvasLayer()
}

/** 热力色带：0 冷 → 1 热 */
export function heatColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  const stops: [number, [number, number, number]][] = [
    [0, [30, 80, 220]],
    [0.35, [0, 200, 220]],
    [0.55, [60, 210, 120]],
    [0.75, [245, 210, 60]],
    [1, [240, 60, 60]],
  ]
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [p0, c0] = stops[i - 1]
      const [p1, c1] = stops[i]
      const k = (v - p0) / (p1 - p0 || 1)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ]
    }
  }
  return stops[stops.length - 1][1]
}

/** 在 Canvas 上绘制热力图（灰度累积后用色带着色） */
export function drawHeatmap(c: CanvasContext, points: [number, number][], opts: { radius?: number; intensity?: number } = {}) {
  const { ctx, map, size } = c
  if (!points.length) return
  const radius = opts.radius ?? 24
  const off = document.createElement('canvas')
  off.width = size.x
  off.height = size.y
  const octx = off.getContext('2d')
  if (!octx) return
  octx.globalCompositeOperation = 'lighter'
  for (const p of points) {
    const pt = map.latLngToContainerPoint(p)
    const g = octx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    octx.fillStyle = g
    octx.beginPath()
    octx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
    octx.fill()
  }
  const src = octx.getImageData(0, 0, size.x, size.y)
  const out = ctx.createImageData(size.x, size.y)
  const intensity = opts.intensity ?? 1
  for (let i = 0; i < src.data.length; i += 4) {
    const a = (src.data[i + 3] / 255) * intensity
    if (a <= 0.02) continue
    const t = Math.min(1, a)
    const [r, g, b] = heatColor(t)
    out.data[i] = r
    out.data[i + 1] = g
    out.data[i + 2] = b
    out.data[i + 3] = Math.min(255, t * 255 * 1.5)
  }
  ctx.putImageData(out, 0, 0)
}

export interface LegendItem {
  color: string
  label: string
}

/** 图例控件（专题图、等值面等需要） */
export function addLegend(L: any, map: any, title: string, items: LegendItem[]) {
  const Legend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-legend')
      div.style.cssText =
        'background:rgba(255,255,255,.92);padding:8px 10px;border-radius:6px;box-shadow:0 1px 6px rgba(0,0,0,.2);font-size:12px;line-height:1.6;color:#334155'
      const rows = items
        .map(
          (it) =>
            `<div style="display:flex;align-items:center;gap:6px">
               <i style="display:inline-block;width:14px;height:10px;border-radius:2px;background:${it.color}"></i>
               <span>${it.label}</span>
             </div>`,
        )
        .join('')
      div.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${title}</div>${rows}`
      return div
    },
  })
  const control = new Legend()
  control.addTo(map)
  return control
}

/** 经纬度 → Web 墨卡托米（缓冲、距离计算用） */
export function toMeters(map: any, latlng: [number, number]) {
  // project(latlng, 0) 得到 zoom 0 的 CRS 像素，乘以每像素米数即米制坐标
  const p = map.project(latlng, 0)
  const R = 6378137
  return [(p.x * Math.PI * 2 * R) / 256, (-p.y * Math.PI * 2 * R) / 256] as [number, number]
}

/** Web 墨卡托米 → 经纬度 */
export function fromMeters(map: any, xy: [number, number]) {
  const R = 6378137
  const x = (xy[0] * 256) / (Math.PI * 2 * R)
  const y = (-xy[1] * 256) / (Math.PI * 2 * R)
  return map.unproject([x, y], 0)
}

/** 浏览器是否支持 WebGL（WebGL 示例降级提示用） */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

/** 多边形顶点外法线缓冲（米制，斜接处理），返回 latlng 数组 */
export function bufferLatLngs(map: any, latlngs: [number, number][], meters: number) {
  const pts = latlngs.map((ll) => toMeters(map, ll))
  let signed = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    signed += a[0] * b[1] - b[0] * a[1]
  }
  const ring = signed < 0 ? pts.slice().reverse() : pts
  const n = ring.length
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]
    const cur = ring[i]
    const next = ring[(i + 1) % n]
    const norm = (p: number[], q: number[]) => {
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      const len = Math.hypot(dx, dy) || 1
      return [dy / len, -dx / len]
    }
    const n1 = norm(prev, cur)
    const n2 = norm(cur, next)
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
  return out.map((p) => {
    const ll = fromMeters(map, p)
    return [ll.lat, ll.lng] as [number, number]
  })
}

/** 射线法判断点是否在多边形内（经纬度平面近似） */
export function pointInPolygon(pt: [number, number], ring: [number, number][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]
    const [yj, xj] = ring[j]
    const hit = yi > pt[0] !== yj > pt[0] && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi || 1e-12) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** 点到线段的最近距离（米，小范围平面近似） */
export function distanceToSegment(pt: [number, number], a: [number, number], b: [number, number]) {
  const ky = 111320
  const kx = 111320 * Math.cos((pt[0] * Math.PI) / 180)
  const px = pt[1] * kx
  const py = pt[0] * ky
  const ax = a[1] * kx
  const ay = a[0] * ky
  const bx = b[1] * kx
  const by = b[0] * ky
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** 球面多边形面积（平方米） */
export function sphericalArea(ring: [number, number][]) {
  const R = 6371008.8
  const rad = Math.PI / 180
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    sum += (p2[1] - p1[1]) * rad * (2 + Math.sin(p1[0] * rad) + Math.sin(p2[0] * rad))
  }
  return Math.abs((sum * R * R) / 2)
}
