import { ref, shallowRef } from 'vue'
import type { TablePoint } from '@/utils/gis/pointTable'

export interface ElevationSample extends TablePoint {
  /** 地形（DEM）表面高程 */
  terrainHeight: number | null
  /** 倾斜模型 / 倾斜摄影表面高程（含地形，取场景可见表面） */
  meshHeight: number | null
  /** 兜底结果：两者取高 */
  altitude: number | null
  source: 'terrain' | 'mesh' | ''
}

/**
 * 倾斜表面采样模式
 * - fast：tileset.getHeight()，同步射线拾取「当前已加载瓦片」，约 3ms/点，几千点几秒内完成
 * - fine：Scene.sampleHeightMostDetailed()，为每个点排队一次最精细遍历，慢但精度最高
 */
export type TiltMode = 'fast' | 'fine'

export interface ElevationSampleOptions {
  terrain: boolean
  tilt: boolean
  /** 默认 fast */
  tiltMode?: TiltMode
}

/**
 * 地形 / 倾斜模型表面高程采样
 * - 地形：Cesium.sampleTerrainMostDetailed，最精细层级，按 300 点一片提交
 *   （片太小会反复做 0..N 层探测；5000 点用 10 点一片会产生 500 次层级探测，是主要的“卡死”来源）
 * - 倾斜：默认 tileset.getHeight() 同步拾取已加载瓦片，
 *   避免 sampleHeightMostDetailed 每批都等全场景最精细瓦片加载完
 * - 全程分片 + 让出主线程 + 可取消，采样期间 UI 不冻结
 */
