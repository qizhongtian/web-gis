import { ref } from 'vue'

export interface BasemapOption {
  id: string
  label: string
  url: string
  maximumLevel?: number
  credit?: string
  subdomains?: string[]
}

/** 常用免 key 底图（高德 / GeoQ 为 GCJ-02，与 WGS84 存在偏移，仅作演示） */
export const BASEMAPS: BasemapOption[] = [
  { id: 'osm', label: 'OSM 街道', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maximumLevel: 19 },
  {
    id: 'arcgis-image',
    label: 'ArcGIS 影像',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
  },
  {
    id: 'arcgis-street',
    label: 'ArcGIS 街道',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
  },
  {
    id: 'amap-vector',
    label: '高德矢量',
    url: 'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    maximumLevel: 18,
  },
  {
    id: 'amap-image',
    label: '高德影像',
    url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    maximumLevel: 18,
  },
  {
    id: 'geoq-gray',
    label: 'GeoQ 灰度',
    url: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetGray/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 18,
  },
  {
    id: 'carto-dark',
    label: 'Carto 深色',
    url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    maximumLevel: 19,
  },
]

export interface TerrainState {
  enabled: boolean
  loading: boolean
  error: string
  exaggeration: number
  url: string
}

/**
 * 底图与地形管理
 * - 底图切换：移除旧图层后重建（避免图层堆叠导致的内存增长）
 * - 地形：CesiumTerrainProvider（可配置 URL），失败自动回退椭球体
 */
export function useCesiumBasemap() {
  const current = ref('osm')
  const terrain = ref<TerrainState>({
    enabled: false,
    loading: false,
    error: '',
    exaggeration: 1,
    // 留空表示使用 Cesium 世界地形（需在 .env 配置 VITE_CESIUM_TOKEN）
    url: '',
  })

  let viewer: any = null
  let C: any = null

  function applyBasemap(id: string) {
    if (!viewer) return
    const option = BASEMAPS.find((b) => b.id === id) || BASEMAPS[0]
    const provider = new C.UrlTemplateImageryProvider({
      url: option.url,
      maximumLevel: option.maximumLevel,
      credit: option.credit || '',
    })
    viewer.imageryLayers.removeAll(true)
    viewer.imageryLayers.addImageryProvider(provider)
    current.value = option.id
  }

  async function setTerrain(enabled: boolean, url?: string) {
    if (!viewer) return
    if (url) terrain.value.url = url
    terrain.value.error = ''

    if (!enabled) {
      viewer.terrainProvider = new C.EllipsoidTerrainProvider()
      terrain.value.enabled = false
      return
    }

    terrain.value.loading = true
    try {
      let provider: any
      if (terrain.value.url) {
        provider = await C.CesiumTerrainProvider.fromUrl(terrain.value.url, {
          requestVertexNormals: true,
        })
      } else if (C.createWorldTerrainAsync) {
        provider = await C.createWorldTerrainAsync()
      } else {
        throw new Error('请填写地形服务地址，或配置 VITE_CESIUM_TOKEN 使用 Cesium 世界地形')
      }
      if (!viewer || viewer.isDestroyed?.()) return
      viewer.terrainProvider = provider
      terrain.value.enabled = true
    } catch (e: any) {
      terrain.value.error =
        e?.message || '地形服务加载失败：请填写自建地形地址，或配置 VITE_CESIUM_TOKEN 使用 Cesium 世界地形'
      terrain.value.enabled = false
      if (viewer && !viewer.isDestroyed?.()) viewer.terrainProvider = new C.EllipsoidTerrainProvider()
    } finally {
      terrain.value.loading = false
    }
  }

  function setExaggeration(value: number) {
    terrain.value.exaggeration = value
    if (!viewer) return
    // 不同 Cesium 版本属性名不同，做兼容
    if ('verticalExaggeration' in viewer.scene) viewer.scene.verticalExaggeration = value
    else if (viewer.scene.globe) viewer.scene.globe.terrainExaggeration = value
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    return () => {
      if (v.isDestroyed?.()) return
      v.imageryLayers.removeAll(true)
      v.terrainProvider = new C.EllipsoidTerrainProvider()
      viewer = null
      C = null
    }
  })

  return { current, terrain, applyBasemap, setTerrain, setExaggeration }
}
