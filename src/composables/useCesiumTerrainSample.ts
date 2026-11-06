import { ref, shallowRef } from 'vue'
import { wgs84ToHk80 } from '@/utils/gis/coord'

export interface SamplePoint {
  id: string | number
  lon: number
  lat: number
  height: number
  hk80E: number
  hk80N: number
}

export interface SampleInput {
  id?: string | number
  lon: number
  lat: number
}

/**
 * 地形高程采样
 * - 批量使用 Cesium.sampleTerrainMostDetailed（最精细层级）
 * - 采样结果贴地打点并标注高程，同时给出 HK80 投影坐标
 * - 全部实体放在 CustomDataSource 中，清空 / 卸载一次性移除
 */
export function useCesiumTerrainSample() {
  const sampling = ref(false)
  const error = ref('')
  const points = shallowRef<SamplePoint[]>([])

  let viewer: any = null
  let C: any = null
  let ds: any = null

  function addMarker(p: SamplePoint) {
    if (!ds) return
    ds.entities.add({
      position: C.Cartesian3.fromDegrees(p.lon, p.lat, p.height),
      point: {
        pixelSize: 9,
        color: C.Color.fromCssColorString('#0ea5e9'),
        outlineColor: C.Color.WHITE,
        outlineWidth: 2,
        heightReference: C.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${p.id} · ${p.height.toFixed(1)}m`,
        font: '12px MiSans, sans-serif',
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.72),
        backgroundPadding: new C.Cartesian2(6, 3),
        pixelOffset: new C.Cartesian2(0, -16),
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  async function sample(list: SampleInput[], append = false) {
    if (!viewer || viewer.isDestroyed?.() || !list.length) return
    error.value = ''
    sampling.value = true
    if (!append) clearMarkers()
    try {
      const cartographics = list.map((p) => C.Cartographic.fromDegrees(p.lon, p.lat))
      const sampled = await C.sampleTerrainMostDetailed(viewer.terrainProvider, cartographics)
      if (!viewer || viewer.isDestroyed?.()) return

      const mapped: SamplePoint[] = sampled.map((carto: any, i: number) => {
        const lon = list[i].lon
        const lat = list[i].lat
        const [hk80E, hk80N] = wgs84ToHk80(lon, lat)
        return {
          id: list[i].id ?? i + 1,
          lon,
          lat,
          height: Number.isFinite(carto.height) ? Number(carto.height.toFixed(2)) : 0,
          hk80E,
          hk80N,
        }
      })
      points.value = append ? [...points.value, ...mapped] : mapped
      mapped.forEach(addMarker)
      if (!append && ds && ds.entities.values.length) await viewer.flyTo(ds, { duration: 1.2 })
    } catch (e: any) {
      error.value = e?.message || '地形采样失败，请确认已启用地形服务'
    } finally {
      sampling.value = false
    }
  }

  /** 点击屏幕位置采样单点（用于地图交互采样） */
  async function sampleScreen(screenPos: any) {
    if (!viewer || viewer.isDestroyed?.()) return
    const ray = viewer.camera.getPickRay(screenPos)
    const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null
    if (!cartesian) return
    const carto = C.Cartographic.fromCartesian(cartesian)
    await sample(
      [
        {
          id: `P${points.value.length + 1}`,
          lon: C.Math.toDegrees(carto.longitude),
          lat: C.Math.toDegrees(carto.latitude),
        },
      ],
      true,
    )
  }

  function clearMarkers() {
    if (ds && !viewer?.isDestroyed?.()) ds.entities.removeAll()
    points.value = []
  }

  function clear() {
    clearMarkers()
    error.value = ''
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    ds = new lib.CustomDataSource('terrain-samples')
    v.dataSources.add(ds)
    return () => {
      if (!v.isDestroyed?.()) v.dataSources.remove(ds, true)
      ds = null
      points.value = []
      viewer = null
      C = null
    }
  })

  return { sampling, error, points, sample, sampleScreen, clear }
}
