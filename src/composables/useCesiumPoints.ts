import { reactive, shallowRef } from 'vue'
import { assetUrl } from '@/utils/publicUrl'

export interface PointStyle {
  color: string
  size: number
  icon: 'image' | 'circle'
  showLabel: boolean
  cluster: boolean
  clusterRange: number
}

export interface DemoPoint {
  id: number
  lon: number
  lat: number
  name: string
  value: number
  /** 随机分配到的图钉序号（下标指向 ICONS），重建样式时保持不变 */
  icon: number
}

/** public/image 下的图钉：跳过不存在的 map-pin-01 */
export const ICONS = [0, ...Array.from({ length: 23 }, (_, i) => i + 2)].map(
  (n) => assetUrl(`image/map-pin-${String(n).padStart(2, '0')}.png`),
)
/** 图钉原图 108x124，按宽度等比换算高度 */
export const ICON_RATIO = 124 / 108

/** label 统一风格：黄字 + 黑描边 */
const LABEL_FILL = '#ffd400'
const LABEL_STROKE = '#000000'

type ClusterBadge = { url: string; size: number }
const badgeCache = new Map<number, ClusterBadge>()

/** 数量分段配色：蓝 → 琥珀 → 橙 → 红，一眼看出聚合密度 */
function tierColors(n: number): [string, string] {
  if (n < 10) return ['#60a5fa', '#2563eb']
  if (n < 50) return ['#fbbf24', '#f59e0b']
  if (n < 200) return ['#fb923c', '#ea580c']
  return ['#f87171', '#dc2626']
}

/**
 * 聚合图标：光晕 + 渐变球 + 内外双环 + 计数 + 「点位」小字，
 * 不是干巴巴一个数字。
 * 按最终显示像素 1:1 排版、再乘 2 倍分辨率绘制，缩小后文字依然清晰；
 * 画一次缓存起来，同数量复用。
 */
