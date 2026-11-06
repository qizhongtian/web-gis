import { inject, ref, shallowRef, type InjectionKey } from 'vue'
import {
  loadVectorLayer,
  type LoadedVectorLayer,
  type VectorLayerPayload,
  type VectorType,
} from '@/utils/gis/vectorLayerLoader'

/** 图层列表项（纯数据，供 UI 渲染，不持有 Cesium 对象） */
export interface VectorLayerItem {
  id: string
  name: string
  createTime: string
  type: VectorType
  count: number
  enabled: boolean
  /** 是否走了贴地兜底（无高程数据） */
  clamped: boolean
}

/**
 * 页面缓存键：只存纯数据（payload）不含 Cesium 对象，
 * 切走页面或刷新后都能按同样的加载函数重建图层。
 */
const CACHE_KEY = 'wg-vector-layers'

function readCache(): VectorLayerPayload[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeCache(list: VectorLayerPayload[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(list))
  } catch {
    /* 数据超出存储配额或环境不可用时忽略，仅保留内存状态 */
  }
}

/**
 * 矢量图层管理：新增 / 显隐 / 定位 / 删除
 * - 真正的 Cesium 对象存在 datasets 里，避免 Vue 深度代理
 * - 纯数据 payload 同步缓存到 sessionStorage，刷新后可恢复
 * - 卸载时销毁全部数据源（但保留缓存，下次进入再恢复）
 */
export function useCesiumVectorLayers() {
  const items = ref<VectorLayerItem[]>([])
  const error = ref('')
  const viewer = shallowRef<any>()
  const C = shallowRef<any>()
  const datasets = new Map<string, LoadedVectorLayer>()
  /** 与 items 对应的原始数据，用于缓存 / 重建 */
  const payloads = new Map<string, VectorLayerPayload>()

  function persist() {
    writeCache([...payloads.values()])
  }

  /** 点击图层名称定位 */
  function flyTo(id: string) {
    const v = viewer.value
    const lib = C.value
    const layer = datasets.get(id)
    if (!v || v.isDestroyed?.() || !lib || !layer) return
    if (!layer.boundingSphere) return
    const radius = Math.max(layer.boundingSphere.radius, 80)
    v.camera.flyToBoundingSphere(layer.boundingSphere, {
      duration: 1.2,
      offset: new lib.HeadingPitchRange(0, lib.Math.toRadians(-55), radius * 3.2),
    })
  }

  /**
   * 添加图层（前端上传或后端接口返回都走这里）
   * @param remember 是否写入缓存，批量恢复时传 false 由外层统一写
   */
  function add(payload: VectorLayerPayload, remember = true) {
    error.value = ''
    const v = viewer.value
    const lib = C.value
    if (!v || v.isDestroyed?.() || !lib) {
      error.value = '地图尚未就绪'
      return null
    }
    try {
      const loaded = loadVectorLayer(v, lib, payload)
      if (!loaded.count) {
        error.value = '没有可渲染的要素'
        v.dataSources.remove(loaded.dataSource, true)
        return null
      }
      datasets.set(loaded.id, loaded)
      payloads.set(loaded.id, payload)
      items.value = [
        ...items.value,
        {
          id: loaded.id,
          name: loaded.name,
          createTime: loaded.createTime,
          type: loaded.type,
          count: loaded.count,
          enabled: payload.enabled !== false,
          clamped: loaded.clamped,
        },
      ]
      if (remember) persist()
      return loaded
    } catch (e: any) {
      error.value = e?.message || '图层加载失败'
      return null
    }
  }

  /** 从缓存恢复（刷新 / 重新进入页面时调用） */
  function restore() {
    const list = readCache()
    if (!list.length) return 0
    let ok = 0
    list.forEach((payload) => {
      if (add(payload, false)) ok += 1
    })
    // 归一化：剔除加载失败的脏数据
    persist()
    return ok
  }

  /** 显隐 */
  function setVisible(id: string, visible: boolean) {
    const layer = datasets.get(id)
    if (layer?.dataSource) layer.dataSource.show = visible
    const item = items.value.find((it) => it.id === id)
    if (item) item.enabled = visible
    const payload = payloads.get(id)
    if (payload) payload.enabled = visible
    persist()
  }

  /** 删除单个 */
  function remove(id: string) {
    const layer = datasets.get(id)
    const v = viewer.value
    if (layer && v && !v.isDestroyed?.()) v.dataSources.remove(layer.dataSource, true)
    datasets.delete(id)
    payloads.delete(id)
    items.value = items.value.filter((it) => it.id !== id)
    persist()
  }

  /**
   * 清空全部
   * @param keepCache 卸载时保留缓存（true），用户主动清空时删除缓存（false）
   */
  function clear(keepCache = false) {
    const v = viewer.value
    datasets.forEach((layer) => {
      if (v && !v.isDestroyed?.()) v.dataSources.remove(layer.dataSource, true)
    })
    datasets.clear()
    payloads.clear()
    items.value = []
    error.value = ''
    if (!keepCache) persist()
  }

  onCesiumReady((v, lib) => {
    viewer.value = v
    C.value = lib
    // 刷新 / 重新进入页面：按缓存重建图层
    restore()
    return () => {
      // 组件销毁只清内存，缓存留着供下次进入恢复
      clear(true)
      viewer.value = undefined
      C.value = undefined
    }
  })

  return { items, error, add, restore, setVisible, remove, clear, flyTo }
}

export type VectorLayersStore = ReturnType<typeof useCesiumVectorLayers>

/** 由 <VectorContext> provide，供上传面板与图层列表共享同一份状态 */
export const VECTOR_LAYERS_KEY: InjectionKey<VectorLayersStore> = Symbol('vector-layers')

export function useVectorLayersStore(): VectorLayersStore {
  const store = inject(VECTOR_LAYERS_KEY, null)
  if (!store) throw new Error('[useVectorLayersStore] 必须在 VectorContext 子组件中调用')
  return store
}
