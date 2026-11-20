import { loadCss } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/**
 * Mapbox GL JS 加载器：完全本地化（npm 包 + public/vendor/mapbox），不依赖 CDN
 * 返回 `mapboxgl` 命名空间对象
 *
 * 说明：mapbox:// 官方样式与栅格源需要 accessToken，示例统一使用免 Key 的
 * Esri / OSM 瓦片样式，因此无需配置 token 也能完整演示。
 */
const CSS_URL = assetUrl('vendor/mapbox/mapbox-gl.css')

let promise: Promise<any> | null = null

export function loadMapbox(): Promise<any> {
  if (promise) return promise
  promise = (async () => {
    const [mod] = await Promise.all([import('mapbox-gl'), loadCss(CSS_URL)])
    return (mod as any).default ?? mod
  })()
  promise.catch(() => (promise = null))
  return promise
}
