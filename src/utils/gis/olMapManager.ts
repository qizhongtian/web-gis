/**
 * 地图模块化封装示例
 *
 * 把「创建地图 / 加图层 / 移除图层 / 缩放到数据 / 销毁」收敛到一个类里，
 * 业务组件只依赖这个类，方便替换引擎（如换成 MapLibre）或统一接入主题、埋点。
 */
import { createBaseLayer, createDemoMap } from './olDemo'

export interface OlMapManagerOptions {
  center?: [number, number]
  zoom?: number
  base?: 'osm' | 'light' | 'imagery' | 'topo' | 'none'
}

export class OlMapManager {
  readonly map: any
  private ol: any
  private layers = new Map<string, any>()

  constructor(ol: any, target: HTMLElement, options: OlMapManagerOptions = {}) {
    this.ol = ol
    this.map = createDemoMap(ol, target, {
      center: options.center ?? [116.407, 39.904],
      zoom: options.zoom ?? 10,
      base: options.base ?? 'light',
    })
  }

  /** 添加矢量图层 */
  addVectorLayer(id: string, features: any[], style?: any) {
    const layer = new this.ol.VectorLayer({
      source: new this.ol.VectorSource({ features }),
      style,
    })
    this.layers.set(id, layer)
    this.map.addLayer(layer)
    return layer
  }

  /** 添加任意图层 */
  addLayer(id: string, layer: any) {
    this.layers.set(id, layer)
    this.map.addLayer(layer)
    return layer
  }

  removeLayer(id: string) {
    const layer = this.layers.get(id)
    if (!layer) return
    this.map.removeLayer(layer)
    this.layers.delete(id)
  }

  clearLayers() {
    this.layers.forEach((layer) => this.map.removeLayer(layer))
    this.layers.clear()
  }

  getLayer(id: string) {
    return this.layers.get(id)
  }

  get size() {
    return this.layers.size
  }

  /** 缩放到所有矢量图层的数据范围 */
  fitAll(maxZoom = 15) {
    const extents: number[][] = []
    this.layers.forEach((layer) => {
      const source = layer.getSource?.()
      const extent = source?.getExtent?.()
      if (extent && Number.isFinite(extent[0])) extents.push(extent)
    })
    if (!extents.length) return
    const merged = extents.reduce(
      (acc, cur) => [
        Math.min(acc[0], cur[0]),
        Math.min(acc[1], cur[1]),
        Math.max(acc[2], cur[2]),
        Math.max(acc[3], cur[3]),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    )
    this.map.getView().fit(merged, { padding: [60, 60, 60, 60], maxZoom })
  }

  setBase(kind: 'osm' | 'light' | 'imagery' | 'topo' | 'none') {
    this.map.getLayers().setAt(0, createBaseLayer(this.ol, kind))
  }

  destroy() {
    this.clearLayers()
    this.map.setTarget(null)
  }
}
