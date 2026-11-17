<script setup lang="ts">
import ToolPage from '@/components/tools/ToolPage.vue'
import CheatSheet from '@/components/tools/CheatSheet.vue'

const sections = [
  {
    title: '请求方法',
    desc: '语义与幂等性',
    items: [
      { name: 'GET', desc: '获取资源，幂等、可缓存、参数在 URL 上（有长度限制）', code: 'GET /api/layers?page=1' },
      { name: 'POST', desc: '创建资源或提交数据，非幂等，浏览器回退会重复提交', code: 'POST /api/layers\nContent-Type: application/json' },
      { name: 'PUT', desc: '全量更新，幂等；PATCH 用于局部更新', code: 'PUT /api/layers/1' },
      { name: 'DELETE', desc: '删除资源，幂等（重复删除结果一致）', code: 'DELETE /api/layers/1' },
      { name: 'HEAD / OPTIONS', desc: 'HEAD 只取响应头；OPTIONS 用于 CORS 预检', code: 'OPTIONS /api/layers\nAccess-Control-Request-Method: PUT' },
      { name: '幂等与安全', desc: '安全：不改变资源状态；幂等：重复调用结果一致', code: 'GET / HEAD 安全且幂等\nPUT / DELETE 幂等但不安全\nPOST 既不安全也不幂等' },
    ],
  },
  {
    title: '状态码',
    desc: '2xx ~ 5xx 常见含义',
    items: [
      { name: '200 / 201 / 204', desc: '成功 / 已创建 / 成功但无响应体', code: '201 Created\n204 No Content（DELETE、PUT 常用）' },
      { name: '301 / 302 / 304', desc: '永久重定向 / 临时重定向 / 命中协商缓存', code: '304 Not Modified（配合 ETag / Last-Modified）' },
      { name: '400 / 401 / 403', desc: '参数错误 / 未认证 / 已认证但无权限', code: '401 需登录（可带 WWW-Authenticate）\n403 权限不足，重新登录无效' },
      { name: '404 / 405 / 409', desc: '不存在 / 方法不允许 / 状态冲突', code: '409 Conflict（并发更新、重复创建）' },
      { name: '422 / 429', desc: '语义校验失败 / 请求过于频繁（限流）', code: '429 常带 Retry-After 头' },
      { name: '500 / 502 / 503 / 504', desc: '服务端异常 / 网关错误 / 服务不可用 / 网关超时', code: '502 Bad Gateway\n504 Gateway Timeout' },
    ],
  },
  {
    title: '常用请求头',
    desc: 'Request Headers',
    items: [
      { name: 'Content-Type', desc: '请求体格式，POST 必带', code: 'application/json\napplication/x-www-form-urlencoded\nmultipart/form-data（文件上传）' },
      { name: 'Accept', desc: '期望的响应类型，可带权重 q', code: 'Accept: application/json, text/plain;q=0.9' },
      { name: 'Authorization', desc: '认证凭证，JWT 用 Bearer 方案', code: 'Authorization: Bearer <token>' },
      { name: 'If-None-Match / If-Modified-Since', desc: '协商缓存校验，命中返回 304', code: 'If-None-Match: "etag-value"' },
      { name: 'Range', desc: '断点续传与分片下载', code: 'Range: bytes=0-1023' },
      { name: 'X-Requested-With / 自定义头', desc: '自定义头会触发 CORS 预检', code: 'X-Trace-Id: 8f2c1e' },
    ],
  },
  {
    title: '常用响应头',
    desc: 'Response Headers',
    items: [
      { name: 'Cache-Control', desc: '强缓存策略，优先级最高', code: 'Cache-Control: max-age=31536000, immutable' },
      { name: 'ETag / Last-Modified', desc: '协商缓存标识，配合 304 使用', code: 'ETag: "33a64df5"\nLast-Modified: Tue, 17 Nov 2026 02:00:00 GMT' },
      { name: 'Access-Control-Allow-Origin', desc: 'CORS 允许来源，带凭证时不能用 *', code: 'Access-Control-Allow-Origin: https://a.com\nAccess-Control-Allow-Credentials: true' },
      { name: 'Content-Disposition', desc: '控制下载文件名', code: "Content-Disposition: attachment; filename*=UTF-8''%E5%9C%B0%E5%9B%BE.zip" },
      { name: 'Content-Encoding', desc: '压缩方式，通常由服务器自动协商', code: 'Content-Encoding: br' },
      { name: 'Set-Cookie', desc: '下发 Cookie，安全属性不可省', code: 'Set-Cookie: sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax' },
    ],
  },
  {
    title: '缓存策略',
    desc: '强缓存与协商缓存',
    items: [
      { name: '强缓存', desc: '不发请求直接用本地副本，过期前不校验', code: 'Cache-Control: max-age=3600\nExpires: Wed, 21 Oct 2026 07:28:00 GMT（HTTP/1.0 兼容）' },
      { name: 'no-cache vs no-store', desc: 'no-cache 仍可缓存但要校验；no-store 完全不缓存', code: 'Cache-Control: no-cache\nCache-Control: no-store' },
      { name: '资源指纹', desc: '文件名带 hash，配合长缓存实现「永不失效」', code: 'app.9f2c1e.js → Cache-Control: max-age=31536000, immutable' },
      { name: 'HTML 入口', desc: '入口文件不缓存，保证能拿到最新资源引用', code: 'index.html → Cache-Control: no-cache' },
      { name: 'Service Worker', desc: '可编程缓存，离线可用；注意版本与清理策略', code: "self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));" },
    ],
  },
  {
    title: 'CORS 与安全',
    desc: '跨域与常见防护',
    items: [
      { name: '简单请求', desc: 'GET/HEAD/POST + 安全首部 + 常见 Content-Type 不触发预检', code: 'Content-Type: text/plain | multipart/form-data | application/x-www-form-urlencoded' },
      { name: '预检请求', desc: '非简单请求先发 OPTIONS，需返回允许的方法与头', code: 'Access-Control-Allow-Methods: GET, POST, PUT\nAccess-Control-Allow-Headers: Content-Type, Authorization\nAccess-Control-Max-Age: 86400' },
      { name: '携带 Cookie', desc: 'credentials: include 时，Allow-Origin 必须是具体域名', code: "fetch(url, { credentials: 'include' })" },
      { name: 'XSS 防护', desc: '不要 innerHTML 拼用户输入，富文本必须白名单过滤', code: 'el.textContent = userInput;  // 安全\n// CSP: default-src \'self\'' },
      { name: 'CSRF 防护', desc: 'SameSite Cookie + 校验 Referer / 自定义 Token', code: 'Set-Cookie: sid=abc; SameSite=Lax; Secure; HttpOnly' },
      { name: 'HTTPS 与安全头', desc: 'HSTS、X-Content-Type-Options、CSP 三件套', code: 'Strict-Transport-Security: max-age=31536000\nX-Content-Type-Options: nosniff\nContent-Security-Policy: default-src \'self\'' },
    ],
  },
]
</script>

<template>
  <ToolPage title="HTTP 速查" desc="方法、状态码、首部、缓存与跨域要点" wide>
    <CheatSheet :sections="sections" />
  </ToolPage>
</template>
