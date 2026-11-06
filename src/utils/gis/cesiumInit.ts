/**
 * Cesium 默认 Viewer 配置：无 token 场景使用免费底图（OSM），并移除多余控件
 */
export function getViewerOptions(Cesium: any) {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '',
      }),
    ),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
  }
}

/**
 * 创建 Viewer（调用方负责在组件卸载时 destroy）
 * @param options 覆盖默认配置
 */
export function createViewer(Cesium: any, el: HTMLElement, options: Record<string, any> = {}) {
  const viewer = new Cesium.Viewer(el, { ...getViewerOptions(Cesium), ...options })
  // 隐藏版权 DOM（演示用途，生产请保留）
  viewer.cesiumWidget.creditContainer.style.display = 'none'
  return viewer
}

/** 屏幕坐标 -> 地球表面坐标 */
export function pickSurface(Cesium: any, viewer: any, windowPos: any) {
  return viewer.camera.pickEllipsoid(windowPos, viewer.scene.globe.ellipsoid)
}

/** 笛卡尔坐标 -> [lon, lat, height]（度） */
export function toLonLatHeight(Cesium: any, cartesian: any): [number, number, number] {
  const c = Cesium.Cartographic.fromCartesian(cartesian)
  return [
    Cesium.Math.toDegrees(c.longitude),
    Cesium.Math.toDegrees(c.latitude),
    c.height,
  ]
}