export function makeClusterBadge(n: number): ClusterBadge {
  const size = Math.round(56 + Math.min(22, Math.log2(n) * 4.5)) // 显示尺寸 58~78
  const dpr = 2
  const S = size * dpr
  const c = S / 2
  const R = c * 0.78 // 球体，外圈留给光晕
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')!
  const [c1, c2] = tierColors(n)

  // 外圈光晕
  const halo = ctx.createRadialGradient(c, c, R, c, c, c)
  halo.addColorStop(0, hexToRgba(c1, 0.34))
  halo.addColorStop(1, hexToRgba(c1, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.fill()

  // 主体渐变球
  const g = ctx.createLinearGradient(c, c - R, c, c + R)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.beginPath()
  ctx.arc(c, c, R, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()

  // 左上高光，做出球感
  const hl = ctx.createRadialGradient(c - R * 0.38, c - R * 0.46, R * 0.08, c - R * 0.3, c - R * 0.3, R * 1.05)
  hl.addColorStop(0, 'rgba(255,255,255,0.5)')
  hl.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(c, c, R, 0, Math.PI * 2)
  ctx.fillStyle = hl
  ctx.fill()

  // 白色描边 + 外侧细环
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 2.5 * dpr
  ctx.beginPath()
  ctx.arc(c, c, R - 1.25 * dpr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.5 * dpr
  ctx.beginPath()
  ctx.arc(c, c, R + 4 * dpr, 0, Math.PI * 2)
  ctx.stroke()

  // 计数
  const num = String(n)
  const numRatio = num.length <= 2 ? 0.44 : num.length === 3 ? 0.37 : 0.3
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(size * numRatio * dpr)}px "DIN Alternate", "MiSans", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(15,23,42,0.35)'
  ctx.shadowBlur = 3 * dpr
  ctx.shadowOffsetY = 0.5 * dpr
  ctx.fillText(num, c, c - R * 0.22)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 小字说明，避免只剩一个数字
  ctx.font = `600 ${Math.round(size * 0.155 * dpr)}px "MiSans", "Microsoft YaHei", sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText('点 位', c, c + R * 0.55)

  return { url: canvas.toDataURL('image/png'), size }
}

function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 聚合计数的展示尺寸：数量越大越显眼，但封顶，避免糊成一片 */

/**
 * 点位图层：批量点位 + 图标/颜色/大小/标注样式 + 聚合
 * 使用 CustomDataSource 管理，卸载时整源移除，点位实体不会残留
 */
export function useCesiumPoints() {
  const style = reactive<PointStyle>({
    color: '#2563eb',
    size: 32,
    icon: 'image',
    showLabel: true,
    cluster: true,
    clusterRange: 48,
  })

  const points = shallowRef<DemoPoint[]>([])
  const ds = shallowRef<any>()

  let viewer: any = null
  let C: any = null
  let clusterListener: ((entities: any[], cluster: any) => void) | null = null

  function randomPoints(count: number, center: [number, number] = [114.1694, 22.3193]) {
    const list: DemoPoint[] = []
    for (let i = 0; i < count; i++) {
      // 约 ±0.08° 的随机分布，贴近城市尺度
      const lon = center[0] + (Math.random() - 0.5) * 0.16
      const lat = center[1] + (Math.random() - 0.5) * 0.12
      list.push({
        id: i + 1,
        lon,
        lat,
        name: `监测点 ${i + 1}`,
        value: Math.round(Math.random() * 100),
        // 每点随机一张图钉，生成后就固定，改样式不会跳图
        icon: Math.floor(Math.random() * ICONS.length),
      })
    }
    return list
  }

  /** 图标上方的标注：黄字 + 黑描边，贴在图标顶端 */
  function labelOf(p: DemoPoint, offsetY: number) {
    if (!style.showLabel) return undefined
    return {
      text: p.name,
      font: '600 13px MiSans, "Microsoft YaHei", sans-serif',
      fillColor: C.Color.fromCssColorString(LABEL_FILL),
      outlineColor: C.Color.fromCssColorString(LABEL_STROKE),
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      // BOTTOM 锚在图标顶部，再整体上移一个图标高度
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, offsetY),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // 远看时几百个名字会糊成一片，拉近到 12km 内再显示
      distanceDisplayCondition: new C.DistanceDisplayCondition(0, 12000),
    }
  }

  function addEntity(p: DemoPoint) {
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, 0)
    const shared = {
      position,
      properties: { id: p.id, name: p.name, value: p.value, icon: p.icon },
    }

    if (style.icon === 'image') {
      const h = style.size * ICON_RATIO
      return ds.value.entities.add({
        ...shared,
        billboard: {
          image: ICONS[p.icon % ICONS.length],
          width: style.size,
          height: h,
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        // 图标上方 4px 处，让 label 底边刚好离开针尖
        label: labelOf(p, -h - 4),
      })
    }

    const dot = style.size * 0.4
    return ds.value.entities.add({
      ...shared,
      point: {
        pixelSize: dot,
        color: C.Color.fromCssColorString(style.color),
        outlineColor: C.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: labelOf(p, -dot / 2 - 6),
    })
  }

  function rebuild() {
    if (!viewer || !ds.value) return
    ds.value.entities.removeAll()
    points.value.forEach((p) => addEntity(p))
  }

  function applyCluster() {
    if (!ds.value) return
    const clustering = ds.value.clustering
    clustering.enabled = style.cluster
    clustering.pixelRange = style.clusterRange
    clustering.minimumClusterSize = 2

    // 自定义聚合样式：只挂一次，靠 enabled 开关生效
    if (!clusterListener) {
      clusterListener = (entities: any[], cluster: any) => {
        const n = entities.length
        let badge = badgeCache.get(n)
        if (!badge) {
          badge = makeClusterBadge(n)
          if (badgeCache.size > 400) badgeCache.clear()
          badgeCache.set(n, badge)
        }
        cluster.billboard.show = true
        cluster.billboard.image = badge.url
        cluster.billboard.width = badge.size
        cluster.billboard.height = badge.size
        cluster.billboard.verticalOrigin = C.VerticalOrigin.CENTER
        cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
        // 数字已经画在气泡里了，不要再叠一个 label
        cluster.label.show = false
      }
      clustering.clusterEvent.addEventListener(clusterListener)
    }
  }

  function generate(count = 300, center?: [number, number]) {
    if (!viewer) return
    points.value = randomPoints(count, center)
    rebuild()
    applyCluster()
  }

  /** 修改样式：图标需全量重建，其余属性同样重建以保证聚合图标一致 */
  function setStyle(patch: Partial<PointStyle>) {
    Object.assign(style, patch)
    rebuild()
    applyCluster()
  }

  function remove() {
    if (ds.value && viewer && !viewer.isDestroyed?.()) viewer.dataSources.remove(ds.value, true)
    ds.value = undefined
    points.value = []
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    const source = new C.CustomDataSource('demo-points')
    ds.value = source
    v.dataSources.add(source)

    return () => {
      if (source.clustering && clusterListener) {
        source.clustering.clusterEvent.removeEventListener(clusterListener)
        clusterListener = null
      }
      if (!v.isDestroyed?.()) v.dataSources.remove(source, true)
      ds.value = undefined
      viewer = null
      C = null
    }
  })

  return { points, style, generate, setStyle, remove }
}
