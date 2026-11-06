import { ref } from 'vue'
import { pickSurface } from '@/utils/gis/cesiumInit'

export type DrawMode = 'point' | 'polyline' | 'polygon' | 'rectangle' | 'circle'

interface DrawnShape {
  type: DrawMode
  positions: any[]
  entities: any[]
}

const STYLE = {
  color: '#22d3ee',
  fill: 'rgba(34, 211, 238, 0.25)',
  point: '#2563eb',
}

/**
 * 交互绘制：点 / 线 / 面 / 矩形 / 圆
 * - 左键加点，双击或右键结束线/面
 * - 绘制结果可导出 GeoJSON（含高程），也可灌入 GeoJSON 回显
 */
export function useCesiumDraw() {
  const mode = ref<DrawMode | ''>('')
  const count = ref(0)

  let viewer: any = null
  let C: any = null
  let handler: any = null

  let draft: any[] = []
  let cursor: any = null
  let preview: any[] = []
  let shapes: DrawnShape[] = []

  const hasViewer = () => !!viewer && !viewer.isDestroyed?.()
  const pick = (endpoint: any) => (hasViewer() ? pickSurface(C, viewer, endpoint) : null)

  function addVertex(position: any) {
    const e = viewer.entities.add({
      position,
      point: {
        pixelSize: 7,
        color: C.Color.fromCssColorString(STYLE.point),
        outlineColor: C.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    return e
  }

  function clearPreview() {
    preview.forEach((e) => viewer?.entities.remove(e))
    preview = []
  }

  /** 线/面绘制中的动态预览 */
  function ensureLinePreview() {
    if (preview.length || !viewer) return
    const line = viewer.entities.add({
      polyline: {
        positions: new C.CallbackProperty(() => {
          const arr = [...draft]
          if (cursor) arr.push(cursor)
          return arr.length > 1 ? arr : []
        }, false),
        width: 2,
        material: C.Color.fromCssColorString(STYLE.color),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    preview.push(line)

    if (mode.value === 'polygon') {
      const fill = viewer.entities.add({
        polygon: {
          hierarchy: new C.CallbackProperty(() => {
            const arr = [...draft]
            if (cursor) arr.push(cursor)
            return arr.length >= 3 ? new C.PolygonHierarchy(arr) : undefined
          }, false),
          material: C.Color.fromCssColorString(STYLE.fill),
        },
      })
      preview.push(fill)
    }
  }

  function ensureRectPreview() {
    if (preview.length || !viewer) return
    const rect = viewer.entities.add({
      rectangle: {
        coordinates: new C.CallbackProperty(() => {
          if (!draft.length || !cursor) return undefined
          return C.Rectangle.fromCartesianArray([draft[0], cursor])
        }, false),
        material: C.Color.fromCssColorString(STYLE.fill),
        outline: true,
        outlineColor: C.Color.fromCssColorString(STYLE.color),
      },
    })
    preview.push(rect)
  }

  function ensureCirclePreview() {
    if (preview.length || !viewer) return
    const radius = new C.CallbackProperty(() => {
      if (!draft.length || !cursor) return 0
      return C.Cartesian3.distance(draft[0], cursor)
    }, false)
    const circle = viewer.entities.add({
      position: draft[0],
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: C.Color.fromCssColorString(STYLE.fill),
        outline: true,
        outlineColor: C.Color.fromCssColorString(STYLE.color),
      },
    })
    preview.push(circle)
  }

  function commitShape(type: DrawMode, positions: any[], entities: any[]) {
    shapes.push({ type, positions, entities })
    count.value = shapes.length
    clearPreview()
    draft = []
    cursor = null
  }

  function commitLine(type: 'polyline' | 'polygon') {
    const min = type === 'polyline' ? 2 : 3
    if (draft.length < min) {
      // 点数不足，直接丢弃本次草稿
      draft.forEach(() => {})
      draft = []
      clearPreview()
      return
    }
    const vertices = draft.map((p) => addVertex(p))
    const entities: any[] = [...vertices]
    if (type === 'polyline') {
      entities.push(
        viewer.entities.add({
          polyline: {
            positions: draft,
            width: 3,
            material: C.Color.fromCssColorString(STYLE.color),
          },
        }),
      )
    } else {
      entities.push(
        viewer.entities.add({
          polygon: {
            hierarchy: draft,
            material: C.Color.fromCssColorString(STYLE.fill),
            outline: true,
            outlineColor: C.Color.fromCssColorString(STYLE.color),
            outlineWidth: 2,
          },
        }),
      )
    }
    commitShape(type, [...draft], entities)
  }

  function commitRectangle() {
    const rect = C.Rectangle.fromCartesianArray([draft[0], draft[1]])
    const cartos = [
      C.Cartographic.fromRadians(rect.west, rect.north),
      C.Cartographic.fromRadians(rect.east, rect.north),
      C.Cartographic.fromRadians(rect.east, rect.south),
      C.Cartographic.fromRadians(rect.west, rect.south),
    ]
    const positions = cartos.map((c) => C.Cartesian3.fromRadians(c.longitude, c.latitude, 0))
    const entity = viewer.entities.add({
      rectangle: {
        coordinates: rect,
        material: C.Color.fromCssColorString(STYLE.fill),
        outline: true,
        outlineColor: C.Color.fromCssColorString(STYLE.color),
      },
    })
    commitShape('rectangle', positions, [entity])
  }

  function commitCircle() {
    const center = draft[0]
    const radius = C.Cartesian3.distance(center, draft[1])
    const positions = circleRing(center, radius)
    const entity = viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: C.Color.fromCssColorString(STYLE.fill),
        outline: true,
        outlineColor: C.Color.fromCssColorString(STYLE.color),
      },
    })
    commitShape('circle', positions, [entity])
  }

  /** 圆环采样点（局部 ENU 平面，64 段） */
  function circleRing(center: any, radius: number) {
    const enu = C.Transforms.eastNorthUpToFixedFrame(center)
    const ring: any[] = []
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      const offset = new C.Cartesian3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
      ring.push(C.Matrix4.multiplyByPoint(enu, offset, new C.Cartesian3()))
    }
    return ring
  }

  function onClick(movement: any) {
    if (!mode.value || !hasViewer()) return
    const pos = pick(movement.position)
    if (!pos) return

    if (mode.value === 'point') {
      const entity = addVertex(pos)
      commitShape('point', [pos], [entity])
      return
    }

    if (mode.value === 'polyline' || mode.value === 'polygon') {
      draft.push(pos)
      ensureLinePreview()
      return
    }

    if (mode.value === 'rectangle' || mode.value === 'circle') {
      if (!draft.length) {
        draft.push(pos)
        if (mode.value === 'rectangle') ensureRectPreview()
        else ensureCirclePreview()
        return
      }
      if (C.Cartesian3.distance(draft[0], pos) < 0.5) return
      draft.push(pos)
      if (mode.value === 'rectangle') commitRectangle()
      else commitCircle()
    }
  }

  function onMove(movement: any) {
    if (!mode.value || !draft.length) return
    const pos = pick(movement.endPosition)
    if (pos) cursor = pos
  }

  function finish() {
    if (!mode.value || !hasViewer()) return
    if (mode.value === 'polyline' || mode.value === 'polygon') {
      // 双击会先触发两次单击，去掉末尾重复点
      if (draft.length >= 2) {
        const a = draft[draft.length - 1]
        const b = draft[draft.length - 2]
        if (C.Cartesian3.distance(a, b) < 0.01) draft.pop()
      }
      commitLine(mode.value)
    } else if (mode.value === 'rectangle' || mode.value === 'circle') {
      if (draft.length === 1) {
        draft = []
        clearPreview()
      }
    }
    draft = []
    cursor = null
    mode.value = ''
    if (viewer) viewer.scene.canvas.style.cursor = ''
  }

  function start(m: DrawMode) {
    if (!hasViewer()) return
    clearPreview()
    draft = []
    cursor = null
    mode.value = m
    viewer.scene.canvas.style.cursor = 'crosshair'
  }

  function stop() {
    finish()
  }

  /** 仅删除最后一组绘制结果 */
  function removeLast() {
    const last = shapes.pop()
    if (!last || !viewer || viewer.isDestroyed?.()) return
    last.entities.forEach((e) => viewer.entities.remove(e))
    count.value = shapes.length
  }

  function clear() {
    clearPreview()
    shapes.forEach((s) => s.entities.forEach((e) => viewer?.entities.remove(e)))
    shapes = []
    draft = []
    cursor = null
    count.value = 0
    mode.value = ''
    if (viewer) viewer.scene.canvas.style.cursor = ''
  }

  /** 导出 GeoJSON FeatureCollection（坐标含高程） */
  function toGeoJSON() {
    const features = shapes.map((s) => {
      const coords = s.positions.map((p) => {
        const carto = C.Cartographic.fromCartesian(p)
        return [
          Number(C.Math.toDegrees(carto.longitude).toFixed(6)),
          Number(C.Math.toDegrees(carto.latitude).toFixed(6)),
          Number((carto.height || 0).toFixed(2)),
        ]
      })
      if (s.type === 'point') {
        return { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: {} }
      }
      if (s.type === 'polyline') {
        return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }
      }
      const ring = [...coords, coords[0]]
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { shape: s.type } }
    })
    return { type: 'FeatureCollection', features }
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(onMove, C.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(() => finish(), C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    handler.setInputAction(() => finish(), C.ScreenSpaceEventType.RIGHT_CLICK)

    return () => {
      if (!v.isDestroyed?.()) {
        clearPreview()
        shapes.forEach((s) => s.entities.forEach((e) => v.entities.remove(e)))
        v.scene.canvas.style.cursor = ''
      }
      handler?.destroy()
      handler = null
      shapes = []
      draft = []
      viewer = null
      C = null
    }
  })

  return { mode, count, start, stop, clear, removeLast, toGeoJSON }
}
