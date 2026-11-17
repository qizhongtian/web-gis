/**
 * 天气数据：wttr.in（主）与 Open-Meteo（备）两个免密钥公开接口，互为降级。
 * 定位优先取本地缓存，其次 IP 粗略定位，最后回退到默认城市。
 */
import { onBeforeUnmount, ref } from 'vue'

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

export interface WeatherLocation {
  lat: number
  lon: number
  city: string
  /** 是否来自 IP 定位 / 默认值 */
  source: 'ip' | 'default'
}

export interface WeatherNow {
  temperature: number
  apparent: number
  humidity: number
  wind: number
  precipitation: number
  code: number
  isDay: boolean
  high: number
  low: number
  observedAt: string
  fetchedAt: number
  location: WeatherLocation
  /** 数据来源，便于排查 */
  provider: 'wttr' | 'open-meteo'
}

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast'
const WTTR_API = 'https://wttr.in'
const LOCATION_API = 'https://ipwho.is/?fields=success,city,latitude,longitude'
const CACHE_KEY = 'wg-weather-now'
const LOCATION_KEY = 'wg-weather-location'
/** 天气缓存有效期（毫秒） */
const CACHE_TTL = 10 * 60 * 1000
const DEFAULT_LOCATION: WeatherLocation = { lat: 39.9042, lon: 116.4074, city: '北京', source: 'default' }

/** WMO 天气码归类（Open-Meteo），用于选图标与文案 */
export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([95, 96, 99].includes(code)) return 'thunder'
  return 'cloudy'
}

/** World Weather Online 天气码 → 统一归类（wttr.in 使用） */
const WWO_KIND_MAP: Record<number, WeatherKind> = {
  113: 'clear',
  116: 'partly',
  119: 'cloudy',
  122: 'cloudy',
  143: 'fog',
  248: 'fog',
  260: 'fog',
  176: 'rain',
  263: 'drizzle',
  266: 'drizzle',
  281: 'drizzle',
  284: 'drizzle',
  293: 'rain',
  296: 'rain',
  299: 'rain',
  302: 'rain',
  305: 'rain',
  308: 'rain',
  311: 'drizzle',
  314: 'drizzle',
  353: 'rain',
  356: 'rain',
  359: 'rain',
  179: 'snow',
  182: 'snow',
  185: 'snow',
  227: 'snow',
  230: 'snow',
  317: 'snow',
  320: 'snow',
  323: 'snow',
  326: 'snow',
  329: 'snow',
  332: 'snow',
  335: 'snow',
  338: 'snow',
  350: 'snow',
  362: 'snow',
  365: 'snow',
  368: 'snow',
  371: 'snow',
  374: 'snow',
  377: 'snow',
  200: 'thunder',
  386: 'thunder',
  389: 'thunder',
  392: 'thunder',
  395: 'thunder',
}

