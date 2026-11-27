/**
 * 静态图层渲染 —— 纯 Cesium Entity / Polyline 绘制
 * 所有 draw* 函数都接受 viewer + CesiumLib（运行时注入，避免 npm 类型依赖）。
 * 返回 Entity[] 或 entity collection，便于外部整体显隐 / 销毁。
 *
 * 注意：严格空值收敛 —— 入口统一 if (!viewer || !C) return []
 */

import type {
  BusStop,
  Centerline,
  EvChargerClass,
  EvChargerPlace,
  FerryPier,
  LightRailRoute,
  LightRailStation,
  MtrLine,
  MtrNetworkData,
  MtrRoute,
  MtrStation,
  RailTracksData,
  RoadPointItem,
} from './types'

type V = any
type C = any

/**
 * 把 "#RRGGBB" 解析成 Cesium.Color（带 alpha）。
 * 失败回落 Color.WHITE，避免整条线没颜色。
 */
function hexToCesiumColor(C: any, hex: string, alpha = 0.9): any {
  try {
    return C.Color.fromCssColorString(hex).withAlpha(alpha)
  } catch {
    return C.Color.WHITE.withAlpha(alpha)
  }
}

/** [lon,lat][] → Cartesian3[] */
function toCartesians(C: any, pts: [number, number][]): any[] {
  return pts.map(([lon, lat]) => C.Cartesian3.fromDegrees(lon, lat))
}

// ──────────────────────────────────────────────────────────────────────────
// 港铁路网（线路 + 车站）
// ──────────────────────────────────────────────────────────────────────────

/**
 * 从 mtr-network.routes 推导出每个相邻站对属于哪条线路
 * 返回 Map<"STA_A>STA_B", lineCode>（双向都存）
 */
function buildEdgeLineMap(network: MtrNetworkData): Map<string, string> {
  const map = new Map<string, string>()
  if (!network?.routes) return map
  for (const route of network.routes) {
    if (!route?.line || !Array.isArray(route.stations)) continue
    for (let i = 0; i < route.stations.length - 1; i++) {
      const a = route.stations[i]
      const b = route.stations[i + 1]
      if (!a || !b) continue
      map.set(`${a}>${b}`, route.line)
      map.set(`${b}>${a}`, route.line)
    }
  }
  return map
}

export interface MtrDrawResult {
  lineEntities: any[] /** 线路 polyline */
  stationEntities: any[] /** 车站点（billboard + label） */
  stationCodeToEntity: Map<string, any> /** 车站 CODE → Entity */
}

export function drawMtrNetwork(
  viewer: V,
  C: C,
  network: MtrNetworkData | null,
  tracks: RailTracksData | null,
): MtrDrawResult {
  const empty: MtrDrawResult = { lineEntities: [], stationEntities: [], stationCodeToEntity: new Map() }
  if (!viewer || !C || !network) return empty

  const lineEntities: any[] = []
  const stationEntities: any[] = []
  const stationCodeToEntity = new Map<string, any>()

  // ---- 线路 ----
  if (tracks?.edges && network.lines) {
    const edgeLineMap = buildEdgeLineMap(network)
    for (const [key, pts] of Object.entries(tracks.edges)) {
      if (!Array.isArray(pts) || pts.length < 2) continue
      const lineCode = edgeLineMap.get(key)
      const color = lineCode && network.lines[lineCode]?.color
        ? hexToCesiumColor(C, network.lines[lineCode].color, 0.95)
        : C.Color.YELLOW.withAlpha(0.6)
      const entity = viewer.entities.add({
        polyline: {
          positions: toCartesians(C, pts),
          width: 3,
          material: color,
          clampToGround: true,
        },
        properties: {
          kind: 'mtr-line',
          edgeKey: key,
          lineCode: lineCode ?? '',
        },
      })
      lineEntities.push(entity)
    }
  }

  // ---- 车站 ----
  if (network.stations) {
    for (const [code, st] of Object.entries(network.stations)) {
      if (!st || typeof st.lng !== 'number' || typeof st.lat !== 'number') continue
      const entity = viewer.entities.add({
        name: `${st.tc} / ${st.en}`,
        position: C.Cartesian3.fromDegrees(st.lng, st.lat),
        point: {
          pixelSize: 8,
          color: C.Color.WHITE,
          outlineColor: C.Color.BLACK,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: st.tc,
          font: '11px "Microsoft YaHei", sans-serif',
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new C.Cartesian2(0, -14),
          style: C.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: false,
        },
        properties: {
          kind: 'mtr-station',
          code,
          en: st.en,
          tc: st.tc,
          lng: st.lng,
          lat: st.lat,
        },
      })
      stationEntities.push(entity)
      stationCodeToEntity.set(code, entity)
    }
  }

  return { lineEntities, stationEntities, stationCodeToEntity }
}

