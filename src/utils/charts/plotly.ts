import type { Data, Layout, PlotSelectionEvent } from 'plotly.js'
import { getEngine } from './loader'
import { colors, type RenderOptions, type DemoHandle } from './model'

export async function render(options: RenderOptions, signal: AbortSignal): Promise<DemoHandle> {
  const { host, index, data, en, status } = options
  const P = await getEngine('plotly', signal)
  const { primary, secondary, shares, months, timeline, groups, scatter } = data
  const label = (zh: string, english: string) => en ? english : zh
  const layout: Partial<Layout> & { violinmode?: 'group' } = { autosize: true, margin: { l: 54, r: 30, t: 44, b: 46 }, colorway: colors, font: { color: '#334155' }, legend: { orientation: 'h' }, xaxis: { automargin: true }, yaxis: { automargin: true, gridcolor: '#e7edf5' } }
  let traces: Data[]
  if (index === 0) traces = [{ type: 'bar', x: months, y: primary, marker: { color: colors[0] } }]
  else if (index === 1) {
    traces = [0, 1].map(i => ({ type: 'scatter', mode: 'lines', x: timeline.map((d: { date: string }) => d.date), y: timeline.map((d: { value: number }, j: number) => i === 0 ? d.value : 46 + Math.round(d.value * 0.4 + secondary[j % secondary.length] * 0.4)), name: i === 0 ? label('当前', 'Current') : label('参考', 'Reference') }))
    layout.xaxis = { type: 'date', rangeslider: { visible: true, thickness: 0.15 } }
    layout.hovermode = 'x unified'
    layout.legend = { orientation: 'h', y: 1.1 }
  } else if (index === 2) {
    traces = [{ type: 'pie', hole: 0.51, labels: shares.map((d: { name: string }) => d.name), values: shares.map((d: { value: number }) => d.value), textinfo: 'label+percent', marker: { colors } }]
    layout.margin = { l: 12, r: 12, t: 32, b: 26 }
  } else if (index === 3) {
    traces = groups.flatMap((group: string, i: number) => {
      const y = timeline.filter((_: any, j: number) => j % 3 === i).map((d: { value: number }, j: number) => Math.round(d.value * (0.5 + 0.16 * i) + primary[j % primary.length] * 0.25 + i * 6))
      return [
        { type: 'box', x: y.map(() => label('箱线', 'Box')), y, name: group, marker: { color: colors[i] }, legendgroup: group },
        { type: 'violin', x: y.map(() => label('小提琴', 'Violin')), y, name: group, line: { color: colors[i] }, legendgroup: group, showlegend: false, meanline: { visible: true } },
      ] as Data[]
    })
    layout.boxmode = 'group'
    layout.violinmode = 'group'
  } else if (index === 4) {
    traces = groups.map((group: string, i: number) => {
      const points = scatter.filter((d: { group: string }) => d.group === group)
      return { type: 'scatter', mode: 'markers', name: group, x: points.map((d: { x: number }) => d.x), y: points.map((d: { y: number }) => d.y), marker: { size: 9, color: colors[i] }, selected: { marker: { opacity: 1 } }, unselected: { marker: { opacity: 0.15 } } }
    })
    layout.dragmode = 'lasso'
  } else {
    const x = Array.from({ length: 31 }, (_, i) => (i - 15) / 3)
    const z = x.map(y => x.map(v => { const r = Math.hypot(v, y); return primary[0] / 38 * Math.cos(1.9 * r) * Math.exp(-r * 0.2) }))
    const surface = { type: 'surface' as const, x, y: x, z, colorscale: 'Viridis', contours: { z: { show: true, usecolormap: true, project: { z: true } } } }
    traces = [surface as Data]
    layout.margin = { l: 4, r: 4, t: 24, b: 14 }
    layout.scene = { aspectmode: 'manual', aspectratio: { x: 1, y: 1, z: 0.58 } }
  }
  try {
    const plot = await P.newPlot(host, traces, layout, { displaylogo: false, responsive: false, scrollZoom: index === 5 })
    signal.throwIfAborted()
    if (index === 4) {
      plot.on('plotly_selected', (event: PlotSelectionEvent | undefined) => {
        const length = event?.points?.length ?? 0
        status?.(label(`已选中 ${length} 个点`, `${length} points selected`))
      })
      plot.on('plotly_deselect', () => status?.(''))
    }
  } catch (error) { P.purge(host); throw error }
  return { resize: () => { void Promise.resolve(P.Plots.resize(host)).catch(() => {}) }, destroy: () => P.purge(host) }
}
