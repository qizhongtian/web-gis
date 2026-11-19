/**
 * 数据探查：纯函数解析 GeoJSON / 3D Tiles(tileset.json) / glTF(GLB)
 *
 * 只做结构与属性统计，不依赖 Cesium，方便在任意环境复用：
 * - GeoJSON：要素数、几何类型、字段、经纬度范围、坐标点数量
 * - 3D Tiles：资产版本、瓦片/内容数量、层级、包围盒、元数据字段
 * - glTF / GLB：节点、网格、材质、动画、访问器，以及 GLB 容器解析
 */

export type AssetKind = 'geojson' | 'tileset' | 'model'

export interface InspectProperty {
  name: string
  value: string
}

export interface InspectMetric {
  /** 对应 i18n inspect.metric.<key> */
  key: string
  value: string
}

export interface InspectResult {
  kind: AssetKind
  name: string
  /** 文件字节数，URL 未知时为 0 */
  size: number
  /** 「结构」标签页展示的 JSON（大文件由视图层截断） */
  raw: unknown
  /** 字段 / 节点名 */
  keys: string[]
  /** 首条要素属性或节点示例 */
  sample: InspectProperty[]
  metrics: InspectMetric[]
  /** 附加说明，如 GLB 版本 */
  note: string
}

export interface GlbParseResult {
  json: any
  version: number
  binLength: number
}

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

const MAX_KEYS = 120
const MAX_SAMPLE = 40

export function formatBytes(size: number): string {
  if (!size || size < 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export function toDisplayValue(value: any): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const text = JSON.stringify(value)
    return text.length > 240 ? `${text.slice(0, 240)}…` : text
  } catch {
    return String(value)
  }
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)))
}

/** 识别数据类型：先看扩展名，再看 JSON 特征 */
export function detectAssetKind(name: string, json: any): AssetKind | null {
  const lower = (name || '').toLowerCase().split(/[?#]/)[0]
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return 'model'
  if (lower.endsWith('.geojson')) return 'geojson'

  if (!json || typeof json !== 'object') return null
  if (json.type === 'FeatureCollection' || json.type === 'Feature') return 'geojson'
  if (typeof json.type === 'string' && GEOMETRY_TYPES.has(json.type)) return 'geojson'
  if (json.root && (json.asset || json.geometricError !== undefined)) return 'tileset'
  if (json.asset) return 'model'
  return null
}

/* ------------------------------- GeoJSON ------------------------------- */

function normalizeFeatures(json: any): any[] {
  if (!json || typeof json !== 'object') return []
  if (json.type === 'FeatureCollection') return Array.isArray(json.features) ? json.features : []
  if (json.type === 'Feature') return [json]
  if (typeof json.type === 'string' && GEOMETRY_TYPES.has(json.type)) {
    return [{ type: 'Feature', geometry: json, properties: {} }]
  }
  return []
}

function visitCoordinates(coords: any, update: (lon: number, lat: number) => void, counter: { n: number }) {
  if (!Array.isArray(coords) || counter.n > 2_000_000) return
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    update(coords[0], coords[1])
    counter.n += 1
    return
  }
  for (const item of coords) visitCoordinates(item, update, counter)
}

export function inspectGeoJson(json: any): InspectResult {
  const features = normalizeFeatures(json)
  const typeCount = new Map<string, number>()
  const keys: string[] = []
  let sample: InspectProperty[] = []

  const bbox = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity }
  const counter = { n: 0 }
  const update = (lon: number, lat: number) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
    bbox.minLon = Math.min(bbox.minLon, lon)
    bbox.minLat = Math.min(bbox.minLat, lat)
    bbox.maxLon = Math.max(bbox.maxLon, lon)
    bbox.maxLat = Math.max(bbox.maxLat, lat)
  }

  for (const feature of features) {
    const type = feature?.geometry?.type || 'Unknown'
    typeCount.set(type, (typeCount.get(type) || 0) + 1)
    const props = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {}
    keys.push(...Object.keys(props))
    if (!sample.length && Object.keys(props).length) {
      sample = Object.entries(props)
        .slice(0, MAX_SAMPLE)
        .map(([name, value]) => ({ name, value: toDisplayValue(value) }))
    }
    visitCoordinates(feature?.geometry?.coordinates, update, counter)
    if (Array.isArray(feature?.geometry?.geometries)) {
      for (const geometry of feature.geometry.geometries) visitCoordinates(geometry?.coordinates, update, counter)
    }
  }

  const geometryText =
    Array.from(typeCount.entries())
      .map(([type, count]) => `${type}×${count}`)
      .join(' / ') || '—'
  const bboxText =
    counter.n && Number.isFinite(bbox.minLon)
      ? `${bbox.minLon.toFixed(4)}, ${bbox.minLat.toFixed(4)} → ${bbox.maxLon.toFixed(4)}, ${bbox.maxLat.toFixed(4)}`
      : '—'
  const fields = uniq(keys)

  return {
    kind: 'geojson',
    name: '',
    size: 0,
    raw: json,
    keys: fields.slice(0, MAX_KEYS),
    sample,
    metrics: [
      { key: 'features', value: String(features.length) },
      { key: 'geometry', value: geometryText },
      { key: 'fields', value: String(fields.length) },
      { key: 'coordinates', value: String(counter.n) },
      { key: 'bbox', value: bboxText },
    ],
    note: '',
  }
}

