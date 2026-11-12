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
 * 地形 / 倾斜模型表面高程采样
 * - 地形：Cesium.sampleTerrainMostDetailed，最精细层级
 * - 倾斜：Scene.sampleHeightMostDetailed，自动加载 3D Tiles 最精细层级
 * - 分批采样 + 进度回调，避免一次性请求过多瓦片导致页面卡死
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
  let ds: any = null
  let tileset: any = null

  /** 每批采样点数：控制单帧瓦片请求量，同时让进度更细粒度 */
  const CHUNK_SIZE = 10
  /** 倾斜表面采样超时（毫秒），超时的批次按无高程处理，避免整批卡住 */
  const TILT_TIMEOUT = 90_000

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

  /* ---------------- 采样 ---------------- */

  function addMarkers(list: ElevationSample[]) {
    if (!ds || !C) return
    ds.entities.removeAll()
    for (const item of list) {
      if (item.altitude === null) continue
      const isMesh = item.source === 'mesh'
      ds.entities.add({
        position: C.Cartesian3.fromDegrees(item.lon, item.lat, item.altitude),
        point: {
          pixelSize: 8,
          color: C.Color.fromCssColorString(isMesh ? '#f59e0b' : '#2563eb'),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    }
  }

  async function sample(
    list: TablePoint[],
    options: { terrain: boolean; tilt: boolean },
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
    if (options.tilt && !viewer.scene.sampleHeightSupported) {
      sampleError.value = '当前显卡/浏览器不支持表面深度采样'
      return
    }
    if (!list.length || sampling.value) return

    sampling.value = true
    cancelled.value = false
    progress.value = 0
    processed.value = 0
    total.value = list.length
    stage.value = ''
    results.value = []
    if (ds) ds.entities.removeAll()

    const output: ElevationSample[] = list.map((point) => ({
      ...point,
      terrainHeight: null,
      meshHeight: null,
      altitude: null,
      source: '',
    }))

    try {
      for (let start = 0; start < list.length; start += CHUNK_SIZE) {
        if (cancelled.value) break
        const chunk = list.slice(start, start + CHUNK_SIZE)

        // 地形：最精细层级
        const terrainCartos = chunk.map((point) => C.Cartographic.fromDegrees(point.lon, point.lat))
        if (options.terrain) {
          stage.value = 'terrain'
          try {
            await C.sampleTerrainMostDetailed(viewer.terrainProvider, terrainCartos)
          } catch (e: any) {
            if (!sampleError.value) sampleError.value = `地形采样失败：${e?.message || e}`
          }
        }

        // 倾斜：取场景（地形 + 3D Tiles）可见表面，自动加载最精细瓦片
        let surfaceCartos: any[] = []
        if (options.tilt) {
          stage.value = 'tilt'
          surfaceCartos = chunk.map((point) => C.Cartographic.fromDegrees(point.lon, point.lat))
          try {
            await withTimeout(viewer.scene.sampleHeightMostDetailed(surfaceCartos), TILT_TIMEOUT)
          } catch (e: any) {
            if (!sampleError.value) sampleError.value = `倾斜表面采样失败：${e?.message || e}`
          }
        }

        for (let i = 0; i < chunk.length; i++) {
          const item = output[start + i]
          if (options.terrain) {
            const h = terrainCartos[i]?.height
            if (Number.isFinite(h)) item.terrainHeight = round2(h)
          }
          if (options.tilt) {
            const h = surfaceCartos[i]?.height
            if (Number.isFinite(h)) item.meshHeight = round2(h)
          }

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

        processed.value = Math.min(start + CHUNK_SIZE, total.value)
        progress.value = Math.round((processed.value / total.value) * 100)
        results.value = output.slice(0, processed.value)
        await nextFrame()
      }
    } finally {
      const finished = results.value
      sampling.value = false
      stage.value = ''
      addMarkers(finished)
      if (!cancelled.value && ds && ds.entities.values.length) {
        try {
          await viewer.flyTo(ds, { duration: 1.2 })
        } catch {
          /* 视图飞行失败不影响结果 */
        }
      }
    }
  }

  function cancel() {
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
    if (ds) ds.entities.removeAll()
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
    ds = new lib.CustomDataSource('surface-elevation')
    v.dataSources.add(ds)
    resetView()

    return () => {
      cancelled.value = true
      if (!v.isDestroyed?.()) {
        if (ds) v.dataSources.remove(ds, true)
        if (tileset) v.scene.primitives.remove(tileset)
      }
      ds = null
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
