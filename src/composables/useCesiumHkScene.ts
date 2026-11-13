import { ref } from 'vue'
import { onCesiumReady } from '@/composables/useCesium'
import {
  DEFAULT_IMAGERY_MAX_LEVEL,
  DEFAULT_IMAGERY_URL,
  applyIonToken,
  createTerrainProvider,
  defaultMeshTilesetUrl,
  defaultTerrainServiceUrl,
  defaultTerrainUrl,
  getDefaultCamera,
} from '@/utils/gis/cesiumConfig'

export interface HkSceneOptions {
  /** 是否换成香港影像底图，默认 true */
  imagery?: boolean
  /** 是否加载真实地形，默认 true */
  terrain?: boolean
  /** 是否加载香港倾斜摄影模型，默认 true */
  tileset?: boolean
  /** 是否把相机切到默认香港视角，默认 true */
  camera?: boolean
}

/**
 * 香港默认场景：影像底图 + 地形 + 倾斜摄影 + 默认视角。
 * 只能在 <CesiumViewer> 的子孙组件中调用；销毁时自动还原地形、移除模型。
 */
export function useCesiumHkScene(options: HkSceneOptions = {}) {
  const opts: Required<HkSceneOptions> = {
    imagery: options.imagery !== false,
    terrain: options.terrain !== false,
    tileset: options.tileset !== false,
    camera: options.camera !== false,
  }

  const terrainLoading = ref(false)
  const tilesetLoading = ref(false)
  const error = ref('')

  function applyImagery(C: any, v: any) {
    const provider = new C.UrlTemplateImageryProvider({
      url: DEFAULT_IMAGERY_URL,
      maximumLevel: DEFAULT_IMAGERY_MAX_LEVEL,
      credit: '',
    })
    v.imageryLayers.removeAll(true)
    v.imageryLayers.addImageryProvider(provider)
  }

  async function applyTerrain(C: any, v: any) {
    terrainLoading.value = true
    try {
      // 有自建地址用自建，否则用全球高程服务；provider 类型由工厂按地址判断
      const provider = await createTerrainProvider(C, defaultTerrainUrl || defaultTerrainServiceUrl)
      if (v.isDestroyed?.()) return
      v.terrainProvider = provider
    } catch (e: any) {
      error.value = e?.message || '地形加载失败'
      if (!v.isDestroyed?.()) v.terrainProvider = new C.EllipsoidTerrainProvider()
    } finally {
      terrainLoading.value = false
    }
  }

  async function applyTileset(C: any, v: any) {
    if (!defaultMeshTilesetUrl) return
    tilesetLoading.value = true
    try {
      const tileset = C.Cesium3DTileset?.fromUrl
        ? await C.Cesium3DTileset.fromUrl(defaultMeshTilesetUrl, { maximumScreenSpaceError: 16 })
        : await new C.Cesium3DTileset({ url: defaultMeshTilesetUrl })
      if (v.isDestroyed?.()) {
        tileset.destroy?.()
        return
      }
      v.scene.primitives.add(tileset)
      ;(v as any).__hkTileset = tileset
    } catch (e: any) {
      error.value = e?.message || '倾斜摄影模型加载失败'
    } finally {
      tilesetLoading.value = false
    }
  }

  onCesiumReady((v, C) => {
    applyIonToken(C)
    if (opts.imagery) applyImagery(C, v)
    if (opts.terrain) applyTerrain(C, v)
    if (opts.tileset) applyTileset(C, v)
    if (opts.camera) v.camera.setView(getDefaultCamera(C))

    return () => {
      if (v.isDestroyed?.()) return
      const tileset = (v as any).__hkTileset
      if (tileset) {
        v.scene.primitives.remove(tileset)
        ;(v as any).__hkTileset = null
      }
      v.terrainProvider = new C.EllipsoidTerrainProvider()
    }
  })

  return { terrainLoading, tilesetLoading, error }
}
