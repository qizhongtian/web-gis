import { reactive } from 'vue'
import { onCesiumReady } from '@/composables/useCesium'
import { formatArea, formatDistance } from '@/utils/gis/coord'

export type MeasureMode = 'distance' | 'area' | 'height'

export interface MeasureState {
  mode: MeasureMode | ''
  /** 是否正在取点 */
  drawing: boolean
  /** 节点数 */
  points: number
  /** 段数（测距）/ 边数（测面） */
  segments: number
  distance: number
  area: number
  perimeter: number
  height: number
  horizontal: number
  slope: number
  angle: number
}

const FONT = '12px "JetBrains Mono", MiSans, "Microsoft YaHei", monospace'
const C_CYAN = '#22d3ee'
const C_GREEN = '#34d399'
const C_ORANGE = '#fb923c'
const C_WHITE = '#e8f6ff'
const C_DEL = '#f87171'

interface MeasureNode {
  position: any
  entity: any
}

interface SegmentRef {
  line: any
  label: any
  del: any
  action: { type: string, index: number }
}

interface EdgeRef {
  line: any
  label: any
}

/**
 * 空间量算（测距 / 测面 / 测高）
 * - 单击取点，双击（或右键）结束
 * - 节点带圆圈，每段标注距离；测距每段都有删除按钮，删到只剩一个节点即清空全部
 * - 节点可拖拽，拖拽时实时重算线段、边长、面积与高差
 * - 所有实体放在 CustomDataSource 中，清空 / 销毁一次性回收
 */
