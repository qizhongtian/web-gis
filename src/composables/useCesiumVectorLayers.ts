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

/** 预览图层使用的固定 id（不进列表、不写缓存） */
const PREVIEW_ID = '__vector-preview__'

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
 * 矢量图层管理：新增 / 实时预览 / 编辑更新 / 显隐 / 定位 / 删除
 * - 真正的 Cesium 对象存在 datasets 里，避免 Vue 深度代理
 * - 纯数据 payload 同步缓存到 sessionStorage，刷新后可恢复
 * - 预览层独立于列表，调参数时只重建预览，不污染已保存数据
 */
export function useCesiumVectorLayers() {
  const items = ref<VectorLayerItem[]>([])
  const error = ref('')
  /** 当前选中的图层（用于列表高亮 + 表单联动编辑） */
  const selectedId = ref('')
  const viewer = shallowRef<any>()
  const C = shallowRef<any>()
  const datasets = new Map<string, LoadedVectorLayer>()
  /** 与 items 对应的原始数据，用于缓存 / 重建 */
  const payloads = new Map<string, VectorLayerPayload>()
  /** 未保存的预览图层 */
  let previewLayer: LoadedVectorLayer | null = null

  function persist() {
    writeCache([...payloads.values()])
  }

  /** 飞到某个已加载图层的范围 */
  function flyToLayer(layer: LoadedVectorLayer | null) {
    const v = viewer.value
    const lib = C.value
    if (!v || v.isDestroyed?.() || !lib || !layer?.boundingSphere) return
    const radius = Math.max(layer.boundingSphere.radius, 80)
    v.camera.flyToBoundingSphere(layer.boundingSphere, {
      duration: 1.2,
      offset: new lib.HeadingPitchRange(0, lib.Math.toRadians(-55), radius * 3.2),
    })
  }

  /** 点击图层名称定位 */
  function flyTo(id: string) {
    flyToLayer(datasets.get(id) || null)
  }

  /** 选中并定位（图层列表点击名称） */
  function select(id: string) {
    selectedId.value = id
    flyTo(id)
  }

  function clearSelection() {
    selectedId.value = ''
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

  /**
   * 更新已有图层（编辑属性 / 样式时实时生效）
   * 会用新 payload 重建数据源，id 保持不变
   */
  function update(id: string, payload: VectorLayerPayload) {
    error.value = ''
    const v = viewer.value
    const lib = C.value
    const old = datasets.get(id)
    if (!v || v.isDestroyed?.() || !lib || !old) {
      error.value = '图层不存在'
      return null
    }
    try {
      v.dataSources.remove(old.dataSource, true)
      datasets.delete(id)
      const loaded = loadVectorLayer(v, lib, { ...payload, id })
      if (!loaded.count) {
        error.value = '没有可渲染的要素'
        v.dataSources.remove(loaded.dataSource, true)
        payloads.delete(id)
        items.value = items.value.filter((it) => it.id !== id)
        persist()
        return null
      }
      datasets.set(id, loaded)
      payloads.set(id, { ...payload, id })
      items.value = items.value.map((it) =>
        it.id === id
          ? {
              id,
              name: loaded.name,
              createTime: loaded.createTime,
              type: loaded.type,
              count: loaded.count,
              enabled: payload.enabled !== false,
              clamped: loaded.clamped,
            }
          : it,
      )
      persist()
      return loaded
    } catch (e: any) {
      error.value = e?.message || '图层更新失败'
      return null
    }
  }

  /** 清掉预览图层 */
  function clearPreview() {
    const v = viewer.value
    if (previewLayer && v && !v.isDestroyed?.()) v.dataSources.remove(previewLayer.dataSource, true)
    previewLayer = null
  }

  /**
   * 实时预览：样式变化时重建预览层，实现「边调参数边看效果」
   * @param fly 是否飞到数据范围（新上传文件时 true，调样式时 false）
   */
  function preview(payload: VectorLayerPayload, fly = false) {
    const v = viewer.value
    const lib = C.value
    if (!v || v.isDestroyed?.() || !lib) return null
    error.value = ''
    try {
      clearPreview()
      const loaded = loadVectorLayer(v, lib, { ...payload, id: PREVIEW_ID })
      if (!loaded.count) {
        v.dataSources.remove(loaded.dataSource, true)
        error.value = '没有可渲染的要素'
        return null
      }
      previewLayer = loaded
      if (fly) flyToLayer(loaded)
      return loaded
    } catch (e: any) {
      error.value = e?.message || '预览失败'
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
    if (selectedId.value === id) selectedId.value = ''
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
    selectedId.value = ''
    error.value = ''
    clearPreview()
    if (!keepCache) persist()
  }

  /** 取某个已保存图层的原始数据（编辑时回填表单） */
  function getPayload(id: string) {
    return payloads.get(id) || null
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

  return {
    items,
    error,
    selectedId,
    add,
    update,
    preview,
    clearPreview,
    restore,
    setVisible,
    remove,
    clear,
    flyTo,
    select,
    clearSelection,
    getPayload,
  }
}

export type VectorLayersStore = ReturnType<typeof useCesiumVectorLayers>

/** 由 <VectorContext> provide，供上传面板与图层列表共享同一份状态 */
export const VECTOR_LAYERS_KEY: InjectionKey<VectorLayersStore> = Symbol('vector-layers')

export function useVectorLayersStore(): VectorLayersStore {
  const store = inject(VECTOR_LAYERS_KEY, null)
  if (!store) throw new Error('[useVectorLayersStore] 必须在 VectorContext 子组件中调用')
  return store
}
