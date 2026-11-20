/**
 * MapLibre GL JS / Mapbox GL JS 示例公共工具
 *
 * 两个库同源，Map API 基本一致，所以「建图、免 Key 底图、随机数据、自定义
 * WebGL 图层」这些逻辑收敛在这里，页面里只保留各自引擎特有的配置差异。
 * 底图统一走 Esri / OSM 栅格瓦片，避免 Mapbox 必须配置 accessToken 的问题。
 */

export type GlEngine = 'maplibre' | 'mapbox'
export type GlBase = 'imagery' | 'light' | 'dark' | 'topo' | 'osm'

export interface DemoMapOptions {
  base?: GlBase
  /** 直接指定样式（URL 或 JSON） */
  style?: any
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  maxPitch?: number
  interactive?: boolean
  /** 是否显示导航控件 */
  nav?: boolean
}

const TILES: Record<GlBase, { tiles: string[]; attr: string; bg: string }> = {
  imagery: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attr: '&copy; Esri World Imagery',
    bg: '#0b1220',
  },
  light: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    attr: '&copy; Esri Light Gray',
    bg: '#f7f8fa',
  },
  dark: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    attr: '&copy; Esri Dark Gray',
    bg: '#0b1220',
  },
  topo: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attr: '&copy; Esri Topo',
    bg: '#f7f8fa',
  },
  osm: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attr: '&copy; OpenStreetMap',
    bg: '#f7f8fa',
  },
}

/** 免 Key 栅格样式（MapLibre / Mapbox 通用） */
export function rasterStyle(base: GlBase = 'light') {
  const cfg = TILES[base] ?? TILES.light
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: cfg.tiles, tileSize: 256, maxzoom: 19, attribution: cfg.attr },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': cfg.bg } },
      { id: 'base', type: 'raster', source: 'base' },
    ],
  }
}

/** MapLibre 官方免 Key 矢量样式；Mapbox 仍需栅格样式（mapbox:// 需 accessToken） */
export function demoStyle(engine: GlEngine, base: GlBase = 'light') {
  return engine === 'maplibre' ? 'https://demotiles.maplibre.org/style.json' : rasterStyle(base)
}

/** 创建示例地图（自动挂载导航、比例尺控件） */
export function createMap(lib: any, el: HTMLElement, opts: DemoMapOptions = {}) {
  // maplibre-gl.css 会给容器加 .maplibregl-map { position: relative }，
  // 会覆盖掉 Tailwind 的 absolute inset-0 导致容器高度塌陷，这里用内联样式钉住
  el.style.position = 'absolute'
  el.style.inset = '0'
  el.style.width = '100%'
  el.style.height = '100%'

  const map = new lib.Map({
    container: el,
    style: opts.style ?? rasterStyle(opts.base ?? 'light'),
    center: opts.center ?? [116.4074, 39.9042],
    zoom: opts.zoom ?? 10,
    pitch: opts.pitch ?? 0,
    bearing: opts.bearing ?? 0,
    maxPitch: opts.maxPitch ?? 70,
    interactive: opts.interactive !== false,
    attributionControl: true,
  })
  // Mapbox GL JS 首帧渲染完会向官方接口校验 accessToken，没有 token 时校验失败
  // 会清空绘制缓冲（表现为整块黑屏）并抛错。示例全部使用免 Key 栅格瓦片，
  // 直接跳过这次鉴权，既没有黑屏也没有控制台告警。
  if (typeof lib.setWorkerUrl !== 'function' && typeof map._authenticate === 'function') {
    map._authenticate = () => {}
  }

  if (opts.nav !== false) {
    map.addControl(new lib.NavigationControl({ visualizePitch: true }), 'top-left')
  }
  map.addControl(new lib.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left')

  // 侧边栏折叠 / 窗口缩放时保持画布尺寸同步
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    map.once('remove', () => ro.disconnect())
  }
  return map
}

/** 等待地图样式就绪（load / idle 事件可能已错过，用轮询 + 超时兜底） */
export function waitReady(map: any, timeout = 15000): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    let timer: any = 0
    let poll: any = 0
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearInterval(poll)
      resolve()
    }
    map.once('load', finish)
    map.once('idle', finish)
    map.once('remove', finish)
    // 样式解析完就能 addSource / addLayer，不必等所有瓦片渲染出来
    poll = setInterval(() => {
      if (done) return
      try {
        if (map.isStyleLoaded?.()) finish()
      } catch {
        /* 地图已销毁 */
      }
    }, 120)
    timer = setTimeout(finish, timeout)
  })
}

/** 可复现的伪随机数，保证每次刷新数据一致，便于截图对照 */
export function seeded(seed = 20241120) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** [west, south, east, north] */
export type BBox = [number, number, number, number]

export function bboxOf(center: [number, number], dLng = 0.12, dLat = 0.08): BBox {
  return [center[0] - dLng, center[1] - dLat, center[0] + dLng, center[1] + dLat]
}

/** 范围内均匀随机点 */
export function randomPoints(n: number, bbox: BBox = bboxOf([116.4074, 39.9042]), seed = 1) {
  const rnd = seeded(seed)
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    out.push([bbox[0] + rnd() * (bbox[2] - bbox[0]), bbox[1] + rnd() * (bbox[3] - bbox[1])])
  }
  return out
}