// ──────────────────────────────────────────────────────────────────────────
// 轻铁路网
// ──────────────────────────────────────────────────────────────────────────

export interface LightRailDrawResult {
  routeEntities: any[]
  stationEntities: any[]
}

export function drawLightRail(
  viewer: V,
  C: C,
  stations: LightRailStation[] | null,
  routesData: { color: string; routes: LightRailRoute[] } | null,
): LightRailDrawResult {
  const empty: LightRailDrawResult = { routeEntities: [], stationEntities: [] }
  if (!viewer || !C || !stations || !routesData) return empty

  const stationMap = new Map<string, LightRailStation>()
  for (const s of stations) stationMap.set(s.id, s)

  const routeEntities: any[] = []
  const stationEntities: any[] = []

  // ---- 线路 polyline ----
  if (Array.isArray(routesData.routes)) {
    const color = hexToCesiumColor(C, routesData.color || '#F5C400', 0.9)
    for (const r of routesData.routes) {
      const pts: [number, number][] = []
      for (const sid of r.stations) {
        const s = stationMap.get(sid)
        if (s) pts.push([s.lng, s.lat])
      }
      if (pts.length < 2) continue
      const entity = viewer.entities.add({
        polyline: {
          positions: toCartesians(C, pts),
          width: 3,
          material: color,
          clampToGround: true,
        },
        properties: {
          kind: 'light-rail-route',
          line: r.line,
          routeId: r.id,
        },
      })
      routeEntities.push(entity)
    }
  }

  // ---- 车站 ----
  for (const s of stations) {
    const entity = viewer.entities.add({
      name: `${s.tc} / ${s.en}`,
      position: C.Cartesian3.fromDegrees(s.lng, s.lat),
      point: {
        pixelSize: 6,
        color: C.Color.fromCssColorString('#F5C400'),
        outlineColor: C.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        kind: 'light-rail-station',
        id: s.id,
        en: s.en,
        tc: s.tc,
        lng: s.lng,
        lat: s.lat,
      },
    })
    stationEntities.push(entity)
  }

  return { routeEntities, stationEntities }
}

// ──────────────────────────────────────────────────────────────────────────
// 策略性干道
// ──────────────────────────────────────────────────────────────────────────

export function drawCenterlines(viewer: V, C: C, items: Centerline[] | null): any[] {
  if (!viewer || !C || !Array.isArray(items)) return []
  const entities: any[] = []
  const color = C.Color.fromCssColorString('#475569').withAlpha(0.85)
  for (const it of items) {
    if (!Array.isArray(it.coordinates) || it.coordinates.length < 2) continue
    const entity = viewer.entities.add({
      polyline: {
        positions: toCartesians(C, it.coordinates),
        width: 2,
        material: color,
        clampToGround: true,
      },
      properties: {
        kind: 'centerline',
        id: it.id,
        roadEn: it.roadEn,
        roadTc: it.roadTc,
        direction: it.direction,
      },
    })
    entities.push(entity)
  }
  return entities
}

// ──────────────────────────────────────────────────────────────────────────
// 渡轮码头
// ──────────────────────────────────────────────────────────────────────────

export function drawFerryPiers(viewer: V, C: C, piers: FerryPier[] | null): any[] {
  if (!viewer || !C || !Array.isArray(piers)) return []
  const entities: any[] = []
  const color = C.Color.fromCssColorString('#0ea5e9')
  for (const p of piers) {
    const entity = viewer.entities.add({
      name: `${p.nameTc} / ${p.nameEn}`,
      position: C.Cartesian3.fromDegrees(p.lng, p.lat),
      point: {
        pixelSize: 10,
        color,
        outlineColor: C.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: p.nameTc,
        font: '11px sans-serif',
        fillColor: C.Color.WHITE,
        outlineColor: C.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new C.Cartesian2(0, -14),
        style: C.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        kind: 'ferry-pier',
        id: p.id,
        nameEn: p.nameEn,
        nameTc: p.nameTc,
        lng: p.lng,
        lat: p.lat,
      },
    })
    entities.push(entity)
  }
  return entities
}

// ──────────────────────────────────────────────────────────────────────────
// EV 充电桩 —— 按「最高等级有哪种」分类上色
// ──────────────────────────────────────────────────────────────────────────

