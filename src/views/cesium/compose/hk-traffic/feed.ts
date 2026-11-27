/**
 * 数据获取与轮询
 *
 * 资源 URL 必须走 `import.meta.env.BASE_URL`，
 * GitHub Pages 项目站点（/web-gis/）与本地 dev（/）自动适配；
 * 不要写死 `/data/...`，否则 Pages 上会 404。
 */

import type {
  BusStop,
  Centerline,
  EvChargersData,
  FerryPier,
  LightRailRoutesData,
  LightRailStation,
  LonLat,
  LwbRoutesData,
  MtrNetworkData,
  RailTracksData,
  RoadPointItem,
} from './types'

const DATA_BASE = `${import.meta.env.BASE_URL}data/hk-traffic/`

export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    window.clearTimeout(timer)
    if (!res.ok) {
      console.warn(`[hk-traffic] ${url} -> HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.warn(`[hk-traffic] ${url} failed:`, (e as Error).message)
    return null
  }
}

/** { stops: Record<id, {tc,en,lng,lat,routes}> } → BusStop[] */
function flattenStops(raw: any): BusStop[] {
  if (!raw || typeof raw !== 'object') return []
  const stops = (raw as any).stops
  if (!stops || typeof stops !== 'object') return []
  const out: BusStop[] = []
  for (const [id, s] of Object.entries(stops)) {
    const x = s as any
    if (typeof x.lng === 'number' && typeof x.lat === 'number') {
      out.push({ id, tc: x.tc ?? '', en: x.en ?? '', lng: x.lng, lat: x.lat, routes: x.routes })
    }
  }
  return out
}

export interface StaticDataBundle {
  mtrNetwork: MtrNetworkData | null
  railTracks: RailTracksData | null
  lightRailStations: LightRailStation[] | null
  lightRailRoutes: LightRailRoutesData | null
  centerlines: Centerline[] | null
  ferryPiers: FerryPier[] | null
  evChargers: EvChargersData | null
  citybusStops: BusStop[] | null
  kmbStops: BusStop[] | null
  nlbStops: BusStop[] | null
  gmbStops: BusStop[] | null
  lwbRoutes: LwbRoutesData | null
  roadPoints: RoadPointItem[] | null
}

export async function loadAllStatic(): Promise<StaticDataBundle> {
  const [
    mtrNetwork, railTracks, lightRailStationsRaw, lightRailRoutes,
    centerlines, ferryPiersRaw, evChargers,
    citybusRaw, kmbRaw, nlbRaw, gmbRaw, lwbRoutes, roadPoints,
  ] = await Promise.all([
    fetchJson<MtrNetworkData>(DATA_BASE + 'mtr-network.json'),
    fetchJson<RailTracksData>(DATA_BASE + 'rail-tracks.json'),
    fetchJson<{ stations: LightRailStation[] }>(DATA_BASE + 'light-rail-stations.json'),
    fetchJson<LightRailRoutesData>(DATA_BASE + 'light-rail-routes.json'),
    fetchJson<Centerline[]>(DATA_BASE + 'strategic-centerlines.json'),
    fetchJson<{ piers: FerryPier[] }>(DATA_BASE + 'ferry-piers.json'),
    fetchJson<EvChargersData>(DATA_BASE + 'ev-chargers.json'),
    fetchJson<any>(DATA_BASE + 'citybus-network.json'),
    fetchJson<any>(DATA_BASE + 'kmb-network.json'),
    fetchJson<any>(DATA_BASE + 'nlb-network.json'),
    fetchJson<any>(DATA_BASE + 'gmb-network.json'),
    fetchJson<LwbRoutesData>(DATA_BASE + 'lwb-routes.json'),
    fetchJson<RoadPointItem[]>(DATA_BASE + 'road-points.json'),
  ])

  return {
    mtrNetwork,
    railTracks,
    lightRailStations: lightRailStationsRaw?.stations ?? null,
    lightRailRoutes,
    centerlines,
    ferryPiers: ferryPiersRaw?.piers ?? null,
    evChargers,
    citybusStops: flattenStops(citybusRaw),
    kmbStops: flattenStops(kmbRaw),
    nlbStops: flattenStops(nlbRaw),
    gmbStops: flattenStops(gmbRaw),
    lwbRoutes,
    roadPoints,
  }
}

/** 可停止轮询器 */
export function poller(fn: () => void | Promise<void>, intervalMs: number, opts?: { stop$?: () => boolean }) {
  let stopped = false
  const timer = window.setInterval(async () => {
    if (opts?.stop$?.() || stopped) return
    try { await fn() } catch (e) { console.warn('[hk-traffic] poller tick failed:', (e as Error).message) }
  }, intervalMs)
  return () => { stopped = true; window.clearInterval(timer) }
}

export async function chunkedConcurrent<T, R>(items: T[], size: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    results.push(...(await Promise.all(batch.map(mapper))))
  }
  return results
}

export interface MtrScheduleEntry { line: string; sta: string; dest?: string; time?: string; plat?: string; min?: number }
const MTR_SCHEDULE_URL = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php'
export async function fetchMtrSchedule(line: string, sta: string): Promise<MtrScheduleEntry[]> {
  const raw = await fetchJson<any>(`${MTR_SCHEDULE_URL}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(sta)}`, 5000)
  if (!raw?.data) return []
  const info = raw.data[`${line}-${sta}`]
  if (!info) return []
  const out: MtrScheduleEntry[] = []
  for (const k of ['up', 'down']) {
    const arr = info[k]
    if (Array.isArray(arr)) for (const it of arr) out.push({ line, sta, dest: it.dest, time: it.time, plat: it.plat, min: Number.parseInt(it.ttn ?? it.time, 10) || undefined })
  }
  return out
}

export interface WeatherWarning { code: string; type: string; desc: string; timestamp: string }
export async function fetchWeatherWarnings(): Promise<WeatherWarning[]> {
  const raw = await fetchJson<any>('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc', 5000)
  if (!raw) return []
  const out: WeatherWarning[] = []
  for (const code of Object.keys(raw)) {
    const it = raw[code]
    if (it?.type && it?.desc) out.push({ code, type: it.type, desc: it.desc, timestamp: it.updateTime ?? it.timestamp ?? '' })
  }
  return out
}

// 避免未使用 import 警告
export type _LonLat = LonLat