/* ------------------------------- 3D Tiles ------------------------------- */

interface TilesetTreeStats {
  tiles: number
  contents: number
  depth: number
}

function collectTilesetStats(root: any): TilesetTreeStats {
  const stats: TilesetTreeStats = { tiles: 0, contents: 0, depth: 0 }
  const stack: Array<{ node: any; depth: number }> = root ? [{ node: root, depth: 1 }] : []
  while (stack.length) {
    const { node, depth } = stack.pop()!
    if (!node || typeof node !== 'object') continue
    stats.tiles += 1
    stats.depth = Math.max(stats.depth, depth)
    if (node.content?.uri || node.content?.url) stats.contents += 1
    else if (Array.isArray(node.contents)) stats.contents += node.contents.length
    if (stats.tiles > 100_000) break
    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push({ node: child, depth: depth + 1 })
    }
  }
  return stats
}

export function inspectTileset(json: any): InspectResult {
  const stats = collectTilesetStats(json?.root)
  const legacyProps = json?.properties && typeof json.properties === 'object' ? Object.keys(json.properties) : []
  const schemaProps =
    json?.schema?.properties && typeof json.schema.properties === 'object'
      ? Object.keys(json.schema.properties)
      : []
  const metadataClass = json?.schema?.id || json?.schema?.name || ''
  const fields = uniq([...legacyProps, ...schemaProps])
  const extensions = Array.isArray(json?.extensionsUsed) ? json.extensionsUsed : []

  const sample: InspectProperty[] = []
  if (json?.properties && typeof json.properties === 'object') {
    for (const [name, value] of Object.entries(json.properties).slice(0, MAX_SAMPLE)) {
      sample.push({ name, value: toDisplayValue(value) })
    }
  } else if (fields.length) {
    for (const name of fields.slice(0, MAX_SAMPLE)) {
      sample.push({ name, value: metadataClass ? `class: ${metadataClass}` : 'metadata（无具体值）' })
    }
  }

  const metrics: InspectMetric[] = [
    { key: 'tiles', value: String(stats.tiles) },
    { key: 'contents', value: String(stats.contents) },
    { key: 'depth', value: String(stats.depth) },
    { key: 'version', value: String(json?.asset?.version ?? '—') },
    { key: 'geometricError', value: String(json?.geometricError ?? '—') },
    { key: 'fields', value: String(fields.length) },
  ]
  if (json?.asset?.generator) metrics.push({ key: 'generator', value: String(json.asset.generator) })
  if (extensions.length) metrics.push({ key: 'extensions', value: extensions.join(', ') })

  const note = json?.asset?.tilesetVersion ? `tilesetVersion: ${json.asset.tilesetVersion}` : ''

  return {
    kind: 'tileset',
    name: '',
    size: 0,
    raw: json,
    keys: fields.slice(0, MAX_KEYS),
    sample,
    metrics,
    note,
  }
}

/* -------------------------------- glTF -------------------------------- */

export function parseGlb(buffer: ArrayBuffer): GlbParseResult | null {
  if (!buffer || buffer.byteLength < 20) return null
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67) return null // 'glTF'
  const version = view.getUint32(4, true)
  let offset = 12
  let json: any = null
  let binLength = 0
  const decoder = new TextDecoder('utf-8')

  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    offset += 8
    if (offset + length > buffer.byteLength) break
    if (type === 0x4e4f534a) {
      // JSON chunk
      try {
        const text = decoder.decode(new Uint8Array(buffer, offset, length)).replace(/\u0000+$/g, '').trim()
        json = JSON.parse(text)
      } catch {
        return null
      }
    } else if (type === 0x004e4942) {
      // BIN chunk
      binLength += length
    }
    offset += length
  }

  return json ? { json, version, binLength } : null
}

