import { reactive, ref, shallowRef } from 'vue'
import { getPinIcon } from '@/utils/gis/textures'

export interface PointStyle {
  color: string
  size: number
  icon: 'pin' | 'circle'
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
}

/**
 * 点位图层：批量点位 + 图标/颜色/大小/标注样式 + 聚合
 * 使用 CustomDataSource 管理，卸载时整源移除，点位实体不会残留
 */
export function useCesiumPoints() {
  const style = reactive<PointStyle>({
    color: '#2563eb',
    size: 28,
    icon: 'pin',
    showLabel: true,
    cluster: false,
    clusterRange: 48,
  })

  const points = shallowRef<DemoPoint[]>([])
  const ds = shallowRef<any>()

  let viewer: any = null
  let C: any = null

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
      })
    }
    return list
  }

  function addEntity(p: DemoPoint) {
    const position = C.Cartesian3.fromDegrees(p.lon, p.lat, 0)
    const shared = {
      position,
      properties: { id: p.id, name: p.name, value: p.value },
    }

    if (style.icon === 'pin') {
      return ds.value.entities.add({
        ...shared,
        billboard: {
          image: getPinIcon(style.color),
          width: style.size,
          height: style.size * 1.25,
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: style.showLabel
          ? {
              text: p.name,
              font: '12px MiSans, sans-serif',
              fillColor: C.Color.WHITE,
              showBackground: true,
              backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.72),
              backgroundPadding: new C.Cartesian2(6, 3),
              pixelOffset: new C.Cartesian2(0, 6),
              verticalOrigin: C.VerticalOrigin.TOP,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          : undefined,
      })
    }

    return ds.value.entities.add({
      ...shared,
      point: {
        pixelSize: style.size * 0.35,
        color: C.Color.fromCssColorString(style.color),
        outlineColor: C.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: style.showLabel
        ? {
            text: p.name,
            font: '12px MiSans, sans-serif',
            fillColor: C.Color.WHITE,
            showBackground: true,
            backgroundColor: new C.Color(0.06, 0.09, 0.13, 0.72),
            backgroundPadding: new C.Cartesian2(6, 3),
            pixelOffset: new C.Cartesian2(0, -16),
            verticalOrigin: C.VerticalOrigin.TOP,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }
        : undefined,
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
      if (!v.isDestroyed?.()) v.dataSources.remove(source, true)
      ds.value = undefined
      viewer = null
      C = null
    }
  })

  return { points, style, generate, setStyle, remove }
}
