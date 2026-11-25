import { loadScript } from '@/utils/loadScript'
import { assetUrl } from '@/utils/publicUrl'
import type { Library } from './model'

interface Engines {
  echarts: typeof import('echarts')
  g2: typeof import('@antv/g2')
  d3: typeof import('d3')
  plotly: typeof import('plotly.js')
}
const globals = { echarts: 'echarts', g2: 'G2', d3: 'd3', plotly: 'Plotly' } as const
export async function getEngine<K extends Library>(key: K, signal: AbortSignal): Promise<Engines[K]> {
  const global = window as unknown as Record<string, unknown>
  const url = assetUrl(`vendor/charts/${key}.js`)
  if (!global[globals[key]]) await loadScript(url)
  signal.throwIfAborted()
  if (!global[globals[key]]) throw new Error(`Missing ${globals[key]} after loading ${url}`)
  return global[globals[key]] as Engines[K]
}
