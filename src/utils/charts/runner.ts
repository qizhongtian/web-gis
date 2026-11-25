import { assetUrl } from '@/utils/publicUrl'
import { colors, type DemoData, type Library } from './model'

const engineNames = { echarts: 'echarts', g2: 'G2', d3: 'd3', plotly: 'Plotly' } as const

// 此函数只在不具备同源权限的预览 iframe 内执行，不引用外层作用域。
function previewRuntime() {
  const send = (type: string, text = '') => parent.postMessage({ type, text }, '*')
  window.addEventListener('error', event => send('error', event.message || 'Preview script failed.'))
  window.addEventListener('unhandledrejection', event => send('error', String(event.reason?.message ?? event.reason)))
  window.addEventListener('message', async function start(event: MessageEvent) {
    if (event.source !== parent || event.data?.type !== 'run') return
    window.removeEventListener('message', start)
    const { code, engineName, data, palette, en } = event.data
    const container = document.getElementById('chart')!
    try {
      const engine = (window as unknown as Record<string, unknown>)[engineName]
      if (!engine) throw new Error(en ? 'Local chart library failed to load. Check the static assets.' : '图表库加载失败，请检查本地静态资源。')
      const run = Object.getPrototypeOf(async function () {}).constructor
      const handle = await run('container', engineName, 'data', 'colors', 'en', 'status', `"use strict";\n${code}`)(
        container, engine, data, palette, en, (text: string) => send('feedback', text),
      )
      if (!container.querySelector('svg, canvas')) throw new Error(en ? 'No chart was rendered. Check the chart type and render call.' : '未生成图表，请检查图表类型和渲染调用。')
      if (typeof handle?.resize === 'function') {
        let previous = `${container.clientWidth}:${container.clientHeight}`
        new ResizeObserver(async () => {
          const size = `${container.clientWidth}:${container.clientHeight}`
          if (previous === size || !container.clientWidth || !container.clientHeight) return
          previous = size
          try { await handle.resize() }
          catch (error) { send('error', String(error)) }
        }).observe(container)
      }
      send('ready')
    } catch (error) {
      send('error', String(error))
    }
  })
}

export function mountChartPreview(options: {
  host: HTMLElement
  library: Library
  code: string
  data: DemoData
  en: boolean
  title: string
  onEvent: (type: 'ready' | 'error' | 'feedback', text: string) => void
}) {
  const { host, library, code, data, en, title, onEvent } = options
  const url = new URL(assetUrl(`vendor/charts/${library}.js`), window.location.href).href
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
  const frame = document.createElement('iframe')
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  frame.title = title
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.referrerPolicy = 'no-referrer'
  const csp = `default-src 'none'; script-src ${url} 'nonce-${nonce}' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; form-action 'none'; base-uri 'none'`
  frame.srcdoc = `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<style>html,body,#chart{width:100%;height:100%;margin:0;overflow:hidden}body{background:#fff;color:#334155;font:13px system-ui,sans-serif}#chart{position:relative}</style>
<script nonce="${nonce}">(${previewRuntime.toString()})();</script>
<script src="${esc(url)}" referrerpolicy="no-referrer"></script></head><body><div id="chart"></div></body></html>`
  function receive(event: MessageEvent) {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return
    const type = event.data?.type
    if (type !== 'ready' && type !== 'error' && type !== 'feedback') return
    if (type !== 'feedback') window.clearTimeout(timeout)
    onEvent(type, typeof event.data.text === 'string' ? event.data.text.slice(0, 500) : '')
  }
  const timeout = window.setTimeout(() => onEvent('error', en ? 'Preview timed out. Check for loops or unfinished asynchronous work.' : '预览超时，请检查循环和未完成的异步操作。'), 12000)
  window.addEventListener('message', receive)
  frame.addEventListener('load', () => {
    frame.contentWindow?.postMessage({ type: 'run', code, engineName: engineNames[library], data, palette: colors, en }, '*')
  }, { once: true })
  host.replaceChildren(frame)
  return () => {
    window.clearTimeout(timeout)
    window.removeEventListener('message', receive)
    frame.remove()
  }
}
