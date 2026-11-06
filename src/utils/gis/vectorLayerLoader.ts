/**
 * 点 / 线 / 面矢量加载器（纯 Cesium 逻辑，与框架无关）
 *
 * 设计目标：
 * - 前端上传、后端接口返回的 GeoJSON 都能复用同一套加载函数；
 * - 后端一次返回多条图层数据时，只需按 type 字段分发到对应 loader；
 * - 高程兜底：坐标带有效第三维（高程）时按绝对高度渲染，否则贴地（clampToGround）。
 *
 * ```ts
 * // 后端返回：[{ id, name, createTime, type: 'point'|'line'|'polygon', enabled, data, style }]
 * list.forEach((item) => loadVectorLayer(viewer, Cesium, item))
 * ```
 */

export type VectorType = 'point' | 'line' | 'polygon'

/** 点样式：图片点位 + 缩放，不显示 label */
export interface PointStyle {
  /** 图片地址（http(s) / blob / base64 dataURL） */
  image: string
  /** 图标缩放 */
  scale: number
  /** 可选：垂直偏移（像素），默认锚点居中 */
  verticalOrigin?: 'CENTER' | 'BOTTOM'
}

/** 线样式 */
export interface LineStyle {
  color: string
  width: number
  /** 是否虚线 */
  dashed: boolean
}

/** 面样式 */
export interface PolygonStyle {
  outlineColor: string
  fillColor: string
  /** 填充透明度 0-1 */
  fillAlpha: number
  /** 轮廓是否虚线 */
  outlineDashed: boolean
  outlineWidth: number
}

/** 公共图层属性（前端表单 / 后端接口字段） */
export interface VectorLayerMeta {
  /** 唯一 id，后端返回时用于增量更新 */
  id: string
  /** 图层名称 */
  name: string
  /** 创建时间（展示用字符串，如 2026-11-06 10:00） */
  createTime: string
  /** 是否启用（false 时加载后默认隐藏） */
  enabled?: boolean
}

/** 一个待加载的矢量图层（后端接口可直接返回该结构数组） */
export interface VectorLayerPayload extends VectorLayerMeta {
  /** 要素类型 */
  type: VectorType
  /** GeoJSON：FeatureCollection / Feature / Geometry 均可 */
  data: any
  /** 按类型取对应样式 */
  style: PointStyle | LineStyle | PolygonStyle
}

/** 加载结果 */
export interface LoadedVectorLayer {
  id: string
  name: string
  createTime: string
  type: VectorType
  /** 实际渲染的要素数量 */
  count: number
  /** 是否存在高程缺失（说明走了贴地兜底） */
  clamped: boolean
  dataSource: any
  /** 用于定位的包围球 */
  boundingSphere: any
}

/* ------------------------------------------------------------------ */
/* GeoJSON 归一化                                                      */
/* ------------------------------------------------------------------ */

/** 从任意 GeoJSON 结构里提取 feature 列表（兼容 Geometry / Feature / FeatureCollection） */
export function extractFeatures(data: any): any[] {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data.flatMap((d) => extractFeatures(d))
  if (data.type === 'FeatureCollection') return data.features || []
  if (data.type === 'Feature') return [data]
  if (data.type && data.coordinates) return [{ type: 'Feature', geometry: data, properties: {} }]
  if (data.type === 'GeometryCollection') {
    return (data.geometries || []).map((g: any) => ({ type: 'Feature', geometry: g, properties: {} }))
  }
  return []
}

/** 判断坐标是否带有效高程（第三位存在且为有限数字，0 视为无高程） */
export function hasHeight(coord: any): boolean {
  return Array.isArray(coord) && coord.length > 2 && Number.isFinite(Number(coord[2])) && Number(coord[2]) !== 0
}

/** 判断一组坐标（环 / 线）是否带高程 */
export function ringHasHeight(coords: any[]): boolean {
  return Array.isArray(coords) && coords.some((c) => hasHeight(c))
}

