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
 * 轻量 OSM Nominatim 地理编码服务
 * Cesium 默认 geocoder 走 ion（需要 token），未配 token 时搜索必失败；
 * 这里按 GeocoderService 接口实现 geocode，作为数组传给 viewer.geocoder 即可。
 */
export function createNominatimGeocoderService(Cesium: any) {
  return {
    async geocode(query: string, type?: number) {
      // 输入联想每敲一个字符都会调用，公共 Nominatim 接口不允许这种频率，直接跳过
      if (type === Cesium.GeocodeType.AUTOCOMPLETE) return []
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '5')
      url.searchParams.set('accept-language', 'zh-CN,zh,en')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Nominatim 请求失败：${res.status}`)
      const list = (await res.json()) as Array<{ display_name: string; lon: string; lat: string }>
      return list
        .filter((item) => item?.lon && item?.lat)
        .map((item) => ({
          displayName: item.display_name,
          destination: Cesium.Cartesian3.fromDegrees(Number(item.lon), Number(item.lat)),
        }))
    },
  }
}

/**
 * 打开 Cesium 自带的默认控件（Viewer 里默认被关掉的那一批）
 * - 底图选择器用免 Token 底图清单，未配置 ion token 也不会选中报错的在线底图
 * - 地名搜索用 OSM Nominatim，无需 token
 * - 注意：给了 baseLayer 会覆盖 selectedImageryProviderViewModel，所以这里显式置空
 */
export function getDefaultWidgetOptions(Cesium: any) {
  // 1.140 里 ImageryProviderViewModel 已改名为 ProviderViewModel，两者不要混用
  const imageryProviderViewModels = [
    new Cesium.ProviderViewModel({
      name: 'OpenStreetMap',
      tooltip: 'OSM 标准底图（免 Token）',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/openStreetMap.png'),
      category: '免 Token 底图',
      creationFunction: () =>
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '',
        }),
    }),
    new Cesium.ProviderViewModel({
      name: 'ArcGIS 影像',
      tooltip: 'ArcGIS World Imagery（免 Token）',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/ArcGisMapServiceWorldImagery.png'),
      category: '免 Token 底图',
      creationFunction: () =>
        Cesium.ArcGisMapServerImageryProvider.fromBasemapType(Cesium.ArcGisBaseMapType.SATELLITE, {
          enablePickFeatures: false,
        }),
    }),
  ]

  return {
    baseLayer: undefined,
    baseLayerPicker: true,
    imageryProviderViewModels,
    selectedImageryProviderViewModel: imageryProviderViewModels[0],
    geocoder: [createNominatimGeocoderService(Cesium)],
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: true,
    // 帮助面板默认收起，点问号再看（否则首次进入会盖住半张图）
    navigationHelpButtonOptions: { instructionsInitiallyVisible: false },
    // 时钟面板（112px 高）会压住底部状态条，这里只保留时间轴
    animation: false,
    timeline: true,
    fullscreenButton: true,
    infoBox: true,
    selectionIndicator: true,
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
  // 挂到容器上，供通用容器（DemoBox）找到 viewer 并挂载状态工具条
  ;(el as any).__cesiumViewer = viewer
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
