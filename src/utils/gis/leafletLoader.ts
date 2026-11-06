import { loadCss } from '@/utils/loadScript'

/**
 * Leaflet 加载器：完全本地化（npm 包 + public/vendor/leaflet），不依赖 CDN
 * 返回全局 `L` 命名空间对象
 */
const CSS_URL = '/vendor/leaflet/leaflet.css'

let promise: Promise<any> | null = null

export function loadLeaflet(): Promise<any> {
  if (promise) return promise
  promise = (async () => {
    const [mod] = await Promise.all([import('leaflet'), loadCss(CSS_URL)])
    return (mod as any).default ?? mod
  })()
  promise.catch(() => (promise = null))
  return promise
}
