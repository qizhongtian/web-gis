import { loadCss } from '@/utils/loadScript'

/**
 * OpenLayers 加载器：完全本地化（npm 包 + public/vendor/ol/ol.css），不依赖 CDN
 * - 首次打开示例页时才加载（Vite 单独分包），不影响首屏
 * - 返回对象结构与官方命名空间一致：ol.Map / ol.layer.Vector / ol.proj.fromLonLat …
 */
const CSS_URL = '/vendor/ol/ol.css'

let promise: Promise<any> | null = null

export function loadOl(): Promise<any> {
  if (promise) return promise
  promise = (async () => {
    const [css, mod] = await Promise.all([loadCss(CSS_URL), import('./olBundle')])
    void css
    return mod.default
  })()
  promise.catch(() => (promise = null))
  return promise
}
