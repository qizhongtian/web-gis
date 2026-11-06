/** 动态注入 script / link（带缓存），用于按需加载 CDN 库 */

const loadedScripts = new Map<string, Promise<void>>()
const loadedLinks = new Map<string, Promise<void>>()

export function loadScript(src: string): Promise<void> {
  let p = loadedScripts.get(src)
  if (p) return p
  p = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => {
      loadedScripts.delete(src)
      reject(new Error(`script load failed: ${src}`))
    }
    document.head.appendChild(el)
  })
  loadedScripts.set(src, p)
  return p
}

export function loadCss(href: string): Promise<void> {
  let p = loadedLinks.get(href)
  if (p) return p
  p = new Promise((resolve, reject) => {
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href
    el.onload = () => resolve()
    el.onerror = () => {
      loadedLinks.delete(href)
      reject(new Error(`css load failed: ${href}`))
    }
    document.head.appendChild(el)
  })
  loadedLinks.set(href, p)
  return p
}
