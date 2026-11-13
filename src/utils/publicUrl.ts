/**
 * public 静态资源地址工具
 *
 * 部署到 GitHub Pages 时站点位于子路径（如 https://xxx.github.io/web-gis/），
 * 代码里直接写 '/image/a.png' 会指向域名根目录而 404。
 * 统一用 assetUrl 拼接 BASE_URL，开发环境（base=/）行为不变。
 *
 * 例：assetUrl('image/a.png') -> /web-gis/image/a.png
 */
const BASE = import.meta.env.BASE_URL || '/'

export function assetUrl(path: string): string {
  return `${BASE.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`
}