/** 按坐标批量转 Cartesian3；有高程用高程，否则高度 0（配合贴地渲染） */
export function toCartesianArray(C: any, coords: any[]): any[] {
  return coords.map((c) => C.Cartesian3.fromDegrees(Number(c[0]), Number(c[1]), hasHeight(c) ? Number(c[2]) : 0))
}

/** 计算坐标数组的包围球（用于点击图层定位） */
export function boundingSphereOf(C: any, positions: any[]) {
  if (!positions.length) return undefined
  return C.BoundingSphere.fromPoints(positions)
}

/* ------------------------------------------------------------------ */
/* 样式 -> Cesium 材质                                                 */
/* ------------------------------------------------------------------ */

function colorOf(C: any, css: string, alpha = 1) {
  return C.Color.fromCssColorString(css || '#2563eb').withAlpha(alpha)
}

/** 线材质：实线 / 虚线 */
export function lineMaterial(C: any, color: string, dashed: boolean) {
  const c = colorOf(C, color)
  return dashed ? new C.PolylineDashMaterialProperty({ color: c, dashLength: 16 }) : c
}

/* ------------------------------------------------------------------ */
/* 三类加载函数（后端按 type 直接调用）                                 */
/* ------------------------------------------------------------------ */

/**
 * 加载点：图片作为点位样式，不显示 label，scale 控制大小
 * 有高程 -> 绝对高度；无高程 -> 贴地（heightReference 兜底）
 */
