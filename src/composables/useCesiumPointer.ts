import { reactive } from 'vue'
import { pickSurface } from '@/utils/gis/cesiumInit'
import { wgs84ToHk80 } from '@/utils/gis/coord'

export interface PointerState {
  valid: boolean
  lon: number
  lat: number
  height: number
  hk80E: number
  hk80N: number
}

/**
 * 鼠标位置追踪（经纬度 / 高程 / HK80 东向北向）
 * 使用 rAF 节流，避免 mousemove 期间高频拾取拖慢场景
 */
export function useCesiumPointer() {
  const position = reactive<PointerState>({
    valid: false,
    lon: 0,
    lat: 0,
    height: 0,
    hk80E: 0,
    hk80N: 0,
  })

  onCesiumReady((viewer, C) => {
    const canvas = viewer.scene.canvas
    const handler = new C.ScreenSpaceEventHandler(canvas)
    let raf = 0
    let endpoint: any = null

    const update = () => {
      raf = 0
      if (!endpoint) return
      const cartesian = pickSurface(C, viewer, endpoint)
      const carto = cartesian ? C.Cartographic.fromCartesian(cartesian) : null
      if (!carto) {
        position.valid = false
        return
      }
      const lon = C.Math.toDegrees(carto.longitude)
      const lat = C.Math.toDegrees(carto.latitude)
      const height = Number.isFinite(carto.height) ? carto.height : 0
      const [hk80E, hk80N] = wgs84ToHk80(lon, lat)
      Object.assign(position, { valid: true, lon, lat, height, hk80E, hk80N })
    }

    handler.setInputAction((movement: any) => {
      endpoint = movement.endPosition
      if (!raf) raf = requestAnimationFrame(update)
    }, C.ScreenSpaceEventType.MOUSE_MOVE)

    const onLeave = () => {
      position.valid = false
    }
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      handler.destroy()
      canvas.removeEventListener('mouseleave', onLeave)
      position.valid = false
    }
  })

  return position
}