export function useCesiumSurfaceElevation() {
  const terrainLoaded = ref(false)
  const terrainLoading = ref(false)
  const terrainError = ref('')
  const tiltLoaded = ref(false)
  const tiltLoading = ref(false)
  const tiltError = ref('')

  const sampling = ref(false)
  const cancelled = ref(false)
  const progress = ref(0)
  const processed = ref(0)
  const total = ref(0)
  const stage = ref<'terrain' | 'tilt' | ''>('')
  const sampleError = ref('')
  const results = shallowRef<ElevationSample[]>([])

  let viewer: any = null
  let C: any = null
  /** 结果点位：点图元集合，上千点也只是一次绘制，比 Entity 轻得多 */
  let markers: any = null
  let tileset: any = null

  /** 采样任务序号：取消 / 重新开始时，旧的 await 回来后不再写结果 */
  let runSeq = 0

  /** 地形每片点数：sampleTerrainMostDetailed 内部逐层级请求瓦片，片太大记忆涨幅明显 */
  const TERRAIN_CHUNK = 300
  /** 快速倾斜每片点数：getHeight 是同步射线拾取，约 3ms/点，120 点一片 ≈ 360ms */
  const MESH_CHUNK = 120
  /** 精细倾斜每片点数：sampleHeightMostDetailed 每个点都会排队一次最精细遍历，不能一次丢太多 */
  const FINE_CHUNK = 20
  /** 单批精细采样超时（毫秒），超时按无高程处理，避免整轮卡住 */
  const FINE_TIMEOUT = 20_000

  const round2 = (value: number) => Math.round(value * 100) / 100

  function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => resolve(undefined), ms)
      promise.then(
        (value) => {
          window.clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          window.clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  /** 香港全景视角（略向北俯瞰） */
  function resetView() {
    if (!viewer || viewer.isDestroyed?.() || !C) return
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(114.06, 22.1, 24000),
      orientation: {
        heading: C.Math.toRadians(2),
        pitch: C.Math.toRadians(-36),
        roll: 0,
      },
    })
  }

  /* ---------------- 地形 ---------------- */

  async function loadTerrain(url: string): Promise<boolean> {
    if (!viewer || viewer.isDestroyed?.() || !C) return false
    const target = url.trim()
    if (!target) {
      terrainError.value = '请填写地形服务地址'
      return false
    }
    terrainLoading.value = true
    terrainError.value = ''
    try {
      let provider: any
      try {
        provider = await C.CesiumTerrainProvider.fromUrl(target, { requestVertexNormals: true })
      } catch {
        // 部分服务不支持法线参数，去掉后重试一次
        provider = await C.CesiumTerrainProvider.fromUrl(target)
      }
      if (!viewer || viewer.isDestroyed?.()) return false
      viewer.terrainProvider = provider
      terrainLoaded.value = true
      return true
    } catch (e: any) {
      terrainLoaded.value = false
      terrainError.value = `地形加载失败：${e?.message || e}`
      return false
    } finally {
      terrainLoading.value = false
    }
  }

  function unloadTerrain() {
    if (!viewer || viewer.isDestroyed?.() || !C) return
    viewer.terrainProvider = new C.EllipsoidTerrainProvider()
    terrainLoaded.value = false
    terrainError.value = ''
  }

  /* ---------------- 倾斜模型 ---------------- */

  async function loadTilt(url: string): Promise<boolean> {
    if (!viewer || viewer.isDestroyed?.() || !C) return false
    const target = url.trim()
    if (!target) {
      tiltError.value = '请填写倾斜模型地址'
      return false
    }
    tiltLoading.value = true
    tiltError.value = ''
    try {
      const next = await C.Cesium3DTileset.fromUrl(target, { maximumScreenSpaceError: 16 })
      if (!viewer || viewer.isDestroyed?.()) {
        next.destroy?.()
        return false
      }
      if (tileset) {
        viewer.scene.primitives.remove(tileset)
        tileset = null
      }
      viewer.scene.primitives.add(next)
      next.show = true
      tileset = next
      tiltLoaded.value = true
      return true
    } catch (e: any) {
      tiltLoaded.value = false
      tiltError.value = `倾斜模型加载失败：${e?.message || e}`
      return false
    } finally {
      tiltLoading.value = false
    }
  }

  function unloadTilt() {
    if (!viewer || viewer.isDestroyed?.()) return
    if (tileset) {
      viewer.scene.primitives.remove(tileset)
      tileset = null
    }
    tiltLoaded.value = false
    tiltError.value = ''
  }

  /* ---------------- 结果与标记 ---------------- */

  /** 两者取高作为最终高度 */
  function composeAltitude(item: ElevationSample) {
    const terrainHeight = item.terrainHeight
    const meshHeight = item.meshHeight
    if (terrainHeight !== null && meshHeight !== null) {
      if (meshHeight > terrainHeight) {
        item.altitude = meshHeight
        item.source = 'mesh'
      } else {
        item.altitude = terrainHeight
        item.source = 'terrain'
      }
    } else if (terrainHeight !== null) {
      item.altitude = terrainHeight
      item.source = 'terrain'
    } else if (meshHeight !== null) {
      item.altitude = meshHeight
      item.source = 'mesh'
    }
  }

  function addMarkers(list: ElevationSample[]) {
    if (!markers || !C) return
    markers.removeAll()
    for (const item of list) {
      if (item.altitude === null) continue
      markers.add({
        position: C.Cartesian3.fromDegrees(item.lon, item.lat, item.altitude),
        pixelSize: 8,
        color: C.Color.fromCssColorString(item.source === 'mesh' ? '#f59e0b' : '#2563eb'),
        outlineColor: C.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
    }
  }

  function flyToResults(list: ElevationSample[]) {
    if (!viewer || viewer.isDestroyed?.() || !C) return
    const positions: any[] = []
    for (const item of list) {
      if (item.altitude === null) continue
      positions.push(C.Cartesian3.fromDegrees(item.lon, item.lat, item.altitude))
    }
    if (!positions.length) return
    const sphere = C.BoundingSphere.fromPoints(positions)
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.2,
      offset: new C.HeadingPitchRange(0, C.Math.toRadians(-60), Math.max(sphere.radius * 2.2, 800)),
    })
  }

  /** 把本片采样到的 height 回填到结果 */
  function applyHeights(
    output: ElevationSample[],
    key: 'terrain' | 'mesh',
    start: number,
    cartos: any[],
  ) {
    for (let i = 0; i < cartos.length; i++) {
      const h = cartos[i]?.height
      if (!Number.isFinite(h)) continue
      const item = output[start + i]
      if (!item) continue
      if (key === 'terrain') item.terrainHeight = round2(h)
      else item.meshHeight = round2(h)
      composeAltitude(item)
    }
  }

  /** 快速倾斜：同步射线拾取当前已加载瓦片，返回本片是否有结果 */
  function sampleMeshFast(cartos: any[]) {
    if (!tileset || !viewer) return
    const scene = viewer.scene
    for (const carto of cartos) {
      let h: number | undefined
      try {
        h = tileset.getHeight(carto, scene)
      } catch {
        h = undefined
      }
      if (Number.isFinite(h)) carto.height = h
    }
  }

  /**
   * 采样主流程
   * 地形阶段占 45% 进度，倾斜阶段占 55%（只勾一个时各占 100%）
   */
  async function sample(
    list: TablePoint[],
    options: ElevationSampleOptions,
  ): Promise<void> {
    sampleError.value = ''
    if (!viewer || viewer.isDestroyed?.() || !C) {
      sampleError.value = 'Cesium 尚未就绪'
      return
    }
    if (!options.terrain && !options.tilt) {
      sampleError.value = '请至少勾选地形或倾斜表面'
      return
    }
    if (options.terrain && !terrainLoaded.value) {
      sampleError.value = '地形尚未加载'
      return
    }
    if (options.tilt && !tiltLoaded.value) {
      sampleError.value = '倾斜模型尚未加载'
      return
    }
    const tiltMode: TiltMode = options.tiltMode ?? 'fast'
    if (options.tilt && tiltMode === 'fine' && !viewer.scene.sampleHeightSupported) {
      sampleError.value = '当前显卡/浏览器不支持表面深度采样，请改用快速模式'
      return
    }
    if (!list.length || sampling.value) return

    const seq = ++runSeq
    const count = list.length
    const alive = () => seq === runSeq && !cancelled.value && !!viewer && !!C

    sampling.value = true
    cancelled.value = false
    progress.value = 0
    processed.value = 0
    total.value = count
    stage.value = ''
    results.value = []
    addMarkers([])

    const output: ElevationSample[] = list.map((point) => ({
      ...point,
      terrainHeight: null,
      meshHeight: null,
      altitude: null,
      source: '',
    }))
    const cartos: any[] = list.map((point) => C.Cartographic.fromDegrees(point.lon, point.lat))

    const both = options.terrain && options.tilt
    const terrainSpan = both ? 45 : 100
    const tiltBase = both ? 45 : 0
    const tiltSpan = both ? 55 : 100

    const publish = (until: number, percent: number) => {
      processed.value = until
      progress.value = Math.min(99, Math.round(percent))
      results.value = output.slice(0, until)
    }

    try {
      /* 1) 地形：大分片，避免每个小片都重新做「0 层 → 最精细层」探测 */
      if (options.terrain) {
        stage.value = 'terrain'
        for (let start = 0; start < count; start += TERRAIN_CHUNK) {
          if (!alive()) return
          const end = Math.min(start + TERRAIN_CHUNK, count)
          const chunk = cartos.slice(start, end)
          try {
            await C.sampleTerrainMostDetailed(viewer.terrainProvider, chunk)
          } catch (e: any) {
            if (!sampleError.value) sampleError.value = `地形采样失败：${e?.message || e}`
          }
          if (!alive()) return
          applyHeights(output, 'terrain', start, chunk)
          publish(end, (terrainSpan * end) / count)
          await nextFrame()
        }
      }

      /* 2) 倾斜：快速模式同步拾取已加载瓦片；精细模式分批走最精细遍历 */
      if (options.tilt) {
        stage.value = 'tilt'
        const chunkSize = tiltMode === 'fine' ? FINE_CHUNK : MESH_CHUNK
        for (let start = 0; start < count; start += chunkSize) {
          if (!alive()) return
          const end = Math.min(start + chunkSize, count)
          const chunk = cartos.slice(start, end)
          if (tiltMode === 'fine') {
            try {
              await withTimeout(viewer.scene.sampleHeightMostDetailed(chunk), FINE_TIMEOUT)
            } catch (e: any) {
              if (!sampleError.value) sampleError.value = `倾斜表面采样失败：${e?.message || e}`
            }
          } else {
            sampleMeshFast(chunk)
          }
          if (!alive()) return
          applyHeights(output, 'mesh', start, chunk)
          publish(count, tiltBase + (tiltSpan * end) / count)
          await nextFrame()
        }
      }

      if (!alive()) return
      progress.value = 100
      processed.value = count
      results.value = output
    } finally {
      if (seq === runSeq) {
        const finished = results.value
        sampling.value = false
        stage.value = ''
        addMarkers(finished)
        if (!cancelled.value && finished.length) flyToResults(finished)
      }
    }
  }

  function cancel() {
    // 只置取消标记：正在 await 的采样回来后由 alive() 判断退出，并正常收尾
    if (sampling.value) cancelled.value = true
  }

  /** 飞到结果点上方俯视查看 */
  function flyToPoint(lon: number, lat: number, altitude: number | null) {
    if (!viewer || viewer.isDestroyed?.() || !C) return
    const ground = Number.isFinite(altitude) ? (altitude as number) : 0
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(lon, lat, Math.max(ground, 0) + 1200),
      orientation: {
        heading: 0,
        pitch: C.Math.toRadians(-50),
        roll: 0,
      },
      duration: 1.5,
    })
  }

  function clear() {
    cancelled.value = true
    addMarkers([])
    results.value = []
    processed.value = 0
    total.value = 0
    progress.value = 0
    stage.value = ''
    sampleError.value = ''
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    markers = new lib.PointPrimitiveCollection()
    v.scene.primitives.add(markers)
    resetView()

    return () => {
      cancelled.value = true
      runSeq++
      if (!v.isDestroyed?.()) {
        if (markers) v.scene.primitives.remove(markers)
        if (tileset) v.scene.primitives.remove(tileset)
      }
      markers = null
      tileset = null
      viewer = null
      C = null
      terrainLoaded.value = false
      tiltLoaded.value = false
      results.value = []
    }
  })

  return {
    terrainLoaded,
    terrainLoading,
    terrainError,
    tiltLoaded,
    tiltLoading,
    tiltError,
    sampling,
    progress,
    processed,
    total,
    stage,
    sampleError,
    results,
    loadTerrain,
    unloadTerrain,
    loadTilt,
    unloadTilt,
    sample,
    cancel,
    clear,
    resetView,
    flyToPoint,
  }
}
