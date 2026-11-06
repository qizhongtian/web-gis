import { reactive, ref, shallowRef } from 'vue'

export interface GeoJsonStyle {
  stroke: string
  fill: string
  fillAlpha: number
  strokeWidth: number
  clamp: boolean
  pointSize: number
}

export interface GeoJsonProperty {
  name: string
  value: string
}

/**
 * GeoJSON 加载
 * - GeoJsonDataSource 自动识别 Point / LineString / Polygon
 * - 样式变更通过重新加载原始数据实现（点图标尺寸无法原地修改）
 * - 点击要素读取属性表，卸载时销毁数据源与事件
 */
export function useCesiumGeoJson() {
  const loading = ref(false)
  const error = ref('')
  const count = ref(0)
  const properties = shallowRef<GeoJsonProperty[]>([])
  const selected = ref('')

  const style = reactive<GeoJsonStyle>({
    stroke: '#2563eb',
    fill: '#2563eb',
    fillAlpha: 0.25,
    strokeWidth: 2,
    clamp: false,
    pointSize: 22,
  })

  let viewer: any = null
  let C: any = null
  let handler: any = null
  let ds: any = null
  let raw: any = null

  function readProperties(entity: any) {
    const list: GeoJsonProperty[] = []
    const props = entity?.properties
    if (!props) return list
    const names: string[] = props.propertyNames || []
    names.forEach((name) => {
      const value = props[name]?.getValue?.(C?.JulianDate.now())
      list.push({
        name,
        value: value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value),
      })
    })
    return list
  }

  function onPick(movement: any) {
    if (!viewer || !ds) return
    const picked = viewer.scene.pick(movement.position)
    const entity = picked?.id
    if (!entity || !entity.properties) {
      properties.value = []
      selected.value = ''
      return
    }
    properties.value = readProperties(entity)
    selected.value = entity.properties.name?.getValue?.(C.JulianDate.now()) || entity.id || '要素'
  }

  function applyEntityStyle() {
    if (!ds) return
    const stroke = C.Color.fromCssColorString(style.stroke)
    const fill = C.Color.fromCssColorString(style.fill).withAlpha(style.fillAlpha)
    ds.entities.values.forEach((entity: any) => {
      if (entity.polyline) {
        entity.polyline.material = stroke
        entity.polyline.width = style.strokeWidth
      }
      if (entity.polygon) {
        entity.polygon.material = fill
        entity.polygon.outline = true
        entity.polygon.outlineColor = stroke
        entity.polygon.outlineWidth = style.strokeWidth / 2
      }
    })
  }

  async function build() {
    if (!viewer || !raw) return
    if (ds) viewer.dataSources.remove(ds, true)
    ds = await C.GeoJsonDataSource.load(raw, {
      stroke: C.Color.fromCssColorString(style.stroke),
      fill: C.Color.fromCssColorString(style.fill).withAlpha(style.fillAlpha),
      strokeWidth: style.strokeWidth,
      clampToGround: style.clamp,
      markerColor: C.Color.fromCssColorString(style.fill),
      markerSize: style.pointSize,
    })
    if (!viewer || viewer.isDestroyed?.()) {
      ds = null
      return
    }
    viewer.dataSources.add(ds)
    count.value = ds.entities.values.length
    applyEntityStyle()
  }

  /** DataSource 的包围球在首次渲染后才有效，等两帧再飞，避免“加载完仍在太空” */
  function nextFrame() {
    return new Promise<void>((resolve) => {
      if (!viewer || viewer.isDestroyed?.()) return resolve()
      let off: any = null
      off = viewer.scene.postRender.addEventListener(() => {
        off?.()
        resolve()
      })
    })
  }

  async function load(input: string | object, label = 'GeoJSON') {
    if (!viewer) return
    error.value = ''
    properties.value = []
    selected.value = ''
    loading.value = true
    try {
      if (typeof input === 'string') {
        const response = await fetch(input)
        if (!response.ok) throw new Error(`数据请求失败：HTTP ${response.status}`)
        raw = await response.json()
      } else {
        raw = input
      }
      await build()
      if (ds) {
        await nextFrame()
        await nextFrame()
        if (viewer && !viewer.isDestroyed?.()) viewer.flyTo(ds, { duration: 1.2 })
      }
      if (!count.value) error.value = `${label} 中没有可渲染的要素`
    } catch (e: any) {
      error.value = e?.message || 'GeoJSON 加载失败，请检查数据格式'
    } finally {
      loading.value = false
    }
  }

  async function restyle(patch: Partial<GeoJsonStyle> = {}) {
    Object.assign(style, patch)
    if (!raw) return
    try {
      await build()
    } catch (e: any) {
      error.value = e?.message || '样式更新失败'
    }
  }

  function clear() {
    if (ds && viewer && !viewer.isDestroyed?.()) viewer.dataSources.remove(ds, true)
    ds = null
    raw = null
    count.value = 0
    properties.value = []
    selected.value = ''
    error.value = ''
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction(onPick, C.ScreenSpaceEventType.LEFT_CLICK)
    return () => {
      handler?.destroy()
      handler = null
      clear()
      viewer = null
      C = null
    }
  })

  return { loading, error, count, properties, selected, style, load, restyle, clear }
}