const EV_CLASS_COLORS: Record<EvChargerClass, string> = {
  standard: '#94a3b8',
  medium: '#22c55e',
  quick: '#f59e0b',
  fast: '#ef4444',
  mixed: '#a855f7',
}

function classifyEv(p: EvChargerPlace): EvChargerClass {
  const kinds: EvChargerClass[] = []
  if (p.standard > 0) kinds.push('standard')
  if (p.medium > 0) kinds.push('medium')
  if (p.quick > 0) kinds.push('quick')
  if (p.fast > 0) kinds.push('fast')
  if (kinds.length === 0) return 'standard'
  if (kinds.length === 1) return kinds[0]
  return 'mixed'
}

export function drawEvChargers(viewer: V, C: C, places: EvChargerPlace[] | null): any[] {
  if (!viewer || !C || !Array.isArray(places)) return []
  const entities: any[] = []
  for (const p of places) {
    const cls = classifyEv(p)
    const css = EV_CLASS_COLORS[cls]
    const color = hexToCesiumColor(C, css, 0.9)
    const entity = viewer.entities.add({
      name: `${p.nameTc} / ${p.nameEn}`,
      position: C.Cartesian3.fromDegrees(p.lng, p.lat),
      point: {
        pixelSize: 9,
        color,
        outlineColor: C.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        kind: 'ev-charger',
        id: p.id,
        nameEn: p.nameEn,
        nameTc: p.nameTc,
        districtTc: p.districtTc ?? '',
        lng: p.lng,
        lat: p.lat,
        standard: p.standard,
        medium: p.medium,
        quick: p.quick,
        fast: p.fast,
        evClass: cls,
      },
    })
    entities.push(entity)
  }
  return entities
}

// ──────────────────────────────────────────────────────────────────────────
// 工具：批量设置显隐 / 批量 remove
// ──────────────────────────────────────────────────────────────────────────

export function setEntitiesVisible(entities: any[], visible: boolean) {
  for (const e of entities) {
    if (e && typeof e.show !== 'undefined') e.show = visible
  }
}

export function removeEntities(viewer: V, entities: any[]) {
  if (!viewer || !Array.isArray(entities)) return
  for (const e of entities) {
    if (e) viewer.entities.remove(e)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 巴士站点（Citybus / KMB / NLB / GMB）—— 通用渲染，不同公司不同颜色
// ──────────────────────────────────────────────────────────────────────────

const BUS_COMPANY_STYLES: Record<string, { color: string; kind: PickedEntityInfoKind }> = {
  citybus: { color: '#ea580c', kind: 'bus-citybus' },
  kmb:     { color: '#dc2626', kind: 'bus-kmb' },
  nlb:     { color: '#7c3aed', kind: 'bus-nlb' },
  gmb:     { color: '#059669', kind: 'bus-gmb' },
}
type PickedEntityInfoKind = 'bus-citybus' | 'bus-kmb' | 'bus-nlb' | 'bus-gmb'

export function drawBusStops(
  viewer: V,
  C: C,
  stops: BusStop[] | null,
  company: keyof typeof BUS_COMPANY_STYLES,
): any[] {
  if (!viewer || !C || !Array.isArray(stops)) return []
  const { color, kind } = BUS_COMPANY_STYLES[company]
  const entityColor = hexToCesiumColor(C, color, 0.95)
  const entities: any[] = []
  for (const s of stops) {
    const entity = viewer.entities.add({
      name: s.tc || s.en,
      position: C.Cartesian3.fromDegrees(s.lng, s.lat),
      point: {
        pixelSize: 5,
        color: entityColor,
        outlineColor: C.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        kind,
        id: s.id,
        tc: s.tc,
        en: s.en,
        lng: s.lng,
        lat: s.lat,
        routes: (s.routes ?? []).join(', '),
      },
    })
    entities.push(entity)
  }
  return entities
}

// ──────────────────────────────────────────────────────────────────────────
// 道路点位（road-points.json —— 每条包含多个 lon/lat 点）
// ──────────────────────────────────────────────────────────────────────────

export function drawRoadPoints(viewer: V, C: C, items: RoadPointItem[] | null): any[] {
  if (!viewer || !C || !Array.isArray(items)) return []
  const entities: any[] = []
  const color = C.Color.fromCssColorString('#334155').withAlpha(0.7)
  for (const it of items) {
    if (!Array.isArray(it.points)) continue
    for (const [lng, lat] of it.points) {
      const entity = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(lng, lat),
        point: {
          pixelSize: 3,
          color,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          kind: 'road-point',
          tc: it.tc,
          en: it.en,
          lng, lat,
        },
      })
      entities.push(entity)
    }
  }
  return entities
}
