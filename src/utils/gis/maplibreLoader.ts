import { loadCss } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'

/**
 * MapLibre GL JS 加载器：完全本地化（npm 包 + public/vendor/maplibre），不依赖 CDN
 * 返回 `maplibregl` 命名空间对象
 *
 * 注意：MapLibre 内部用 `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 定位
 * Worker，经过 Vite 预构建后这个相对路径会失效，因此把 Worker 同步到 public 下并
 * 显式 setWorkerUrl，dev 与 build 两种模式都能正常跑。
 */
const CSS_URL = assetUrl('vendor/maplibre/maplibre-gl.css')
const WORKER_URL = assetUrl('vendor/maplibre/maplibre-gl-worker.mjs')

let promise: Promise<any> | null = null

export function loadMapLibre(): Promise<any> {
  if (promise) return promise
  promise = (async () => {
    const [mod] = await Promise.all([import('maplibre-gl'), loadCss(CSS_URL)])
    const lib = (mod as any).default ?? mod
    lib.setWorkerUrl?.(WORKER_URL)
    return lib
  })()
  promise.catch(() => (promise = null))
  return promise
}
