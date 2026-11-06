import { ref } from 'vue'

export interface TrackPoint {
  lon: number
  lat: number
  height: number
}

/** 默认轨迹：维多利亚港环线（约 15km） */
export const DEFAULT_TRACK: TrackPoint[] = [
  { lon: 114.1588, lat: 22.282, height: 260 },
  { lon: 114.1712, lat: 22.2848, height: 280 },
  { lon: 114.1868, lat: 22.2895, height: 300 },
  { lon: 114.2012, lat: 22.2936, height: 300 },
  { lon: 114.2148, lat: 22.2905, height: 280 },
  { lon: 114.2237, lat: 22.2818, height: 260 },
  { lon: 114.2203, lat: 22.27, height: 240 },
  { lon: 114.2081, lat: 22.2622, height: 220 },
  { lon: 114.1936, lat: 22.2588, height: 200 },
  { lon: 114.1791, lat: 22.2601, height: 180 },
  { lon: 114.1665, lat: 22.2663, height: 200 },
  { lon: 114.1588, lat: 22.282, height: 260 },
]

/** 轨迹基准速度（米 / 秒），决定轨迹时间轴长度 */
const BASE_SPEED = 60

/**
 * 轨迹回放
 * - SampledPositionProperty 按距离分配时间，速度与间距无关
 * - viewer.clock 控制时间轴（CLAMPED），进度由 clock.onTick 回推
 * - 卸载时停止时钟、移除实体与 tick 监听
 */
export function useCesiumTrackPlayback() {
  const loaded = ref(false)
  const playing = ref(false)
  const progress = ref(0)
  const speed = ref(10)
  const distance = ref(0)
  const duration = ref(0)
  const pointCount = ref(0)

  let viewer: any = null
  let C: any = null
  let moving: any = null
  let route: any = null
  let startTime: any = null
  let stopTime: any = null
  let tick: any = null

  function applySpeed(value: number) {
    speed.value = value
    if (viewer?.clock) viewer.clock.multiplier = value
  }

  function updateProgress() {
    if (!startTime || !stopTime || !viewer) return
    const total = C.JulianDate.secondsDifference(stopTime, startTime)
    if (!total) return
    const current = C.JulianDate.secondsDifference(viewer.clock.currentTime, startTime)
    progress.value = Math.min(1, Math.max(0, current / total))
  }

  function load(points: TrackPoint[] = DEFAULT_TRACK) {
    if (!viewer || viewer.isDestroyed?.()) return
    remove()

    const valid = points.filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
    if (valid.length < 2) return

    const positions = valid.map((p) => C.Cartesian3.fromDegrees(p.lon, p.lat, p.height))
    let total = 0
    const offsets: number[] = [0]
    for (let i = 1; i < positions.length; i++) {
      total += C.Cartesian3.distance(positions[i - 1], positions[i])
      offsets.push(total)
    }

    const seconds = total / BASE_SPEED
    const start = C.JulianDate.now()
    startTime = start
    stopTime = C.JulianDate.addSeconds(start, seconds, new C.JulianDate())

    const property = new C.SampledPositionProperty()
    property.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: C.LagrangePolynomialApproximation,
    })
    positions.forEach((position: any, i: number) => {
      property.addSample(C.JulianDate.addSeconds(start, offsets[i] / BASE_SPEED, new C.JulianDate()), position)
    })

    route = viewer.entities.add({
      polyline: {
        positions,
        width: 2,
        material: C.Color.fromCssColorString('#2563eb').withAlpha(0.45),
      },
    })

    const highlight = C.Color.fromCssColorString('#f59e0b')
    moving = viewer.entities.add({
      availability: new C.TimeInterval({ start: start.clone(), stop: stopTime.clone() }),
      position: property,
      point: {
        pixelSize: 12,
        color: highlight,
        outlineColor: C.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '巡检车',
        font: '12px MiSans, sans-serif',
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.72),
        backgroundPadding: new C.Cartesian2(6, 3),
        pixelOffset: new C.Cartesian2(0, -18),
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      path: {
        resolution: 2,
        width: 5,
        trailTime: seconds,
        leadTime: 0,
        material: new C.PolylineGlowMaterialProperty({ color: highlight, glowPower: 0.25 }),
      },
    })

    const clock = viewer.clock
    clock.startTime = start.clone()
    clock.stopTime = stopTime.clone()
    clock.currentTime = start.clone()
    clock.clockRange = C.ClockRange.CLAMPED
    clock.clockStep = C.ClockStep.SYSTEM_CLOCK_MULTIPLIER
    clock.multiplier = speed.value
    clock.shouldAnimate = false

    tick = () => updateProgress()
    clock.onTick.addEventListener(tick)

    distance.value = Math.round(total)
    duration.value = Math.round(seconds)
    pointCount.value = valid.length
    loaded.value = true
    playing.value = false
    progress.value = 0

    void viewer.flyTo(viewer.entities, { duration: 1.2 })
  }

  function play() {
    if (!viewer || !loaded.value) return
    if (progress.value >= 1) viewer.clock.currentTime = startTime.clone()
    viewer.clock.shouldAnimate = true
    playing.value = true
  }

  function pause() {
    if (!viewer) return
    viewer.clock.shouldAnimate = false
    playing.value = false
  }

  function toggle() {
    if (playing.value) pause()
    else play()
  }

  function restart() {
    if (!viewer || !startTime) return
    viewer.clock.currentTime = startTime.clone()
    progress.value = 0
    play()
  }

  function seek(value: number) {
    if (!viewer || !startTime || !stopTime) return
    const total = C.JulianDate.secondsDifference(stopTime, startTime)
    viewer.clock.currentTime = C.JulianDate.addSeconds(startTime, total * value, new C.JulianDate())
    progress.value = value
  }

  function remove() {
    const clock = viewer?.clock
    if (clock && tick) clock.onTick.removeEventListener(tick)
    tick = null
    if (viewer && !viewer.isDestroyed?.()) {
      if (moving) viewer.entities.remove(moving)
      if (route) viewer.entities.remove(route)
    }
    moving = null
    route = null
    startTime = null
    stopTime = null
    if (clock) {
      clock.shouldAnimate = false
      clock.multiplier = 1
    }
    loaded.value = false
    playing.value = false
    progress.value = 0
    distance.value = 0
    duration.value = 0
    pointCount.value = 0
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    return () => {
      pause()
      remove()
      viewer = null
      C = null
    }
  })

  return { loaded, playing, progress, speed, distance, duration, pointCount, load, play, pause, toggle, restart, seek, applySpeed, remove }
}
