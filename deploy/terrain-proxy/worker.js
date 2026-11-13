/**
 * 香港 DEM 地形反代（Cloudflare Worker）
 *
 * 背景：https://bk.mediumvis.com:8090/gis/ 的响应带了重复的 CORS 头，
 * 浏览器直连会被判定为跨域失败；GitHub Pages 是纯静态托管，自身无法反代。
 *
 * 用法：部署本 Worker 后，把地形地址替换为
 *   https://<worker-域名>/gis/SMPstatic/20251011HKdemqp
 * 路径与上游一一对应，quantized-mesh 的 layer.json 里是相对路径，无需改写。
 *
 * 关键点：
 * 1) 必须剥掉上游所有 access-control-* 头再加自己的，否则会变成「两个 ACAO」而被浏览器拒绝
 * 2) 开启边缘缓存，地形瓦片不可变，回源一次即可
 * 3) 只放行 /gis/ 前缀，避免变成任意开放代理
 */
const UPSTREAM = 'https://bk.mediumvis.com:8090'
const ALLOWED_PREFIX = '/gis/'
const CACHE_TTL = 86400

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
}

/** 逐跳头 / 需要重新生成的头，不能透传 */
const STRIP_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'access-control-max-age',
  'content-encoding',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'set-cookie',
])

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS })
    }

    const target = UPSTREAM + url.pathname + url.search
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        'user-agent': request.headers.get('user-agent') || 'web-gis-terrain-proxy',
        accept: request.headers.get('accept') || '*/*',
      },
      redirect: 'follow',
      cf: { cacheEverything: true, cacheTtl: CACHE_TTL },
    })

    const headers = new Headers()
    upstream.headers.forEach((value, key) => {
      if (!STRIP_HEADERS.has(key.toLowerCase())) headers.set(key, value)
    })
    for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
    if (!headers.has('cache-control')) headers.set('cache-control', `public, max-age=${CACHE_TTL}`)
    headers.set('x-terrain-proxy', 'web-gis')

    return new Response(upstream.body, { status: upstream.status, headers })
  },
}