export function loadPoints(
  viewer: any,
  C: any,
  payload: Pick<VectorLayerPayload, 'data' | 'style'>,
): { dataSource: any; count: number; clamped: boolean; positions: any[] } {
  const style = payload.style as PointStyle
  const ds = new C.CustomDataSource('points')
  let count = 0
  let clamped = false
  const positions: any[] = []

  extractFeatures(payload.data).forEach((feature, i) => {
    const geom = feature?.geometry
    if (!geom) return
    const list: any[][] =
      geom.type === 'Point' ? [geom.coordinates] : geom.type === 'MultiPoint' ? geom.coordinates : []
    list.forEach((coord, j) => {
      if (!Array.isArray(coord) || coord.length < 2) return
      const withHeight = hasHeight(coord)
      if (!withHeight) clamped = true
      const position = C.Cartesian3.fromDegrees(
        Number(coord[0]),
        Number(coord[1]),
        withHeight ? Number(coord[2]) : 0,
      )
      positions.push(position)
      ds.entities.add({
        id: `${ds.name}-p-${i}-${j}`,
        name: feature.properties?.name || '',
        position,
        properties: feature.properties || {},
        billboard: {
          image: style.image,
          scale: style.scale ?? 1,
          // 无高程时贴地兜底，避免图标陷进地形
          heightReference: withHeight ? C.HeightReference.NONE : C.HeightReference.CLAMP_TO_GROUND,
          verticalOrigin:
            style.verticalOrigin === 'BOTTOM' ? C.VerticalOrigin.BOTTOM : C.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        // 需求：点不显示 label
      })
      count += 1
    })
  })

  return { dataSource: ds, count, clamped, positions }
}

/**
 * 加载线：颜色 / 粗细 / 虚实线；有高程按绝对高度，否则贴地
 */
export function loadLines(
  viewer: any,
  C: any,
  payload: Pick<VectorLayerPayload, 'data' | 'style'>,
): { dataSource: any; count: number; clamped: boolean; positions: any[] } {
  const style = payload.style as LineStyle
  const ds = new C.CustomDataSource('lines')
  let count = 0
  let clamped = false
  const positions: any[] = []

  extractFeatures(payload.data).forEach((feature, i) => {
    const geom = feature?.geometry
    if (!geom) return
    const lines: any[][] =
      geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : []
    lines.forEach((line, j) => {
      if (!Array.isArray(line) || line.length < 2) return
      const withHeight = ringHasHeight(line)
      if (!withHeight) clamped = true
      const linePositions = toCartesianArray(C, line)
      positions.push(...linePositions)
      ds.entities.add({
        id: `${ds.name}-l-${i}-${j}`,
        name: feature.properties?.name || '',
        properties: feature.properties || {},
        polyline: {
          positions: linePositions,
          width: style.width ?? 2,
          material: lineMaterial(C, style.color, style.dashed),
          clampToGround: !withHeight,
        },
      })
      count += 1
    })
  })

  return { dataSource: ds, count, clamped, positions }
}

/**
 * 加载面：填充色 + 透明度 + 轮廓色 / 虚实线
 * 轮廓统一用 polyline 绘制（贴地面 outline 不可靠，且虚线只有 polyline 支持）
 */
export function loadPolygons(
  viewer: any,
  C: any,
  payload: Pick<VectorLayerPayload, 'data' | 'style'>,
): { dataSource: any; count: number; clamped: boolean; positions: any[] } {
  const style = payload.style as PolygonStyle
  const ds = new C.CustomDataSource('polygons')
  let count = 0
  let clamped = false
  const positions: any[] = []
  const fill = colorOf(C, style.fillColor, style.fillAlpha ?? 0.35)

  extractFeatures(payload.data).forEach((feature, i) => {
    const geom = feature?.geometry
    if (!geom) return
    const polygons: any[][][] =
      geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
    polygons.forEach((rings, j) => {
      if (!Array.isArray(rings) || !rings.length) return
      const withHeight = rings.some((r) => ringHasHeight(r))
      if (!withHeight) clamped = true
      const hierarchyPositions = rings.map((ring) => toCartesianArray(C, ring))
      positions.push(...hierarchyPositions.flat())

      ds.entities.add({
        id: `${ds.name}-a-${i}-${j}`,
        name: feature.properties?.name || '',
        properties: feature.properties || {},
        polygon: {
          hierarchy: new C.PolygonHierarchy(hierarchyPositions[0], hierarchyPositions.slice(1)),
          material: fill,
          // 有高程：按顶点高度渲染；无高程：贴地
          perPositionHeight: withHeight,
          heightReference: withHeight ? C.HeightReference.NONE : C.HeightReference.CLAMP_TO_GROUND,
          outline: false,
        },
        polyline: {
          positions: [...hierarchyPositions[0], hierarchyPositions[0][0]],
          width: style.outlineWidth ?? 2,
          material: lineMaterial(C, style.outlineColor, style.outlineDashed),
          clampToGround: !withHeight,
        },
      })
      count += 1
    })
  })

  return { dataSource: ds, count, clamped, positions }
}

/**
 * 统一入口：按 type 分发到点 / 线 / 面加载函数
 * @returns 已加入 viewer 的图层信息（含包围球，可直接用于 flyTo）
 */
export function loadVectorLayer(viewer: any, C: any, payload: VectorLayerPayload): LoadedVectorLayer {
  const type = payload.type
  const loaded =
    type === 'point'
      ? loadPoints(viewer, C, payload)
      : type === 'line'
        ? loadLines(viewer, C, payload)
        : loadPolygons(viewer, C, payload)

  const { dataSource, count, clamped, positions } = loaded
  dataSource.name = `${payload.name}-${payload.createTime}`
  dataSource.show = payload.enabled !== false
  viewer.dataSources.add(dataSource)

  return {
    id: payload.id,
    name: payload.name,
    createTime: payload.createTime,
    type,
    count,
    clamped,
    dataSource,
    boundingSphere: boundingSphereOf(C, positions),
  }
}

/** 根据 GeoJSON 内容推断要素类型（用于表单联动） */
export function detectVectorType(data: any): VectorType | '' {
  const features = extractFeatures(data)
  for (const f of features) {
    const t = f?.geometry?.type
    if (!t) continue
    if (t === 'Point' || t === 'MultiPoint') return 'point'
    if (t === 'LineString' || t === 'MultiLineString') return 'line'
    if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon'
  }
  return ''
}