export function inspectGltf(json: any, glbVersion = 0, binLength = 0): InspectResult {
  const nodes: any[] = Array.isArray(json?.nodes) ? json.nodes : []
  const meshes: any[] = Array.isArray(json?.meshes) ? json.meshes : []
  const materials: any[] = Array.isArray(json?.materials) ? json.materials : []
  const textures: any[] = Array.isArray(json?.textures) ? json.textures : []
  const animations: any[] = Array.isArray(json?.animations) ? json.animations : []
  const accessors: any[] = Array.isArray(json?.accessors) ? json.accessors : []
  const extensions = Array.isArray(json?.extensionsUsed) ? json.extensionsUsed : []

  const keys = nodes.map((node, index) => node?.name || `node ${index}`)
  const sample: InspectProperty[] = nodes.slice(0, MAX_SAMPLE).map((node, index) => ({
    name: node?.name || `node ${index}`,
    value: node?.mesh !== undefined ? `mesh ${node.mesh}` : node?.children?.length ? `${node.children.length} children` : '—',
  }))

  const summary = {
    asset: json?.asset,
    scene: json?.scene,
    scenes: json?.scenes,
    counts: {
      nodes: nodes.length,
      meshes: meshes.length,
      materials: materials.length,
      textures: textures.length,
      animations: animations.length,
      accessors: accessors.length,
    },
    nodes: nodes.map((node, index) => ({
      index,
      name: node?.name,
      mesh: node?.mesh,
      children: node?.children,
      translation: node?.translation,
      rotation: node?.rotation,
      scale: node?.scale,
    })),
    meshes: meshes.map((mesh) => ({
      name: mesh?.name,
      primitives: Array.isArray(mesh?.primitives) ? mesh.primitives.length : 0,
    })),
    materials: materials.map((material) => ({ name: material?.name })),
    animations: animations.map((animation) => ({ name: animation?.name })),
    extensionsUsed: extensions,
  }

  const metrics: InspectMetric[] = [
    { key: 'version', value: String(json?.asset?.version ?? '—') },
    { key: 'nodes', value: String(nodes.length) },
    { key: 'meshes', value: String(meshes.length) },
    { key: 'materials', value: String(materials.length) },
    { key: 'textures', value: String(textures.length) },
    { key: 'animations', value: String(animations.length) },
    { key: 'accessors', value: String(accessors.length) },
  ]
  if (json?.asset?.generator) metrics.push({ key: 'generator', value: String(json.asset.generator) })
  if (extensions.length) metrics.push({ key: 'extensions', value: extensions.join(', ') })

  const note = glbVersion
    ? `GLB ${glbVersion}${binLength ? ` · BIN ${formatBytes(binLength)}` : ''}`
    : 'glTF JSON'

  return {
    kind: 'model',
    name: '',
    size: 0,
    raw: summary,
    keys: keys.slice(0, MAX_KEYS),
    sample,
    metrics,
    note,
  }
}

/* ------------------------------ 代码片段 ------------------------------ */

const GEOJSON_USAGE = `// A. 读取 GeoJSON 属性（纯前端，不依赖 Cesium）
const json = await fetch(url).then((r) => r.json())
const features = json.features ?? []
const fields = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))]
console.log(features[0].properties, features[0].geometry.coordinates)

// B. 加载到 Cesium 并访问实体数据
const ds = await Cesium.GeoJsonDataSource.load(json, { clampToGround: true })
viewer.dataSources.add(ds)

const entity = ds.entities.values[0]
const names = entity.properties.propertyNames
const value = entity.properties[names[0]].getValue(Cesium.JulianDate.now())
const position = entity.position?.getValue(Cesium.JulianDate.now())
console.log(entity, names, value, position)

// C. 点击拾取要素属性
new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
  const picked = viewer.scene.pick(e.position)
  if (picked?.id) viewer.selectedEntity = picked.id
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`

const TILESET_USAGE = `// A. 加载 3D Tiles
const tileset = await Cesium.Cesium3DTileset.fromUrl('tileset.json', {
  maximumScreenSpaceError: 16,
})
viewer.scene.primitives.add(tileset)
viewer.flyTo(tileset)

// B. 前端可读取的瓦片集信息
console.log(tileset.asset, tileset.root, tileset.properties, tileset.statistics)

// C. 点击构件读取 batch table / metadata 属性
new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
  const f = viewer.scene.pick(e.position)
  if (f instanceof Cesium.Cesium3DTileFeature) {
    const names = f.getPropertyNames()
    names.forEach((name) => console.log(name, f.getProperty(name)))
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)

// D. 用属性驱动样式（过滤 / 分级着色）
tileset.style = new Cesium.Cesium3DTileStyle({
  show: '\${height} > 50',
  color: 'color("\${type}", color("red", 1.0), color("blue", 1.0))',
})`

const MODEL_USAGE = `// A. 加载 glTF / GLB 到指定经纬度
const model = await Cesium.Model.fromGltfAsync({
  url: 'Duck.glb',
  modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(114.1694, 22.3193, 0),
  ),
  scale: 1,
})
viewer.scene.primitives.add(model)

// B. 读取节点树（楼层 / 构件 / 材质）
model.readyEvent.addEventListener(() => {
  const nodes = model.sceneGraph?._nodesByName ?? {}
  Object.keys(nodes).forEach((name) => console.log(name, model.getNode(name)))
  console.log(model.boundingSphere)
})

// C. 点击拾取模型节点
new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((e) => {
  const picked = viewer.scene.pick(e.position)
  console.log(picked?.primitive, picked?.detail?.node)
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`

export const INSPECT_SNIPPETS: Record<AssetKind, string> = {
  geojson: GEOJSON_USAGE,
  tileset: TILESET_USAGE,
  model: MODEL_USAGE,
}

/** 统一入口：解析 JSON 并补齐文件信息 */
export function inspectAsset(
  kind: AssetKind,
  json: any,
  options: { name: string; size: number; glbVersion?: number; binLength?: number },
): InspectResult {
  const result =
    kind === 'geojson'
      ? inspectGeoJson(json)
      : kind === 'tileset'
        ? inspectTileset(json)
        : inspectGltf(json, options.glbVersion, options.binLength)
  return { ...result, name: options.name, size: options.size }
}