/** 高斯分布聚簇点（热力图、聚合示例用，比均匀分布更像真实业务数据） */
export function clusterPoints(
  n: number,
  center: [number, number] = [116.4074, 39.9042],
  radius = 0.1,
  seed = 3,
) {
  const rnd = seeded(seed)
  const centers = [
    center,
    [center[0] + radius * 0.6, center[1] + radius * 0.4] as [number, number],
    [center[0] - radius * 0.5, center[1] - radius * 0.35] as [number, number],
  ]
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const c = centers[i % centers.length]
    // Box-Muller 近似正态，再压缩到半径内
    const r = Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * radius * 0.35
    const a = rnd() * Math.PI * 2
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r])
  }
  return out
}

export function pointsFC(coords: [number, number][], props?: (i: number) => Record<string, any>) {
  return {
    type: 'FeatureCollection' as const,
    features: coords.map((c, i) => ({
      type: 'Feature' as const,
      properties: props ? props(i) : {},
      geometry: { type: 'Point' as const, coordinates: c },
    })),
  }
}

export function lineFC(coords: [number, number][], props: Record<string, any> = {}) {
  return {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: props, geometry: { type: 'LineString' as const, coordinates: coords } }],
  }
}

export function polygonFC(ring: [number, number][], props: Record<string, any> = {}) {
  const closed = [...ring, ring[0]]
  return {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: props, geometry: { type: 'Polygon' as const, coordinates: [closed] } }],
  }
}

/** 经纬度圆环（缓冲区、电子围栏示意） */
export function circleRing(center: [number, number], radiusKm: number, steps = 64): [number, number][] {
  const [lng, lat] = center
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat])
  }
  return ring
}

/** 生成一片带高度的建筑面（3D 建筑示例） */
export function buildingsFC(opts: { center?: [number, number]; cols?: number; rows?: number; seed?: number } = {}) {
  const { center = [116.4074, 39.9042], cols = 10, rows = 8, seed = 9 } = opts
  const rnd = seeded(seed)
  const step = 0.0034
  const gap = 0.0008
  const w = center[0] - (cols * step) / 2
  const h = center[1] - (rows * step) / 2
  const features: any[] = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = w + i * step
      const y = h + j * step
      const iw = step - gap
      const ih = step - gap
      const height = 10 + Math.floor(rnd() * 9) * 14
      features.push({
        type: 'Feature',
        properties: { height, base: 0 },
        geometry: {
          type: 'Polygon',
          coordinates: [[[x, y], [x + iw, y], [x + iw, y + ih], [x, y + ih], [x, y]]],
        },
      })
    }
  }
  return { type: 'FeatureCollection' as const, features }
}

/** 按高度映射颜色（3D 建筑、专题着色共用） */
export function heightColor(height: number, max = 120) {
  const t = Math.min(1, height / max)
  const from = [56, 189, 248]
  const to = [244, 114, 182]
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/**
 * 自定义 WebGL 图层：把点云画成圆点，按权重渐变着色。
 * MapLibre 与 Mapbox 的 CustomLayerInterface 一致，因此两边共用一份实现。
 */
export function createGlowLayer(lib: any, coords: [number, number][], id = 'glow-points') {
  const positions = new Float32Array(coords.length * 3)
  coords.forEach(([lng, lat], i) => {
    const c = lib.MercatorCoordinate.fromLngLat([lng, lat])
    positions[i * 3] = c.x
    positions[i * 3 + 1] = c.y
    // 第三位当权重用：让颜色与点大小有层次
    positions[i * 3 + 2] = (i % 23) / 22
  })

  const VERT = `
  uniform mat4 u_matrix;
  uniform float u_ratio;
  attribute vec2 a_pos;
  attribute float a_w;
  varying float v_w;
  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    gl_PointSize = mix(2.5, 8.0, a_w) * u_ratio;
    v_w = a_w;
  }`

  const FRAG = `
  precision mediump float;
  varying float v_w;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
    vec3 c = mix(vec3(0.16, 0.78, 0.95), vec3(0.99, 0.45, 0.32), v_w);
    gl_FragColor = vec4(c, 0.92);
  }`

  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let uMatrix: WebGLUniformLocation | null = null
  let uRatio: WebGLUniformLocation | null = null
  let aPos = -1
  let aW = -1

  const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    return shader
  }

  return {
    id,
    type: 'custom',
    renderingMode: '2d',
    onAdd(_map: any, gl: WebGLRenderingContext) {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(program)
      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
      uMatrix = gl.getUniformLocation(program, 'u_matrix')
      uRatio = gl.getUniformLocation(program, 'u_ratio')
      aPos = gl.getAttribLocation(program, 'a_pos')
      aW = gl.getAttribLocation(program, 'a_w')
    },
    render(gl: WebGLRenderingContext, arg: any) {
      if (!program || !buffer) return
      // MapLibre 5+ 传入的是对象，旧版本与 Mapbox 直接给矩阵
      const matrix = arg?.defaultProjectionData?.mainMatrix ?? arg
      gl.useProgram(program)
      gl.uniformMatrix4fv(uMatrix, false, matrix)
      gl.uniform1f(uRatio, Math.min(window.devicePixelRatio || 1, 2))
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0)
      gl.enableVertexAttribArray(aW)
      gl.vertexAttribPointer(aW, 1, gl.FLOAT, false, 12, 8)
      gl.drawArrays(gl.POINTS, 0, coords.length)
    },
  }
}
