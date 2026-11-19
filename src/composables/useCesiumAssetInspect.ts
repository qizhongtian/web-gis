import { computed, inject, reactive, ref, shallowRef, type InjectionKey } from 'vue'
import { onCesiumReady } from './useCesium'
import {
  detectAssetKind,
  formatBytes,
  inspectAsset,
  parseGlb,
  toDisplayValue,
  type AssetKind,
  type GlbParseResult,
  type InspectProperty,
  type InspectResult,
} from '@/utils/gis/assetInspect'

export const ASSET_INSPECT_KEY: InjectionKey<AssetInspectStore> = Symbol('asset-inspect')

export function useAssetInspect(): AssetInspectStore {
  const store = inject(ASSET_INSPECT_KEY)
  if (!store) throw new Error('useAssetInspect must be used inside AssetInspectContext')
  return store
}

function delayFrames(count = 2) {
  return new Promise<void>((resolve) => {
    let left = count
    const step = () => {
      left -= 1
      if (left <= 0) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

/**
 * 数据探查：本地文件 / URL 解析 + Cesium 上图 + 拾取属性
 * - GeoJSON：GeoJsonDataSource，点击要素读 entity.properties
 * - 3D Tiles：Cesium3DTileset，点击构件读 feature 属性
 * - glTF / GLB：Cesium.Model，点击读 primitive / detail.node
 */
export function useCesiumAssetInspect() {
  const kind = ref<AssetKind>('geojson')
  const loading = ref(false)
  const error = ref('')
  const notice = ref('')
  const result = shallowRef<InspectResult | null>(null)
  const loadedToMap = ref(false)
  const pickedTitle = ref('')
  const picked = ref<InspectProperty[]>([])
  const runtime = ref<InspectProperty[]>([])
  const modelNodes = ref<InspectProperty[]>([])

  const geoOptions = reactive({ clamp: true })
  const tilesetOptions = reactive({ show: true, wireframe: false, boundingVolume: false, maxError: 16 })
  const modelOptions = reactive({ lon: 114.1694, lat: 22.3193, height: 0, scale: 1 })

  let viewer: any = null
  let C: any = null
  let handler: any = null
  let dataSource: any = null
  let tileset: any = null
  let model: any = null
  let objectUrl = ''
  let statsTimer = 0
  let highlightedFeature: any = null
  let highlightedModel: any = null

  function now() {
    return C?.JulianDate.now()
  }

  function resetHighlight() {
    if (highlightedFeature && !highlightedFeature.isDestroyed?.()) highlightedFeature.color = undefined
    if (highlightedModel && !highlightedModel.isDestroyed?.() && C) highlightedModel.color = C.Color.WHITE
    if (model && !model.isDestroyed?.()) model.silhouetteSize = 0
    highlightedFeature = null
    highlightedModel = null
  }

  function stopStats() {
    if (statsTimer) {
      window.clearTimeout(statsTimer)
      statsTimer = 0
    }
  }

  function releaseObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = ''
    }
  }

  function readGeoRuntime(ds: any) {
    const entities = ds?.entities?.values ?? []
    const counter = new Map<string, number>()
    for (const entity of entities) {
      const type = entity.polygon ? 'polygon' : entity.polyline ? 'polyline' : entity.point || entity.billboard ? 'point' : 'other'
      counter.set(type, (counter.get(type) || 0) + 1)
    }
    const rows: InspectProperty[] = [
      { name: 'dataSources.length', value: String(viewer?.dataSources?.length ?? '—') },
      { name: 'entities.length', value: String(entities.length) },
      {
        name: 'entity types',
        value: Array.from(counter.entries()).map(([type, count]) => `${type}×${count}`).join(' / ') || '—',
      },
    ]
    const propNames = entities[0]?.properties?.propertyNames ?? []
    if (propNames.length) {
      rows.push({ name: 'entity.properties.propertyNames', value: propNames.slice(0, 30).join(', ') })
    }
    return rows
  }

  function flyToTileset(ts: any) {
    const sphere = ts?.boundingSphere
    if (!viewer || !sphere || !C) return
    const radius = sphere.radius || 50
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.4,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(35),
        C.Math.toRadians(-32),
        Math.max(radius * 4, radius + 120),
      ),
    })
  }

  function flyToModel(target: any) {
    const sphere = target?.boundingSphere
    if (!viewer || !sphere || !C) return
    // 模型尺寸差异极大（几厘米到几百米），距离需按包围球半径自适应，否则小模型只有几个像素、无法拾取
    const radius = sphere.radius || 1
    const distance = Math.max(radius * 3.2, radius + 2)
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.2,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(30),
        C.Math.toRadians(-25),
        distance,
      ),
    })
  }

  function readModelRuntime(target: any) {
    const sg = target?.sceneGraph
    const nodes: any[] = sg?._runtimeNodes?.filter(Boolean) ?? Object.values(sg?._nodesByName ?? {})
    const primitives = nodes.reduce((sum, node) => sum + (node?.runtimePrimitives?.length ?? 0), 0)
    return [
      { name: 'model.boundingSphere.radius', value: String(Math.round(target?.boundingSphere?.radius ?? 0)) },
      { name: 'model.sceneGraph nodes', value: String(nodes.length) },
      { name: 'model.sceneGraph primitives', value: String(primitives) },
      { name: 'model.ready', value: String(target?.ready ?? false) },
    ]
  }

  function readModelNodes(target: any) {
    const sg = target?.sceneGraph
    const runtimeNodes: any[] = sg?._runtimeNodes ?? []
    const rows: InspectProperty[] = []
    runtimeNodes.forEach((node, index) => {
      if (!node || rows.length >= 200) return
      const name = node._name ?? node._node?.name ?? `node ${index}`
      const primitiveCount = node.runtimePrimitives?.length ?? 0
      const childCount = node._children?.length ?? 0
      rows.push({
        name: String(name),
        value: `${primitiveCount} primitive · ${childCount} children`,
      })
    })
    if (rows.length) return rows
    // 兼容旧版本 Cesium：按名字索引节点
    const byName = sg?._nodesByName ?? {}
    return Object.keys(byName)
      .slice(0, 200)
      .map((name) => ({ name, value: 'named node' }))
  }

  function startTilesetStats() {
    stopStats()
    const tick = () => {
      if (!tileset) return
      const stats = tileset.statistics ?? {}
      runtime.value = [
        { name: 'tileset.asset.version', value: String(tileset.asset?.version ?? '—') },
        { name: 'maximumScreenSpaceError', value: String(tileset.maximumScreenSpaceError ?? '—') },
        { name: 'statistics.numberOfTilesSelected', value: String(stats.numberOfTilesSelected ?? '—') },
        { name: 'statistics.numberOfTilesVisited', value: String(stats.numberOfTilesVisited ?? '—') },
        { name: 'statistics.numberOfPendingRequests', value: String(stats.numberOfPendingRequests ?? '—') },
        { name: 'boundingSphere.radius', value: String(Math.round(tileset.boundingSphere?.radius ?? 0)) },
      ]
      statsTimer = window.setTimeout(tick, 700)
    }
    tick()
  }

  function removeMapObject() {
    stopStats()
    resetHighlight()
    if (dataSource && viewer && !viewer.isDestroyed?.()) viewer.dataSources.remove(dataSource, true)
    dataSource = null
    if (tileset && viewer && !viewer.isDestroyed?.()) viewer.scene.primitives.remove(tileset)
    tileset = null
    if (model && viewer && !viewer.isDestroyed?.()) viewer.scene.primitives.remove(model)
    model = null
    loadedToMap.value = false
    pickedTitle.value = ''
    picked.value = []
    runtime.value = []
    modelNodes.value = []
  }

  async function addGeoJson(json: any) {
    if (!viewer || !C) return
    removeMapObject()
    const ds = await C.GeoJsonDataSource.load(json, {
      clampToGround: geoOptions.clamp,
      markerSize: 22,
      stroke: C.Color.fromCssColorString('#2563eb'),
      fill: C.Color.fromCssColorString('#3b82f6').withAlpha(0.3),
      strokeWidth: 2,
    })
    if (!viewer || viewer.isDestroyed?.()) {
      ds.destroy?.()
      return
    }
    viewer.dataSources.add(ds)
    dataSource = ds
    loadedToMap.value = true
    await delayFrames(2)
    runtime.value = readGeoRuntime(ds)
    viewer.flyTo(ds, { duration: 1.2 })
  }

  async function addTileset(url: string) {
    if (!viewer || !C) return
    removeMapObject()
    const ts = await C.Cesium3DTileset.fromUrl(url, {
      maximumScreenSpaceError: tilesetOptions.maxError,
      skipLevelOfDetail: true,
      preferLeaves: true,
    })
    if (!viewer || viewer.isDestroyed?.()) {
      ts.destroy?.()
      return
    }
    viewer.scene.primitives.add(ts)
    tileset = ts
    ts.show = tilesetOptions.show
    ts.debugWireframe = tilesetOptions.wireframe
    ts.debugShowBoundingVolume = tilesetOptions.boundingVolume
    loadedToMap.value = true
    startTilesetStats()
    flyToTileset(ts)
  }

  async function addModel(url: string) {
    if (!viewer || !C) return
    removeMapObject()
    viewer.shadows = true
    const position = C.Cartesian3.fromDegrees(modelOptions.lon, modelOptions.lat, modelOptions.height)
    const target = await C.Model.fromGltfAsync({
      url,
      scale: modelOptions.scale,
      shadows: C.ShadowMode.ENABLED,
      modelMatrix: C.Transforms.eastNorthUpToFixedFrame(position),
    })
    if (!viewer || viewer.isDestroyed?.()) {
      target.destroy?.()
      return
    }
    viewer.scene.primitives.add(target)
    model = target
    loadedToMap.value = true
    await delayFrames(2)
    runtime.value = readModelRuntime(target)
    modelNodes.value = readModelNodes(target)
    flyToModel(target)
  }

  function applyResult(
    detected: AssetKind,
    json: any,
    name: string,
    size: number,
    glb?: GlbParseResult | null,
  ) {
    kind.value = detected
    result.value = inspectAsset(detected, json, {
      name,
      size,
      glbVersion: glb?.version,
      binLength: glb?.binLength,
    })
  }

  async function readSource(name: string): Promise<{ json: any; size: number; glb: GlbParseResult | null }> {
    const lower = name.toLowerCase().split(/[?#]/)[0]
    if (lower.endsWith('.glb')) {
      const response = await fetch(name)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      const glb = parseGlb(buffer)
      if (!glb) throw new Error('GLB parse failed')
      return { json: glb.json, size: buffer.byteLength, glb }
    }
    const response = await fetch(name)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    return { json: JSON.parse(text), size: new Blob([text]).size, glb: null }
  }

  async function loadUrl(url: string) {
    const target = url.trim()
    if (!target) {
      error.value = 'URL is empty'
      return
    }
    clear()
    loading.value = true
    error.value = ''
    try {
      const { json, size, glb } = await readSource(target)
      const detected = detectAssetKind(target, json)
      if (!detected) throw new Error('Unsupported data type')
      applyResult(detected, json, target.split('/').pop() || target, size, glb)
      if (detected === 'geojson') await addGeoJson(json)
      else if (detected === 'tileset') await addTileset(target)
      else await addModel(target)
    } catch (e: any) {
      console.error('[inspect-load]', e)
      error.value = e?.message || String(e)
      loadedToMap.value = false
    } finally {
      loading.value = false
    }
  }

  async function loadFile(file: File) {
    clear()
    loading.value = true
    error.value = ''
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.glb')) {
        const buffer = await file.arrayBuffer()
        const glb = parseGlb(buffer)
        if (!glb) throw new Error('GLB parse failed')
        applyResult('model', glb.json, file.name, file.size, glb)
        objectUrl = URL.createObjectURL(file)
        await addModel(objectUrl)
      } else if (lower.endsWith('.json') || lower.endsWith('.geojson') || lower.endsWith('.gltf')) {
        const text = await file.text()
        const json = JSON.parse(text)
        const detected = detectAssetKind(file.name, json)
        if (!detected) throw new Error('Unsupported data type')
        applyResult(detected, json, file.name, file.size)
        if (detected === 'geojson') {
          await addGeoJson(json)
        } else if (detected === 'model') {
          objectUrl = URL.createObjectURL(file)
          notice.value = 'inspect.localGltfTip'
          await addModel(objectUrl)
        } else {
          notice.value = 'inspect.localTilesetTip'
        }
      } else {
        throw new Error('Unsupported file extension')
      }
    } catch (e: any) {
      error.value = e?.message || String(e)
      loadedToMap.value = false
    } finally {
      loading.value = false
    }
  }

  function onPick(movement: any) {
    if (!viewer || !C || !loadedToMap.value) return
    const pickedObject = viewer.scene.pick(movement.position)
    resetHighlight()

    if (kind.value === 'geojson') {
      const entity = pickedObject?.id
      if (!entity?.properties) {
        pickedTitle.value = ''
        picked.value = []
        return
      }
      const names: string[] = entity.properties.propertyNames ?? []
      const rows: InspectProperty[] = names.slice(0, 80).map((name) => ({
        name,
        value: toDisplayValue(entity.properties[name]?.getValue?.(now())),
      }))
      const title = entity.properties.name?.getValue?.(now())
      pickedTitle.value = title != null ? String(title) : String(entity.id ?? 'Entity')
      if (entity.position) {
        const cartographic = C.Cartographic.fromCartesian(entity.position.getValue(now()))
        if (cartographic) {
          rows.push({
            name: 'entity.position',
            value: `${C.Math.toDegrees(cartographic.longitude).toFixed(6)}, ${C.Math.toDegrees(cartographic.latitude).toFixed(6)} · h=${cartographic.height.toFixed(2)}`,
          })
        }
      }
      if (entity.polyline) {
        const positions = entity.polyline.positions?.getValue?.(now())
        rows.push({ name: 'entity.polyline.positions', value: `${positions?.length ?? 0} positions` })
      }
      if (entity.polygon) {
        const hierarchy = entity.polygon.hierarchy?.getValue?.(now())
        rows.push({ name: 'entity.polygon.hierarchy', value: `${hierarchy?.positions?.length ?? 0} positions` })
      }
      picked.value = rows
      return
    }

    if (kind.value === 'tileset') {
      if (pickedObject instanceof C.Cesium3DTileFeature) {
        highlightedFeature = pickedObject
        pickedObject.color = C.Color.fromCssColorString('#f59e0b')
        const names: string[] = pickedObject.getPropertyNames?.() ?? []
        pickedTitle.value = 'Cesium3DTileFeature'
        picked.value = names.slice(0, 80).map((name: string) => ({
          name,
          value: toDisplayValue(pickedObject.getProperty(name)),
        }))
        return
      }
      const contentModel = pickedObject?.detail?.model ?? pickedObject?.content?._model
      if (contentModel) {
        highlightedModel = contentModel
        contentModel.color = C.Color.fromCssColorString('#f59e0b')
        const contentNode = pickedObject?.detail?.node
        const nodeLabel =
          contentNode && typeof contentNode === 'object'
            ? String(contentNode._name ?? contentNode.name ?? 'unnamed')
            : String(contentNode ?? '—')
        pickedTitle.value = 'glTF content (3D Tiles)'
        picked.value = [
          { name: 'content', value: 'glTF / 3D Tiles 1.1' },
          { name: 'detail.node', value: nodeLabel },
        ]
        return
      }
      // 命中瓦片但没有 batch table / metadata：仍提示已拾取
      if (pickedObject?.primitive === tileset) {
        pickedTitle.value = 'Cesium3DTileset'
        picked.value = []
        return
      }
      pickedTitle.value = ''
      picked.value = []
      return
    }

    const primitive = pickedObject?.primitive
    // Cesium 不同版本的模型拾取结果层级不同：primitive 可能直接是 Model，也可能是 Model 的包装
    const isModel =
      primitive === model ||
      pickedObject?.id === model ||
      (primitive && (primitive.primitive === model || primitive.model === model))
    if (!isModel) {
      pickedTitle.value = ''
      picked.value = []
      return
    }
    if (model && !model.isDestroyed?.()) {
      model.silhouetteColor = C.Color.fromCssColorString('#f59e0b')
      model.silhouetteSize = 2
    }
    // detail.node 可能是节点索引，也可能是运行时节点对象
    const detailNode = pickedObject?.detail?.node
    const rows: InspectProperty[] = [{ name: 'primitive', value: 'Cesium.Model' }]
    if (typeof detailNode === 'number') {
      const runtimeNode = model?.sceneGraph?._runtimeNodes?.[detailNode]
      rows.push(
        { name: 'detail.node', value: String(detailNode) },
        { name: 'node.name', value: runtimeNode?.name ?? runtimeNode?._name ?? `node ${detailNode}` },
      )
    } else if (detailNode && typeof detailNode === 'object') {
      // detail.node 是 Cesium 的 RuntimeNode：node._name / node._node.name 可能为空，用运行时索引兜底
      const runtimeNodes: any[] = model?.sceneGraph?._runtimeNodes ?? []
      const nodeIndex = runtimeNodes.indexOf(detailNode)
      const nodeName =
        detailNode._name ?? detailNode._node?.name ?? (nodeIndex >= 0 ? `node ${nodeIndex}` : '—')
      rows.push(
        { name: 'detail.node.name', value: String(nodeName) },
        { name: 'node.index', value: nodeIndex >= 0 ? String(nodeIndex) : '—' },
        { name: 'node.primitives', value: String(detailNode.runtimePrimitives?.length ?? 0) },
        { name: 'node.children', value: String(detailNode._children?.length ?? 0) },
      )
    } else {
      rows.push({ name: 'detail.node', value: '—' })
    }
    pickedTitle.value = 'Cesium.Model'
    picked.value = rows
  }

  function clear() {
    releaseObjectUrl()
    removeMapObject()
    result.value = null
    error.value = ''
    notice.value = ''
  }

  function setKind(next: AssetKind) {
    if (kind.value === next) return
    clear()
    kind.value = next
  }

  function zoom() {
    if (!viewer || !C) return
    if (kind.value === 'geojson' && dataSource) viewer.flyTo(dataSource, { duration: 1.2 })
    else if (kind.value === 'tileset' && tileset) flyToTileset(tileset)
    else if (kind.value === 'model' && model) flyToModel(model)
  }

  function setGeoClamp(value: boolean) {
    geoOptions.clamp = value
    if (result.value?.kind === 'geojson' && loadedToMap.value) {
      void addGeoJson(result.value.raw).catch((e: any) => {
        error.value = e?.message || String(e)
      })
    }
  }

  function setTilesetVisible(value: boolean) {
    tilesetOptions.show = value
    if (tileset) tileset.show = value
  }

  function setTilesetWireframe(value: boolean) {
    tilesetOptions.wireframe = value
    if (tileset) tileset.debugWireframe = value
  }

  function setTilesetBoundingVolume(value: boolean) {
    tilesetOptions.boundingVolume = value
    if (tileset) tileset.debugShowBoundingVolume = value
  }

  function setTilesetMaxError(value: number) {
    tilesetOptions.maxError = value
    if (tileset) tileset.maximumScreenSpaceError = value
  }

  function applyModelTransform() {
    if (!model || !C) return
    const position = C.Cartesian3.fromDegrees(modelOptions.lon, modelOptions.lat, modelOptions.height)
    model.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(position)
    model.scale = modelOptions.scale
  }

  function updateModelOption(key: 'lon' | 'lat' | 'height' | 'scale', value: number) {
    if (!Number.isFinite(value)) return
    ;(modelOptions as any)[key] = value
    applyModelTransform()
  }

  const sizeText = computed(() => formatBytes(result.value?.size ?? 0))

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction(onPick, C.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler?.destroy()
      handler = null
      releaseObjectUrl()
      removeMapObject()
      viewer = null
      C = null
    }
  })

  return {
    kind,
    loading,
    error,
    notice,
    result,
    loadedToMap,
    pickedTitle,
    picked,
    runtime,
    modelNodes,
    geoOptions,
    tilesetOptions,
    modelOptions,
    sizeText,
    setKind,
    loadFile,
    loadUrl,
    clear,
    zoom,
    setGeoClamp,
    setTilesetVisible,
    setTilesetWireframe,
    setTilesetBoundingVolume,
    setTilesetMaxError,
    updateModelOption,
  }
}

export type AssetInspectStore = ReturnType<typeof useCesiumAssetInspect>

