/**
 * Three.js 加载器：本地 npm 包，构建时单独分包，不依赖 CDN
 */
let promise: Promise<any> | null = null

export function loadThree(): Promise<any> {
  if (promise) return promise
  promise = import('three')
  promise.catch(() => (promise = null))
  return promise
}
