import { reactive } from 'vue'
import { pickSurface } from '@/utils/gis/cesiumInit'

export type MeasureMode = 'distance' | 'area' | 'height'

export interface MeasureState {
  mode: MeasureMode | ''
  points: number
  distance: number
  area: number
  perimeter: number
  height: number
  horizontal: number
  slope: number
  angle: number
}

const LABEL_FONT = '13px MiSans, "Microsoft YaHei", sans-serif'

/**
 * 空间量算：距离 / 面积 / 高度差
 * - 左键加点，双击或右键结束
 * - 绘制过程用 CallbackProperty 实时预览，结束后固化为静态实体
 * - 全部实体、事件在 clear / 卸载时清理
 */
export function useCesiumMeasure() {
  const state = reactive<MeasureState>({
    mode: '',
    points: 0,
    distance: 0,
    area: 0,
    perimeter: 0,
    height: 0,
    horizontal: 0,
    slope: 0,
    angle: 0,
  })

  let viewer: any = null
  let C: any = null
  let handler: any = null
  let positions: any[] = []
  let cursor: any = null
  let dynamic: any[] = []
  let drawing = false

  const hasViewer = () => !!viewer && !viewer.isDestroyed?.()

  function pick(endpoint: any) {
    return hasViewer() ? pickSurface(C, viewer, endpoint) : null
  }

  function label(position: any, text: string, color?: any) {
    return viewer.entities.add({
      position,
      label: {
        text,
        font: LABEL_FONT,
        fillColor: color || C.Color.WHITE,
        showBackground: true,
        backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.78),
        backgroundPadding: new C.Cartesian2(7, 4),
        horizontalOrigin: C.HorizontalOrigin.CENTER,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        pixelOffset: new C.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  function marker(position: any) {
    return viewer.entities.add({
      position,
      point: {
        pixelSize: 8,
        color: C.Color.fromCssColorString('#22d3ee'),
        outlineColor: C.Color.fromCssColorString('#0f172a'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  function mid(a: any, b: any) {
    return C.Cartesian3.midpoint(a, b, new C.Cartesian3())
  }

  /** 局部 ENU 平面内计算面积（城市尺度足够精确） */
  function polygonArea(points: any[]) {
    if (points.length < 3) return 0
    const center = C.BoundingSphere.fromPoints(points).center
    const enu = C.Transforms.eastNorthUpToFixedFrame(center)
    const inverse = C.Matrix4.inverse(enu, new C.Matrix4())
    const local = points.map((p) => {
      const v = C.Matrix4.multiplyByPoint(inverse, p, new C.Cartesian3())
      return { x: v.x, y: v.y }
    })
    let sum = 0
    for (let i = 0; i < local.length; i++) {
      const a = local[i]
      const b = local[(i + 1) % local.length]
      sum += a.x * b.y - b.x * a.y
    }
    return Math.abs(sum) / 2
  }

  function perimeterOf(points: any[]) {
    let total = 0
    for (let i = 1; i < points.length; i++) total += C.Cartesian3.distance(points[i - 1], points[i])
    return total
  }

  function clearDynamic() {
    dynamic.forEach((e) => viewer?.entities.remove(e))
    dynamic = []
  }

  /** 距离量算：动态线 + 当前段长度提示 */
  function bindDistancePreview() {
    const linePositions = new C.CallbackProperty(() => {
      const arr = [...positions]
      if (cursor) arr.push(cursor)
      return arr
    }, false)

    const line = viewer.entities.add({
      polyline: {
        positions: linePositions,
        width: 2,
        material: new C.PolylineDashMaterialProperty({
          color: C.Color.fromCssColorString('#22d3ee'),
          dashLength: 16,
        }),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    dynamic.push(line)

    const hint = viewer.entities.add({
      position: new C.CallbackProperty(() => {
        if (!positions.length || !cursor) return undefined
        return mid(positions[positions.length - 1], cursor)
      }, false),
      label: {
        text: new C.CallbackProperty(() => {
          if (!positions.length || !cursor) return ''
          return `${C.Cartesian3.distance(positions[positions.length - 1], cursor).toFixed(1)} m`
        }, false),
        font: LABEL_FONT,
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.78),
        backgroundPadding: new C.Cartesian2(7, 4),
        horizontalOrigin: C.HorizontalOrigin.CENTER,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        pixelOffset: new C.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    dynamic.push(hint)
  }

  /** 面积量算：动态面 + 实时面积/周长 */
  function bindAreaPreview() {
    const polygon = viewer.entities.add({
      polygon: {
        hierarchy: new C.CallbackProperty(() => {
          const arr = [...positions]
          if (cursor) arr.push(cursor)
          return arr.length >= 3 ? new C.PolygonHierarchy(arr) : undefined
        }, false),
        material: C.Color.fromCssColorString('#22d3ee').withAlpha(0.28),
        outline: true,
        outlineColor: C.Color.fromCssColorString('#22d3ee'),
        outlineWidth: 2,
        perPositionHeight: false,
      },
    })
    dynamic.push(polygon)

    const hint = viewer.entities.add({
      position: new C.CallbackProperty(() => {
        const arr = [...positions]
        if (cursor) arr.push(cursor)
        if (arr.length < 3) return undefined
        return C.BoundingSphere.fromPoints(arr).center
      }, false),
      label: {
        text: new C.CallbackProperty(() => {
          const arr = [...positions]
          if (cursor) arr.push(cursor)
          if (arr.length < 3) return ''
          const area = polygonArea(arr)
          const perimeter = perimeterOf(arr)
          state.area = area
          state.perimeter = perimeter
          return `${area >= 1_000_000 ? `${(area / 1_000_000).toFixed(3)} km²` : `${area.toFixed(1)} m²`}`
        }, false),
        font: LABEL_FONT,
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.78),
        backgroundPadding: new C.Cartesian2(7, 4),
        horizontalOrigin: C.HorizontalOrigin.CENTER,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        pixelOffset: new C.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    dynamic.push(hint)
  }

  /** 高度量算：第一次点击为起点，第二次点击为终点 */
  function finishHeight(end: any) {
    const start = positions[0]
    const cartoA = C.Cartographic.fromCartesian(start)
    const cartoB = C.Cartographic.fromCartesian(end)
    const groundA = C.Cartesian3.fromRadians(cartoA.longitude, cartoA.latitude, 0)
    const groundB = C.Cartesian3.fromRadians(cartoB.longitude, cartoB.latitude, 0)

    state.horizontal = C.Cartesian3.distance(groundA, groundB)
    state.height = Math.abs(cartoB.height - cartoA.height)
    state.slope = Math.sqrt(state.horizontal ** 2 + state.height ** 2)
    state.angle = state.horizontal > 0 ? (Math.atan2(state.height, state.horizontal) * 180) / Math.PI : 0

    const top = C.Cartesian3.fromRadians(cartoA.longitude, cartoA.latitude, cartoB.height)

    viewer.entities.add({
      polyline: {
        positions: [start, top],
        width: 2,
        material: C.Color.fromCssColorString('#f97316'),
        depthFailMaterial: C.Color.fromCssColorString('#f97316').withAlpha(0.6),
      },
    })
    viewer.entities.add({
      polyline: {
        positions: [top, end],
        width: 2,
        material: C.Color.fromCssColorString('#22d3ee'),
      },
    })
    viewer.entities.add({
      polyline: {
        positions: [start, end],
        width: 2,
        material: C.Color.WHITE,
      },
    })
    marker(top)
    label(mid(start, top), `高差 ${state.height.toFixed(1)} m`, C.Color.fromCssColorString('#fdba74'))
    label(mid(top, end), `水平 ${state.horizontal.toFixed(1)} m`, C.Color.fromCssColorString('#67e8f9'))
    label(mid(start, end), `斜距 ${state.slope.toFixed(1)} m / ${state.angle.toFixed(1)}°`)
    cursor = null
    drawing = false
    state.mode = ''
  }

  function onClick(movement: any) {
    if (!drawing || !hasViewer()) return
    const pos = pick(movement.position)
    if (!pos) return

    if (state.mode === 'height') {
      if (!positions.length) {
        positions.push(pos)
        marker(pos)
        state.points = 1
        return
      }
      marker(pos)
      finishHeight(pos)
      state.points = 2
      return
    }

    positions.push(pos)
    state.points = positions.length
    marker(pos)

    if (state.mode === 'distance' && positions.length > 1) {
      const a = positions[positions.length - 2]
      const b = positions[positions.length - 1]
      const d = C.Cartesian3.distance(a, b)
      state.distance += d
      viewer.entities.add({
        polyline: {
          positions: [a, b],
          width: 2,
          material: C.Color.fromCssColorString('#22d3ee'),
        },
      })
      label(mid(a, b), `${d.toFixed(1)} m`, C.Color.fromCssColorString('#67e8f9'))
    }
  }

  function onMove(movement: any) {
    if (!drawing || state.mode === 'height' || !positions.length) return
    const pos = pick(movement.endPosition)
    if (pos) cursor = pos
  }

  function finish() {
    if (!drawing || !hasViewer()) return
    if (state.mode === 'area' && positions.length >= 3) {
      state.area = polygonArea(positions)
      state.perimeter = perimeterOf(positions)
      viewer.entities.add({
        polygon: {
          hierarchy: positions,
          material: C.Color.fromCssColorString('#22d3ee').withAlpha(0.28),
          outline: true,
          outlineColor: C.Color.fromCssColorString('#22d3ee'),
          outlineWidth: 2,
        },
      })
      label(
        C.BoundingSphere.fromPoints(positions).center,
        state.area >= 1_000_000 ? `${(state.area / 1_000_000).toFixed(3)} km²` : `${state.area.toFixed(1)} m²`,
      )
    }
    clearDynamic()
    cursor = null
    drawing = false
    state.mode = ''
  }

  function onDoubleClick() {
    finish()
  }

  function onRightClick() {
    finish()
  }

  function start(mode: MeasureMode) {
    if (!hasViewer()) return
    clear()
    state.mode = mode
    drawing = true
    positions = []
    if (mode === 'distance') bindDistancePreview()
    if (mode === 'area') bindAreaPreview()
    viewer.scene.canvas.style.cursor = 'crosshair'
  }

  function stop() {
    finish()
  }

  function clear() {
    if (!hasViewer()) return
    clearDynamic()
    viewer.entities.removeAll()
    positions = []
    cursor = null
    drawing = false
    state.mode = ''
    state.points = 0
    state.distance = 0
    state.area = 0
    state.perimeter = 0
    state.height = 0
    state.horizontal = 0
    state.slope = 0
    state.angle = 0
    viewer.scene.canvas.style.cursor = ''
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(onMove, C.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(onDoubleClick, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    handler.setInputAction(onRightClick, C.ScreenSpaceEventType.RIGHT_CLICK)

    return () => {
      if (!v.isDestroyed?.()) {
        clearDynamic()
        v.entities.removeAll()
        v.scene.canvas.style.cursor = ''
      }
      handler?.destroy()
      handler = null
      viewer = null
      C = null
      drawing = false
    }
  })

  return { state, start, stop, clear }
}
