import { reactive, ref } from 'vue'

export interface GeoServerLayer {
  id: number
  type: 'wms' | 'wfs'
  label: string
  /** WMS 用 ImageryLayer，WFS 用 GeoJsonDataSource */
  target: any
}

/**
 * GeoServer 服务图层：WMS 影像叠加 + WFS 矢量加载
 * - WMS 使用 WebMapServiceImageryProvider，直接叠加到底图之上
 * - WFS 请求 GeoJSON 后交给 GeoJsonDataSource，按要素渲染并缩放到数据范围
 * - 卸载 / 清空时统一移除影像图层与数据源
 */
export function useCesiumGeoServer() {
  const state = reactive({
    wmsUrl: 'https://ahocevar.com/geoserver/wms',
    wfsUrl: 'https://ahocevar.com/geoserver/wfs',
    layerName: 'topp:states',
    loading: false,
    error: '',
  })

  const layers = ref<GeoServerLayer[]>([])
  let viewer: any = null
  let C: any = null
  let seq = 0

  function push(layer: GeoServerLayer) {
    layers.value = [...layers.value, layer]
  }

  async function loadWms(url = state.wmsUrl, layerName = state.layerName) {
    if (!viewer || !url || !layerName) return
    state.error = ''
    state.loading = true
    try {
      const provider = new C.WebMapServiceImageryProvider({
        url,
        layers: layerName,
        parameters: {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          format: 'image/png',
          transparent: true,
        },
      })
      const layer = viewer.imageryLayers.addImageryProvider(provider)
      push({ id: ++seq, type: 'wms', label: layerName, target: layer })
      if (provider.rectangle) {
        await viewer.camera.flyTo({ destination: provider.rectangle, duration: 1.2 })
      }
    } catch (e: any) {
      state.error = e?.message || 'WMS 图层加载失败，请检查地址与服务是否可用'
    } finally {
      state.loading = false
    }
  }

  async function loadWfs(url = state.wfsUrl, layerName = state.layerName) {
    if (!viewer || !url || !layerName) return
    state.error = ''
    state.loading = true
    try {
      const requestUrl =
        `${url}?service=WFS&version=1.0.0&request=GetFeature` +
        `&typeName=${encodeURIComponent(layerName)}&outputFormat=application/json` +
        `&srsName=EPSG:4326&maxFeatures=5000`
      const response = await fetch(requestUrl)
      if (!response.ok) throw new Error(`WFS 请求失败：HTTP ${response.status}`)
      const geojson = await response.json()
      if (!viewer || viewer.isDestroyed?.()) return

      const ds = await C.GeoJsonDataSource.load(geojson, {
        stroke: C.Color.fromCssColorString('#2563eb'),
        fill: C.Color.fromCssColorString('#2563eb').withAlpha(0.18),
        strokeWidth: 2,
        clampToGround: false,
      })
      await viewer.dataSources.add(ds)
      push({ id: ++seq, type: 'wfs', label: layerName, target: ds })
      await viewer.flyTo(ds, { duration: 1.2 })
    } catch (e: any) {
      state.error = e?.message || 'WFS 图层加载失败，请检查地址与服务是否可用'
    } finally {
      state.loading = false
    }
  }

  function remove(id: number) {
    const layer = layers.value.find((l) => l.id === id)
    if (!layer || !viewer || viewer.isDestroyed?.()) return
    if (layer.type === 'wms') viewer.imageryLayers.remove(layer.target, true)
    else viewer.dataSources.remove(layer.target, true)
    layers.value = layers.value.filter((l) => l.id !== id)
  }

  function clear() {
    if (!viewer || viewer.isDestroyed?.()) {
      layers.value = []
      return
    }
    layers.value.forEach((l) => {
      if (l.type === 'wms') viewer.imageryLayers.remove(l.target, true)
      else viewer.dataSources.remove(l.target, true)
    })
    layers.value = []
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    return () => {
      clear()
      viewer = null
      C = null
    }
  })

  return { state, layers, loadWms, loadWfs, remove, clear }
}