/** 把 WWO 天气码换算成 Open-Meteo 的 WMO 码，保证 UI 只依赖一套判定 */
const WWO_TO_WMO: Record<WeatherKind, number> = {
  clear: 0,
  partly: 2,
  cloudy: 3,
  fog: 45,
  drizzle: 51,
  rain: 61,
  snow: 71,
  thunder: 95,
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

async function fetchJson<T>(url: string, timeout = 6000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 白天判定：优先用接口返回值，缺失时按当地时刻粗略判断 */
function isDaytime(flag: number | undefined, date = new Date()): boolean {
  if (flag === 0 || flag === 1) return flag === 1
  const h = date.getHours()
  return h >= 6 && h < 19
}

interface OpenMeteoCurrent {
  current?: {
    time?: string
    temperature_2m?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    precipitation?: number
    weather_code?: number
    is_day?: number
    wind_speed_10m?: number
  }
  daily?: {
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

interface WttrResponse {
  current_condition?: Array<{
    temp_C?: string
    FeelsLikeC?: string
    humidity?: string
    windspeedKmph?: string
    precipMM?: string
    weatherCode?: string
    localObsDateTime?: string
  }>
  weather?: Array<{ maxtempC?: string; mintempC?: string }>
  nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>
}

interface IpLocation {
  success?: boolean
  city?: string
  latitude?: number
  longitude?: number
}

async function fromOpenMeteo(location: WeatherLocation): Promise<WeatherNow> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  })
  const res = await fetchJson<OpenMeteoCurrent>(`${OPEN_METEO_API}?${params.toString()}`, 6000)
  const cur = res.current
  if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('bad open-meteo payload')

  return {
    temperature: Math.round(cur.temperature_2m),
    apparent: Math.round(cur.apparent_temperature ?? cur.temperature_2m),
    humidity: Math.round(cur.relative_humidity_2m ?? 0),
    wind: Math.round(cur.wind_speed_10m ?? 0),
    precipitation: Number(toNumber(cur.precipitation).toFixed(1)),
    code: cur.weather_code ?? 0,
    isDay: (cur.is_day ?? 1) === 1,
    high: Math.round(res.daily?.temperature_2m_max?.[0] ?? cur.temperature_2m),
    low: Math.round(res.daily?.temperature_2m_min?.[0] ?? cur.temperature_2m),
    observedAt: cur.time ?? '',
    fetchedAt: Date.now(),
    location,
    provider: 'open-meteo',
  }
}

async function fromWttr(location: WeatherLocation): Promise<WeatherNow> {
  const coords = `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`
  const res = await fetchJson<WttrResponse>(`${WTTR_API}/${coords}?format=j1&lang=zh`, 7000)
  const cur = res.current_condition?.[0]
  if (!cur || cur.temp_C == null) throw new Error('bad wttr payload')

  const wwo = toNumber(cur.weatherCode, 113)
  const kind = WWO_KIND_MAP[wwo] ?? 'cloudy'
  const temp = Math.round(toNumber(cur.temp_C))
  const area = res.nearest_area?.[0]?.areaName?.[0]?.value
  const city = location.source === 'ip' && area ? area : location.city

  return {
    temperature: temp,
    apparent: Math.round(toNumber(cur.FeelsLikeC, temp)),
    humidity: Math.round(toNumber(cur.humidity)),
    wind: Math.round(toNumber(cur.windspeedKmph)),
    precipitation: Number(toNumber(cur.precipMM).toFixed(1)),
    code: WWO_TO_WMO[kind],
    isDay: isDaytime(undefined),
    high: Math.round(toNumber(res.weather?.[0]?.maxtempC, temp)),
    low: Math.round(toNumber(res.weather?.[0]?.mintempC, temp)),
    observedAt: cur.localObsDateTime ?? '',
    fetchedAt: Date.now(),
    location: { ...location, city },
    provider: 'wttr',
  }
}

/** 首次进入时解析定位：IP 定位失败则用默认城市，结果本地缓存 */
async function resolveLocation(): Promise<WeatherLocation> {
  const cached = readJson<WeatherLocation>(LOCATION_KEY)
  if (cached?.lat != null && cached?.lon != null) return cached

  try {
    const ip = await fetchJson<IpLocation>(LOCATION_API, 5000)
    if (ip.success !== false && typeof ip.latitude === 'number' && typeof ip.longitude === 'number') {
      const loc: WeatherLocation = {
        lat: ip.latitude,
        lon: ip.longitude,
        city: ip.city || DEFAULT_LOCATION.city,
        source: 'ip',
      }
      writeJson(LOCATION_KEY, loc)
      return loc
    }
  } catch {
    /* 忽略，走默认城市 */
  }
  writeJson(LOCATION_KEY, DEFAULT_LOCATION)
  return { ...DEFAULT_LOCATION }
}

export function useWeather() {
  const cached = readJson<WeatherNow>(CACHE_KEY)
  const valid = !!cached && Date.now() - cached.fetchedAt < CACHE_TTL

  const weather = ref<WeatherNow | null>(valid ? cached : null)
  const loading = ref(!valid)
  const error = ref(false)

  let inFlight = false

  async function load(force = false) {
    if (inFlight) return
    const current = weather.value
    if (!force && current && Date.now() - current.fetchedAt < CACHE_TTL) return

    inFlight = true
    loading.value = true
    try {
      const location = current?.location ?? (await resolveLocation())
      let next: WeatherNow
      try {
        // wttr.in 在国内网络可达性更好，作为主数据源
        next = await fromWttr(location)
      } catch {
        next = await fromOpenMeteo(location)
      }
      weather.value = next
      writeJson(CACHE_KEY, next)
      error.value = false
    } catch {
      // 有旧数据时继续展示旧数据，仅标记失败
      error.value = !weather.value
    } finally {
      loading.value = false
      inFlight = false
    }
  }

  load()

  // 每 15 分钟静默刷新一次
  const timer = setInterval(() => load(true), 15 * 60 * 1000)
  onBeforeUnmount(() => clearInterval(timer))

  return { weather, loading, error, load }
}
