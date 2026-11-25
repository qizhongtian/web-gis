import type { EChartsOption } from 'echarts'
import { getEngine } from './loader'
import { colors, type RenderOptions, type DemoHandle } from './model'

export async function render(options: RenderOptions, signal: AbortSignal): Promise<DemoHandle> {
  const { host, index, data, en } = options
  const ec = await getEngine('echarts', signal)
  const { months, primary, secondary, shares, timeline } = data
  const names = en ? ['Current', 'Reference'] : ['当前', '参考']
  const xAxis = { type: 'category' as const, data: months }
  const yAxis = { type: 'value' as const }
  const grid = { top: 46, left: 48, right: 25, bottom: 48 }
  const weekdays = (en ? 'Mon Tue Wed Thu Fri Sat Sun' : '周一 周二 周三 周四 周五 周六 周日').split(' ')
  const nodes = en ? ['Input', 'Clean', 'Analyze', 'Visualize', 'Export'] : ['输入', '清洗', '分析', '可视化', '导出']
  const chartOptions: EChartsOption[] = [
    { grid, tooltip: { trigger: 'axis' }, xAxis, yAxis, dataset: { source: [['month', 'value'], ...months.map((m: string, i: number) => [m, primary[i]])] }, series: [{ type: 'bar', barMaxWidth: 36, itemStyle: { borderRadius: [4, 4, 0, 0] } }] },
    { grid, tooltip: { trigger: 'axis' }, legend: { top: 8 }, xAxis, yAxis, series: [primary, secondary].map((values, i) => ({ type: 'line', data: values, name: names[i], smooth: true })) },
    { tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' }, legend: { bottom: 8 }, series: [{ type: 'pie', radius: ['40%', '65%'], center: ['50%', '45%'], data: shares, label: { show: false }, emphasis: { label: { show: true } } }] },
    { grid: { ...grid, bottom: 72 }, tooltip: { trigger: 'axis' }, xAxis: { type: 'category', boundaryGap: false, data: timeline.map((d: { date: string }) => d.date) }, yAxis, dataZoom: [{ type: 'inside', start: 25, end: 75 }, { type: 'slider', bottom: 12, start: 25, end: 75 }], series: [{ type: 'line', data: timeline.map((d: { value: number }) => d.value), showSymbol: false, areaStyle: { opacity: 0.22 } }] },
    { grid: { ...grid, bottom: 89 }, tooltip: { trigger: 'item' }, xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}:00`) }, yAxis: { type: 'category', data: weekdays }, visualMap: { min: 0, max: 100, orient: 'horizontal', left: 'center', bottom: 12, calculable: true, inRange: { color: ['#dbeafe', '#60a5fa', '#1e3a8a'] } }, series: [{ type: 'heatmap', data: weekdays.flatMap((_, d) => Array.from({ length: 24 }, (__, h) => [h, d, Math.round((primary[d] + h * 7) % 35 + 65 * Math.max(0, Math.sin((h - 5) / 16 * Math.PI)))])) }] },
    { tooltip: { trigger: 'item' }, series: [{ type: 'sankey', left: 25, right: 72, top: 34, bottom: 34, data: nodes.map(name => ({ name })), links: [[0, 1, primary[0]], [0, 2, primary[1]], [1, 2, secondary[0]], [1, 3, primary[2]], [2, 3, primary[3]], [2, 4, 20], [3, 4, primary[1] + primary[0]]].map(([s, t, value]) => ({ source: nodes[s], target: nodes[t], value })), lineStyle: { color: 'gradient', opacity: 0.42 }, emphasis: { focus: 'adjacency' } }] },
  ]
  const chart = ec.init(host)
  try { chart.setOption({ color: colors, ...chartOptions[index] }) }
  catch (error) { chart.dispose(); throw error }
  return { resize: () => chart.resize(), destroy: () => chart.dispose() }
}