export function useCesiumMeasure() {
  const state = reactive<MeasureState>({
    mode: '',
    drawing: false,
    points: 0,
    segments: 0,
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
  let ds: any = null

  /** 已落点 */
  let nodes: MeasureNode[] = []
  /** 测距：每段实体 */
  let segs: SegmentRef[] = []
  /** 测面：每条边实体 */
  let edges: EdgeRef[] = []
  let areaPoly: any = null
  let areaLabel: any = null
  let heightGeo: any = null

  /** 取点过程中的预览线 / 标签 */
  let previewLine: any = null
  let previewLabel: any = null
  let cursor: any = null

  let drawing = false
  let dragNode: MeasureNode | null = null
  let dragMoved = false
  let suppressClick = 0
  let lastClick = 0
  let lastPos = { x: 0, y: 0 }

  const hasViewer = () => !!viewer && !viewer.isDestroyed?.()
  const clr = (hex: string) => C.Color.fromCssColorString(hex)
  const midOf = (a: any, b: any) => C.Cartesian3.midpoint(a, b, new C.Cartesian3())

  /**
   * @param strict 取点用严格模式：先隐藏量算图层并强制重绘一帧，
   *   否则 pickPosition 会从深度缓冲里读到自己的点 / 线 / 标签，取回悬空的点。
   */
  function pickWorld(windowPos: any, strict = false) {
    if (!hasViewer()) return null
    const scene = viewer.scene
    const hide = strict && !!ds
    if (hide) {
      ds.show = false
      scene.render()
    }
    try {
      // 优先深度拾取：能贴合地形与倾斜摄影模型表面
      if (scene.pickPositionSupported && typeof scene.pickPosition === 'function') {
        const p = scene.pickPosition(windowPos)
        if (p) return p
      }
      const ray = viewer.camera.getPickRay(windowPos)
      if (ray) {
        const g = scene.globe.pick(ray, scene)
        if (g) return g
      }
      return viewer.camera.pickEllipsoid(windowPos, scene.globe.ellipsoid)
    } finally {
      if (hide) ds.show = true
    }
  }

  /**
   * 穿透拾取：测面时多边形盖在节点上方，用 drillPick 才能拿到下面的节点 / 删除按钮。
   */
  function pickInteractive(windowPos: any) {
    if (!hasViewer()) return { node: null, action: null }
    const list: any[] = viewer.scene.drillPick(windowPos, 10) || []
    for (const item of list) {
      const id = item?.id
      if (id?.__measureNode) return { node: id.__measureNode, action: null }
      if (id?.__measureAction) return { node: null, action: id.__measureAction }
    }
    return { node: null, action: null }
  }

  function labelStyle(hex: string, offsetY = -16, originBottom = true, offsetX = 0) {
    return {
      font: FONT,
      fillColor: clr(hex),
      showBackground: true,
      backgroundColor: new C.Color(0.05, 0.11, 0.18, 0.82),
      backgroundPadding: new C.Cartesian2(6, 4),
      horizontalOrigin: C.HorizontalOrigin.CENTER,
      verticalOrigin: originBottom ? C.VerticalOrigin.BOTTOM : C.VerticalOrigin.TOP,
      pixelOffset: new C.Cartesian2(offsetX, offsetY),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }
  }

  /** 贴地形 + 贴倾斜摄影模型表面 */
  const classifyGround = () => C.ClassificationType?.BOTH ?? C.ClassificationType?.TERRAIN ?? 0

  function createLine(positions: any[], hex: string, width = 2, dashed = false) {
    const c = clr(hex)
    return ds.entities.add({
      polyline: {
        positions,
        width,
        arcType: C.ArcType.NONE,
        material: dashed ? new C.PolylineDashMaterialProperty({ color: c, dashLength: 14 }) : c,
        // 被建筑挡住的部分半透明显示，而不是整体前移（前移会污染 pickPosition 的深度）
        depthFailMaterial: c.withAlpha(0.45),
      },
    })
  }

  /* ---------------- 表面吸附（地形 + 倾斜摄影） ---------------- */

  let snapSeq = 0
  let snapQueue: Promise<any> = Promise.resolve()

  /** 按测地线把两点加密成稀疏采样点（高度置 0，交给 clamp 求表面高度） */
  function densify(a: any, b: any, spacing: number) {
    const ca = C.Cartographic.fromCartesian(a)
    const cb = C.Cartographic.fromCartesian(b)
    if (!ca || !cb) return [a, b]
    const geo = new C.EllipsoidGeodesic(ca, cb, C.Ellipsoid.WGS84)
    const step = Math.max(1, Math.min(160, Math.ceil(geo.surfaceDistance / spacing)))
    const list: any[] = []
    for (let k = 0; k <= step; k++) {
      const c = geo.interpolateUsingFraction(k / step, new C.Cartographic())
      list.push(C.Cartesian3.fromRadians(c.longitude, c.latitude, 0))
    }
    return list
  }

  /**
   * 逐点吸附到「地形 + 倾斜摄影模型」表面。
   * clampToHeightMostDetailed 做离屏深度拾取，能贴住 3D Tiles 的楼顶 / 立面。
   */
  function snapToSurface(a: any, b: any, spacing: number): Promise<any[]> {
    const dense = densify(a, b, spacing)
    if (!hasViewer() || typeof viewer.scene.clampToHeightMostDetailed !== 'function') {
      return Promise.resolve([a, b])
    }
    const run = () => viewer.scene.clampToHeightMostDetailed(dense.slice(), ds.entities.values.slice(), 4)
    const task = snapQueue.then(run, run).then(
      (out: any[]) => {
        if (!out || out.length !== dense.length) return [a, b]
        // 逐点对齐：拾取失败的点退回地形高度，绝不改变点数（否则线与节点错位）
        const pts = dense.map((p, i) => out[i] || onTerrain(p))
        // 首末点直接取节点原始位置，保证线头线尾与节点重合
        pts[0] = a
        pts[pts.length - 1] = b
        return pts
      },
      () => [a, b],
    )
    snapQueue = task.then(() => undefined, () => undefined)
    return task
  }

  /** 拾取失败时退回地形高度（而不是椭球面 0 高度沉到地下） */
  function onTerrain(p: any) {
    const c = C.Cartographic.fromCartesian(p)
    if (!c) return p
    const h = viewer.scene.globe.getHeight(c)
    return C.Cartesian3.fromRadians(c.longitude, c.latitude, h ?? 0)
  }

  /**
   * 设置一条线的位置：先给直线，异步吸附后用加密折线替换。
   * 拖拽中（dragNode 存在）只画直线，避免每帧发起离屏拾取。
   */
  function snapLine(entity: any, a: any, b: any, spacing = 6) {
    if (!entity?.polyline) return
    if (dragNode) {
      entity.__snapKey = ''
      entity.polyline.positions = [a, b]
      return
    }
    const key = `${a.x},${a.y},${a.z}|${b.x},${b.y},${b.z}|${spacing}`
    if (entity.__snapKey === key) return
    entity.__snapKey = key
    entity.polyline.positions = [a, b]
    const token = ++snapSeq
    entity.__snapToken = token
    snapToSurface(a, b, spacing).then((pts) => {
      if (!entity.polyline || entity.__snapToken !== token) return
      entity.polyline.positions = pts
    })
  }

  /** 地表距离：贴地测量按椭球面长度计算，与贴地线的视觉长度一致 */
  function groundDistance(a: any, b: any) {
    const ca = C.Cartographic.fromCartesian(a)
    const cb = C.Cartographic.fromCartesian(b)
    if (!ca || !cb) return C.Cartesian3.distance(a, b)
    return new C.EllipsoidGeodesic(ca, cb, C.Ellipsoid.WGS84).surfaceDistance
  }

  /** 节点：空心小圆点（透明填充 + 青色圆环），始终画在模型前面 */
  function createNode(position: any): MeasureNode {
    const node: MeasureNode = { position: C.Cartesian3.clone(position), entity: null }
    node.entity = ds.entities.add({
      position: node.position,
      point: {
        pixelSize: 9,
        color: C.Color.WHITE.withAlpha(0.12),
        outlineColor: clr(C_CYAN),
        outlineWidth: 2,
        // 点落在模型表面，不做深度测试才能整个圆都露出来
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    node.entity.__measureNode = node
    return node
  }

  function removeEntity(e: any) {
    if (e && ds) ds.entities.remove(e)
  }

  /* ---------------- 测距 ---------------- */

  function createSegment(): SegmentRef {
    const action = { type: 'deleteSegment', index: 0 }
    // 删除按钮：叉号，贴在段终点节点的右上方
    const del = ds.entities.add({
      label: {
        text: '×',
        font: '13px "JetBrains Mono", MiSans, sans-serif',
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: clr(C_DEL).withAlpha(0.9),
        backgroundPadding: new C.Cartesian2(4, 2),
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        horizontalOrigin: C.HorizontalOrigin.LEFT,
        pixelOffset: new C.Cartesian2(9, -7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    del.__measureAction = action
    return {
      line: createLine([], C_CYAN),
      label: ds.entities.add({ label: labelStyle(C_WHITE, -14) }),
      del,
      action,
    }
  }

  function rebuildDistance() {
    const need = Math.max(nodes.length - 1, 0)
    while (segs.length < need) segs.push(createSegment())
    while (segs.length > need) {
      const s = segs.pop()!
      removeEntity(s.line)
      removeEntity(s.label)
      removeEntity(s.del)
    }

    let total = 0
    for (let i = 0; i < need; i++) {
      const a = nodes[i].position
      const b = nodes[i + 1].position
      const d = groundDistance(a, b)
      total += d
      const mid = midOf(a, b)
      const seg = segs[i]
      snapLine(seg.line, a, b, 6)
      seg.label.position = mid
      seg.label.label.text = formatDistance(d)
      // 叉号挂在段终点节点的右上角
      seg.del.position = b
      seg.action.index = i
    }
    state.distance = total
    state.segments = need
    state.points = nodes.length
  }

  function deleteSegment(index: number) {
    if (state.mode !== 'distance') return
    const node = nodes[index + 1]
    if (!node) return
    removeEntity(node.entity)
    nodes.splice(index + 1, 1)
    // 删到只剩一个节点：整体清空
    if (nodes.length < 2) {
      clear()
      return
    }
    rebuildDistance()
  }

  /* ---------------- 测面 ---------------- */

  function createEdge(): EdgeRef {
    return {
      line: createLine([], C_GREEN),
      label: ds.entities.add({ label: labelStyle(C_GREEN, -12) }),
    }
  }

  function ensureAreaGeometry() {
    if (areaPoly) return
    areaPoly = ds.entities.add({
      polygon: {
        hierarchy: new C.PolygonHierarchy([]),
        // 不设 perPositionHeight：贴地表 / 倾斜模型表面铺面
        material: clr(C_CYAN).withAlpha(0.15),
        outline: false,
        classificationType: classifyGround(),
      },
      show: false,
    })
    areaLabel = ds.entities.add({ label: labelStyle(C_WHITE, 0), show: false })
  }

  /** @param withCursor 取点过程中把鼠标位置作为临时末点，实时预览 */
  function rebuildArea(withCursor = false) {
    const pos: any[] = nodes.map((n) => n.position)
    if (withCursor && cursor) pos.push(cursor)
    const n = pos.length
    if (!n) {
      state.points = nodes.length
      return
    }

    const closed = n >= 3 && !withCursor
    const edgeCount = closed ? n : Math.max(n - 1, 0)
    while (edges.length < edgeCount) edges.push(createEdge())
    while (edges.length > edgeCount) {
      const e = edges.pop()!
      removeEntity(e.line)
      removeEntity(e.label)
    }

    let perimeter = 0
    for (let i = 0; i < edgeCount; i++) {
      const a = pos[i]
      const b = pos[(i + 1) % n]
      const d = groundDistance(a, b)
      perimeter += d
      const edge = edges[i]
      // 跟随鼠标的临时边只画直线，定型后再吸附
      if (withCursor && i === edgeCount - 1) {
        edge.line.__snapKey = ''
        edge.line.polyline.positions = [a, b]
      } else {
        snapLine(edge.line, a, b, 6)
      }
      edge.label.position = midOf(a, b)
      edge.label.label.text = formatDistance(d)
    }

    ensureAreaGeometry()
    const area = n >= 3 ? polygonArea(pos) : 0
    if (n >= 3) {
      areaPoly.show = true
      areaPoly.polygon.hierarchy = new C.PolygonHierarchy(pos)
      areaLabel.show = true
      areaLabel.position = C.BoundingSphere.fromPoints(pos).center
      areaLabel.label.text = `面积 ${formatArea(area)}`
    } else {
      areaPoly.show = false
      areaLabel.show = false
    }

    state.area = area
    state.perimeter = perimeter
    state.segments = edgeCount
    state.points = nodes.length
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

  /* ---------------- 测高 ---------------- */

  function ensureHeightGeometry() {
    if (heightGeo) return
    heightGeo = {
      // 垂直三角形不吸附表面，并关闭深度测试，避免被建筑切断
      vLine: createLine([], C_ORANGE),
      hLine: createLine([], C_CYAN),
      dLine: createLine([], C_WHITE, 2, true),
      vLabel: ds.entities.add({ label: labelStyle(C_ORANGE, 0, true, -54) }),
      hLabel: ds.entities.add({ label: labelStyle(C_CYAN, -18, true) }),
      dLabel: ds.entities.add({ label: labelStyle(C_WHITE, 16, false) }),
    }
  }

  function rebuildHeight() {
    if (nodes.length < 2) return
    ensureHeightGeometry()
    const a = nodes[0].position
    const b = nodes[1].position
    const ca = C.Cartographic.fromCartesian(a)
    const cb = C.Cartographic.fromCartesian(b)

    // 垂直直角三角形：底端取较低点，直角顶点在底端正上方、与高点同高
    const firstIsLower = ca.height <= cb.height
    const baseC = firstIsLower ? ca : cb
    const topC = firstIsLower ? cb : ca
    const base = firstIsLower ? a : b
    const top = firstIsLower ? b : a
    const corner = C.Cartesian3.fromRadians(baseC.longitude, baseC.latitude, topC.height)

    state.height = Math.abs(topC.height - baseC.height)
    state.horizontal = C.Cartesian3.distance(corner, top)
    state.slope = C.Cartesian3.distance(base, top)
    state.angle = state.horizontal > 0
      ? (Math.atan2(state.height, state.horizontal) * 180) / Math.PI
      : 90

    heightGeo.vLine.polyline.positions = [base, corner]
    heightGeo.hLine.polyline.positions = [corner, top]
    heightGeo.dLine.polyline.positions = [base, top]

    heightGeo.vLabel.position = midOf(base, corner)
    heightGeo.vLabel.label.text = `高差 ${state.height.toFixed(1)} m`
    heightGeo.hLabel.position = midOf(corner, top)
    heightGeo.hLabel.label.text = `水平 ${formatDistance(state.horizontal)}`
    heightGeo.dLabel.position = midOf(base, top)
    heightGeo.dLabel.label.text = `斜距 ${formatDistance(state.slope)} · ${state.angle.toFixed(1)}°`

    state.points = nodes.length
    state.segments = 1
  }

  /* ---------------- 预览 ---------------- */

  function ensurePreview() {
    if (previewLine) return
    previewLine = createLine([], C_CYAN, 2, true)
    previewLine.show = false
    previewLabel = ds.entities.add({ label: labelStyle(C_WHITE, -16), show: false })
  }

  let previewTimer: any = null

  function hidePreview() {
    clearTimeout(previewTimer)
    if (previewLine) previewLine.show = false
    if (previewLabel) previewLabel.show = false
  }

  function updatePreview() {
    if (!drawing || !nodes.length || !cursor) {
      hidePreview()
      return
    }
    const last = nodes[nodes.length - 1].position
    ensurePreview()
    previewLine.show = true
    previewLine.polyline.positions = [last, cursor]
    // 位置已被重置为直线，清掉缓存键，保证防抖后的吸附还会执行
    previewLine.__snapKey = ''
    previewLabel.show = true
    previewLabel.position = midOf(last, cursor)
    previewLabel.label.text = formatDistance(groundDistance(last, cursor))
    // 鼠标停稳后再把预览线吸附到表面，避免移动时反复做离屏拾取
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      if (!drawing || !cursor || !previewLine) return
      snapLine(previewLine, last, cursor, 20)
    }, 220)
  }

  function rebuild() {
    if (state.mode === 'distance') rebuildDistance()
    else if (state.mode === 'area') rebuildArea()
    else if (state.mode === 'height') rebuildHeight()
  }

  /* ---------------- 交互 ---------------- */

  function addPoint(pos: any) {
    nodes.push(createNode(pos))
    state.points = nodes.length
    // 高差只需两点，第二点落下即完成
    if (state.mode === 'height' && nodes.length >= 2) {
      cursor = null
      finish()
      return
    }
    rebuild()
  }

  /** 双击结束时会多落一个重复点，收尾时去掉 */
  function dropDuplicateTail() {
    while (nodes.length >= 2) {
      const a = nodes[nodes.length - 2].position
      const b = nodes[nodes.length - 1].position
      if (C.Cartesian3.distance(a, b) > 0.2) break
      removeEntity(nodes.pop()!.entity)
    }
  }

  function finish() {
    if (!drawing || !hasViewer()) return
    dropDuplicateTail()
    drawing = false
    state.drawing = false
    cursor = null
    hidePreview()
    viewer.scene.canvas.style.cursor = ''
    if (nodes.length < 2 || (state.mode === 'area' && nodes.length < 3)) {
      clear()
      return
    }
    rebuild()
  }

  function onClick(movement: any) {
    if (!hasViewer()) return
    const now = performance.now()
    const p = movement.position
    // 双击判定：第二次点击与上一次的时间 / 位置足够接近则结束取点
    if (drawing && now - lastClick < 320 && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 8) {
      lastClick = 0
      finish()
      return
    }
    lastClick = now
    lastPos = p
    if (now < suppressClick) return

    const { action } = pickInteractive(p)
    if (action) {
      if (action.type === 'deleteSegment') deleteSegment(action.index)
      return
    }
    if (!drawing) return
    const pos = pickWorld(p, true)
    if (pos) addPoint(pos)
  }

  function onDown(movement: any) {
    if (!hasViewer()) return
    const { node } = pickInteractive(movement.position)
    if (!node) return
    dragNode = node
    dragMoved = false
    suppressClick = performance.now() + 350
    viewer.scene.screenSpaceCameraController.enableInputs = false
    viewer.scene.canvas.style.cursor = 'grabbing'
  }

  function onMove(movement: any) {
    if (!hasViewer()) return
    if (dragNode) {
      const pos = pickWorld(movement.endPosition, true)
      if (pos) {
        const next = C.Cartesian3.clone(pos)
        dragNode.position = next
        dragNode.entity.position = next
        dragMoved = true
        rebuild()
      }
      return
    }
    if (!drawing) {
      hoverCursor(movement.endPosition)
      return
    }
    const pos = pickWorld(movement.endPosition)
    if (pos) {
      cursor = pos
      if (state.mode === 'area') rebuildArea(true)
      else updatePreview()
    }
  }

  function hoverCursor(winPos: any) {
    const { node, action } = pickInteractive(winPos)
    const el = viewer.scene.canvas
    if (action) el.style.cursor = 'pointer'
    else if (node) el.style.cursor = 'move'
    else el.style.cursor = ''
  }

  function onUp() {
    if (!dragNode) return
    const moved = dragMoved
    dragNode = null
    viewer.scene.screenSpaceCameraController.enableInputs = true
    viewer.scene.canvas.style.cursor = ''
    if (moved) {
      suppressClick = performance.now() + 350
      // 拖拽结束后重新吸附到模型表面
      rebuild()
    }
  }

  /* ---------------- 对外 API ---------------- */

  function start(mode: MeasureMode) {
    if (!hasViewer()) return
    clear()
    state.mode = mode
    state.drawing = true
    drawing = true
    cursor = null
    ensurePreview()
    viewer.scene.canvas.style.cursor = 'crosshair'
  }

  function undo() {
    const node = nodes.pop()
    if (node) removeEntity(node.entity)
    if (nodes.length < 2) {
      clear()
      return
    }
    rebuild()
  }

  function clear() {
    if (viewer && !viewer.isDestroyed?.()) viewer.scene.canvas.style.cursor = ''
    drawing = false
    cursor = null
    dragNode = null
    nodes = []
    segs = []
    edges = []
    areaPoly = null
    areaLabel = null
    heightGeo = null
    previewLine = null
    previewLabel = null
    if (ds) ds.entities.removeAll()
    Object.assign(state, {
      mode: '',
      drawing: false,
      points: 0,
      segments: 0,
      distance: 0,
      area: 0,
      perimeter: 0,
      height: 0,
      horizontal: 0,
      slope: 0,
      angle: 0,
    })
  }

  onCesiumReady((v, cesium) => {
    viewer = v
    C = cesium
    ds = new C.CustomDataSource('measure')
    v.dataSources.add(ds)
    // 关掉 Viewer 默认的双击缩放，否则双击结束时相机会飞向量算点
    v.cesiumWidget?.screenSpaceEventHandler?.removeInputAction?.(
      C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    )
    handler = new C.ScreenSpaceEventHandler(v.scene.canvas)

    handler.setInputAction((m: any) => onClick(m), C.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction((m: any) => onDown(m), C.ScreenSpaceEventType.LEFT_DOWN)
    handler.setInputAction((m: any) => onMove(m), C.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(() => onUp(), C.ScreenSpaceEventType.LEFT_UP)
    handler.setInputAction(() => finish(), C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    handler.setInputAction(() => finish(), C.ScreenSpaceEventType.RIGHT_CLICK)

    return () => {
      handler?.destroy?.()
      handler = null
      clear()
      if (!v.isDestroyed?.() && ds) v.dataSources.remove(ds, true)
      ds = null
      viewer = null
      C = null
    }
  })

  return { state, start, undo, clear }
}

