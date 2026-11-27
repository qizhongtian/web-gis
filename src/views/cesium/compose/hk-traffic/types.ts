/**
 * HK Traffic Intelligence —— 共享类型定义
 */

/** [经度, 纬度] */
export type LonLat = [number, number]

/** 港铁车站 */
export interface MtrStation {
  en: string
  tc: string
  lng: number
  lat: number
}

/** 港铁线路（颜色用于 Polyline） */
export interface MtrLine {
  en: string
  tc: string
  color: string
  stations?: string[]
}

/** 港铁路线 */
export interface MtrRoute {
  id: string
  line: string
  stations: string[]
}

export interface MtrNetworkData {
  stations: Record<string, MtrStation>
  lines: Record<string, MtrLine>
  routes: MtrRoute[]
}

export interface RailTracksData {
  edges: Record<string, LonLat[]>
}

/** 策略性干道 */
export interface Centerline {
  id: string
  roadEn: string
  roadTc: string
  direction: string
  coordinates: LonLat[]
}

/** 渡轮码头 */
export interface FerryPier {
  id: string
  nameTc: string
  nameEn: string
  lng: number
  lat: number
}

/** EV 充电桩 */
export interface EvChargerPlace {
  id: string
  nameTc: string
  nameEn: string
  districtTc?: string
  lng: number
  lat: number
  standard: number
  medium: number
  quick: number
  fast: number
}

export interface EvChargersData {
  asOf: string
  places: EvChargerPlace[]
}

/** 轻铁车站/路线 */
export interface LightRailStation { id: string; tc: string; en: string; lng: number; lat: number }
export interface LightRailRoute { id: string; line: string; stations: string[] }
export interface LightRailRoutesData { color: string; routes: LightRailRoute[] }

/** 通用巴士站（Citybus / KMB / NLB / GMB） */
export interface BusStop {
  id: string
  tc: string
  en: string
  lng: number
  lat: number
  routes?: string[]
}

/** LWB 机场巴士 —— 仅线路 ID 列表（没有站点） */
export type LwbRoutesData = string[]

/** 道路点（road-points.json：每条含多个 [lon,lat] 坐标） */
export interface RoadPointItem {
  en: string
  tc: string
  points: LonLat[]
}

/** EV 充电桩渲染分类 */
export type EvChargerClass = 'standard' | 'medium' | 'quick' | 'fast' | 'mixed'

/** 拾取到的实体详情 */
export interface PickedEntityInfo {
  title: string
  subtitle?: string
  kind:
    | 'mtr-station' | 'mtr-line'
    | 'light-rail-station' | 'light-rail-route'
    | 'centerline'
    | 'ferry-pier'
    | 'ev-charger'
    | 'bus-citybus' | 'bus-kmb' | 'bus-nlb' | 'bus-gmb' | 'bus-lwb'
    | 'road-point'
  rows: [string, string][]
  lng?: number
  lat?: number
}
