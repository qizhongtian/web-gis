import { reactive, ref } from 'vue'

export interface ModelNodeItem {
  id: number
  name: string
  show: boolean
}

/**
 * 模型节点分层控制
 * - Model.fromGltfAsync + Primitives 加载（Primitive 才能访问 sceneGraph 节点树）
 * - 读取 sceneGraph 节点名，支持单节点显隐 / 全部显隐，适用于楼层、构件分组
 * - 卸载时从 primitives 移除并销毁，避免 GPU 资源残留
 */
export function useCesiumModelNodes() {
  const options = reactive({
    lon: 114.1694,
    lat: 22.3193,
    height: 0,
    scale: 1,
  })

  const loading = ref(false)
  const error = ref('')
  const loaded = ref(false)
  const nodes = ref<ModelNodeItem[]>([])

  let viewer: any = null
  let C: any = null
  let model: any = null
  let nodeRefs: any[] = []
  let retryTimer = 0

  function readShow(node: any): boolean {
    if (typeof node?.show === 'boolean') return node.show
    if (typeof node?._runtimeNode?.show === 'boolean') return node._runtimeNode.show
    return true
  }

  function writeShow(node: any, show: boolean) {
    try {
      node.show = show
    } catch {
      // 只读节点忽略
    }
    if (node?._runtimeNode) node._runtimeNode.show = show
  }

  function collect() {
    if (!model) return
    const sceneGraph = model.sceneGraph
    let list: any[] = Object.values(sceneGraph?._nodesByName || {})
    if (!list.length) list = Array.isArray(sceneGraph?._runtimeNodes) ? sceneGraph._runtimeNodes.slice() : []

    nodeRefs = list
    nodes.value = list.map((node, i) => ({
      id: i,
      name: node.name || node._name || `节点 ${i + 1}`,
      show: readShow(node),
    }))
  }

  /** fromGltfAsync resolve 后节点树可能仍需一帧，未取到节点时重试一次 */
  function collectWithRetry() {
    collect()
    if (nodes.value.length) return
    retryTimer = window.setTimeout(collect, 400)
  }

  function applyMatrix() {
    if (!model || !C) return
    model.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(
      C.Cartesian3.fromDegrees(options.lon, options.lat, options.height),
    )
    model.scale = options.scale
  }

  /** 按模型包围球半径计算距离，小模型（几米）也能看清 */
  function flyToModel(m: any) {
    if (!viewer || !m?.boundingSphere) return
    const radius = m.boundingSphere.radius || 5
    viewer.camera.flyToBoundingSphere(m.boundingSphere, {
      duration: 1.2,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(30),
        C.Math.toRadians(-30),
        Math.max(radius * 4, radius + 25),
      ),
    })
  }

  async function load(url: string) {
    if (!viewer || !url) return
    remove()
    error.value = ''
    loading.value = true
    try {
      viewer.shadows = true
      const m = await C.Model.fromGltfAsync({
        url,
        scale: options.scale,
        shadows: C.ShadowMode.ENABLED,
      })
      if (!viewer || viewer.isDestroyed?.()) {
        m.destroy?.()
        return
      }
      viewer.scene.primitives.add(m)
      model = m
      loaded.value = true
      applyMatrix()
      // Model 的 sceneGraph 在首次渲染后才建立，此时读取 boundingSphere 会抛错，
      // 因此节点收集与相机飞行都放到 readyEvent 之后
      const onReady = () => {
        applyMatrix()
        collectWithRetry()
        flyToModel(m)
      }
      if (m.ready) onReady()
      else m.readyEvent.addEventListener(() => onReady())
    } catch (e: any) {
      error.value = e?.message || '模型加载失败，请检查地址是否支持跨域'
    } finally {
      loading.value = false
    }
  }

  function setNodeShow(id: number, show: boolean) {
    const node = nodeRefs[id]
    if (!node) return
    writeShow(node, show)
    nodes.value = nodes.value.map((n) => (n.id === id ? { ...n, show } : n))
  }

  function showAll(show: boolean) {
    nodeRefs.forEach((node) => writeShow(node, show))
    nodes.value = nodes.value.map((n) => ({ ...n, show }))
  }

  function zoom() {
    if (model && viewer && !viewer.isDestroyed?.()) flyToModel(model)
  }

  function update(patch: Partial<typeof options> = {}) {
    Object.assign(options, patch)
    applyMatrix()
  }

  function remove() {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = 0
    }
    if (model && viewer && !viewer.isDestroyed?.()) viewer.scene.primitives.remove(model)
    model = null
    nodeRefs = []
    nodes.value = []
    loaded.value = false
    loading.value = false
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    return () => {
      remove()
      viewer = null
      C = null
    }
  })

  return { options, loading, error, loaded, nodes, load, remove, setNodeShow, showAll, zoom, update }
}
