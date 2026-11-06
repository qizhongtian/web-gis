import { loadCss, loadScript } from '@/utils/loadScript'

/**
 * Cesium 加载器：使用本地静态文件（public/cesium，由 scripts/sync-vendor.mjs 从 npm 包复制）
 * 不依赖 CDN，离线/内网部署同样可用
 */
const BASE = '/cesium/'

let promise: Promise<any> | null = null

export function loadCesium(): Promise<any> {
  if (promise) return promise
  promise = (async () => {
    const w = window as any
    if (w.Cesium) return w.Cesium
    w.CESIUM_BASE_URL = BASE
    await Promise.all([loadScript(`${BASE}Cesium.js`), loadCss(`${BASE}Widgets/widgets.css`)])
    if (!w.Cesium) throw new Error('Cesium 加载失败，请检查 public/cesium 静态资源')
    // 使用在线 ion 资源（世界地形等）需自行配置 token；示例默认使用免鉴权底图
    w.Cesium.Ion.defaultAccessToken = (import.meta as any).env?.VITE_CESIUM_TOKEN || ''
    return w.Cesium
  })()
  promise.catch(() => (promise = null))
  return promise
}
