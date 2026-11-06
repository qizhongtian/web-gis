import { ref, shallowRef } from 'vue'

export interface TileFeatureProperty {
  name: string
  value: string
}

/**
 * 3D Tiles 加载与要素拾取
 * - Cesium3DTileset.fromUrl（Cesium >= 1.107）
 * - 点击拾取 tile feature，高亮并在面板展示属性
 * - 移除时先清理样式/事件再销毁，避免引用残留
 */
export function useCesiumTileset() {
  const loading = ref(false)
  const error = ref('')
  const loaded = ref(false)
  const visible = ref(true)
  const wireframe = ref(false)
  const properties = ref<TileFeatureProperty[]>([])
  const tileset = shallowRef<any>()

  let viewer: any = null
  let C: any = null
  let handler: any = null
  /** 高亮的 b3dm / i3dm 要素 */
  let highlighted: any = null
  /** 高亮的纯 glTF 内容（3D Tiles 1.1）对应的 Model */
  let highlightedModel: any = null

  function resetHighlight() {
    if (highlighted && !highlighted.isDestroyed?.()) {
      // 还原为原始颜色
      highlighted.color = undefined
    }
    if (highlightedModel && !highlightedModel.isDestroyed?.() && C) {
      highlightedModel.color = C.Color.WHITE
    }
    highlighted = null
    highlightedModel = null
  }

  function onPick(movement: any) {
    if (!viewer || !tileset.value) return
    const picked = viewer.scene.pick(movement.position)
    resetHighlight()
    if (!picked) {
      properties.value = []
      return
    }

    // 1) 带批处理表的构件（b3dm / i3dm）：读取要素属性
    if (picked instanceof C.Cesium3DTileFeature) {
      highlighted = picked
      picked.color = C.Color.fromCssColorString('#f59e0b')

      const list: TileFeatureProperty[] = []
      const names = picked.getPropertyNames?.() || []
      names.slice(0, 40).forEach((name: string) => {
        const value = picked.getProperty(name)
        list.push({ name, value: typeof value === 'object' ? JSON.stringify(value) : String(value) })
      })
      properties.value = list
      return
    }

    // 2) 纯 glTF 内容（3D Tiles 1.1）：pick 返回 { content, primitive, detail: { model, node } }
    //    没有 batch table，无法逐要素取属性，这里高亮整个模型并给出说明
    const model = picked.detail?.model ?? picked.content?._model
    if (model) {
      highlightedModel = model
      model.color = C.Color.fromCssColorString('#f59e0b')
      const list: TileFeatureProperty[] = [
        { name: '内容类型', value: 'glTF（3D Tiles 1.1）' },
        { name: '要素属性', value: '该 tileset 未携带 metadata' },
      ]
      if (typeof picked.detail?.node === 'number') {
        list.push({ name: '节点索引', value: String(picked.detail.node) })
      }
      properties.value = list
      return
    }

    properties.value = []
  }

  /**
   * 飞向 tileset：按包围球半径计算相机距离，避免 zoomTo 默认距离过近（贴脸）
   */
  function flyToTileset(ts: any) {
    const bs = ts?.boundingSphere
    if (!viewer || !bs) return
    const radius = bs.radius || 50
    viewer.camera.flyToBoundingSphere(bs, {
      duration: 1.4,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(35),
        C.Math.toRadians(-32),
        Math.max(radius * 4, radius + 120),
      ),
    })
  }

  async function load(url: string) {
    if (!viewer || !url) return
    remove()
    error.value = ''
    loading.value = true
    try {
      const ts = await C.Cesium3DTileset.fromUrl(url, {
        maximumScreenSpaceError: 16,
        skipLevelOfDetail: true,
        preferLeaves: true,
      })
      if (!viewer || viewer.isDestroyed?.()) {
        ts.destroy()
        return
      }
      viewer.scene.primitives.add(ts)
      tileset.value = ts
      loaded.value = true
      visible.value = true
      flyToTileset(ts)
    } catch (e: any) {
      error.value = e?.message || '3D Tiles 加载失败'
    } finally {
      loading.value = false
    }
  }

  function remove() {
    resetHighlight()
    properties.value = []
    const ts = tileset.value
    if (ts && viewer && !viewer.isDestroyed?.()) {
      viewer.scene.primitives.remove(ts)
    }
    tileset.value = undefined
    loaded.value = false
    error.value = ''
  }

  function zoomTo() {
    if (tileset.value) flyToTileset(tileset.value)
  }

  function setVisible(value: boolean) {
    visible.value = value
    if (tileset.value) tileset.value.show = value
  }

  function setWireframe(value: boolean) {
    wireframe.value = value
    if (tileset.value) tileset.value.debugWireframe = value
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction(onPick, C.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler?.destroy()
      handler = null
      remove()
      viewer = null
      C = null
    }
  })

  return { loading, error, loaded, visible, wireframe, properties, tileset, load, remove, zoomTo, setVisible, setWireframe }
}
