import type { G2Spec } from '@antv/g2'
import { getEngine } from './loader'
import { colors, type RenderOptions, type DemoHandle } from './model'

export async function render(options: RenderOptions, signal: AbortSignal): Promise<DemoHandle> {
  const { host, index, data, en } = options
  const { Chart } = await getEngine('g2', signal)
  const names = en ? ['Current', 'Reference'] : ['当前', '参考']
  const bars = data.months.map((month: string, i: number) => ({ month, value: data.primary[i], series: names[0] }))
  const grouped = [...bars, ...data.months.map((month: string, i: number) => ({ month, value: data.secondary[i], series: names[1] }))]
  const xy = { x: 'month', y: 'value' }
  const scale = { color: { range: colors } }
  const axis = { x: { title: false as const }, y: { title: false as const } }
  const timeline = data.timeline.filter((_: any, i: number) => i % 2 === 0).map((d: { date: string; value: number; x: number }) => ({ ...d, date: d.date.slice(5) }))
  const encode = { x: 'x', y: 'value' }
  const specs: G2Spec[] = [
    { type: 'interval', data: bars, encode: xy, axis, style: { fill: colors[0], radiusTopLeft: 4, radiusTopRight: 4 } },
    { type: 'line', data: grouped, encode: { ...xy, color: 'series' }, axis, scale, interaction: { tooltip: { shared: true } }, style: { lineWidth: 2.5 } },
    { type: 'interval', data: data.shares, coordinate: { type: 'theta', innerRadius: 0.48, outerRadius: 0.84 }, encode: { y: 'value', color: 'name' }, scale, transform: [{ type: 'stackY' }, { type: 'normalizeY' }], axis: false, labels: [{ text: 'name', position: 'outside' }], tooltip: { items: ['value'] } },
    { type: 'interval', data: grouped, encode: { ...xy, color: 'series' }, axis, scale, transform: [{ type: 'dodgeX' }] },
    { type: 'point', data: data.scatter, encode: { x: 'x', y: 'y', color: 'group', shape: 'point' }, scale, axis, style: { r: 5, fillOpacity: 0.69 }, interaction: { brushHighlight: true } },
    { type: 'spaceFlex', direction: 'col', ratio: [3, 1], children: [
      { type: 'view', key: 'focus', axis, interaction: { brushXFilter: true }, children: [{ type: 'line', data: timeline, encode, style: { stroke: colors[0], lineWidth: 2 } }] },
      { type: 'view', key: 'overview', axis: false, interaction: { brushXFilter: true }, children: [{ type: 'area', data: timeline, encode, style: { fill: colors[1], fillOpacity: 0.47 } }] },
    ] },
  ]
  const chart = new Chart({ container: host, autoFit: true })
  try { chart.options({ ...specs[index], animate: false }); await chart.render(); signal.throwIfAborted() }
  catch (error) { chart.destroy(); throw error }
  return { destroy: () => chart.destroy() }
}
