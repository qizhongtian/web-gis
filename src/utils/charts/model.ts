export const libraries = ['echarts', 'g2', 'd3', 'plotly'] as const
export type Library = typeof libraries[number]
export type Pair = readonly [string, string]

export type ChartLevel = 'basic' | 'intermediate' | 'advanced'

export interface ChartItem {
  id: string
  library: Library
  level: ChartLevel
  title: Pair
  hint: Pair
  api: string
  tags: string[]
  code: string
}

export const chartLevels = ['basic', 'intermediate', 'advanced'] as const
export const chartLevelLabels: Record<ChartLevel, Pair> = {
  basic: ['基础', 'Basic'],
  intermediate: ['进阶', 'Intermediate'],
  advanced: ['高级', 'Advanced'],
}

export function chartExamplePath(item: ChartItem) {
  return `/charts/${item.library}/${item.level}/${item.id.slice(item.library.length + 1)}`
}

export const colors = ['#2563eb', '#0f9f83', '#ed8b32', '#9b57bc', '#db5d78', '#3179a9']

export function demoData(en: boolean, variant: boolean) {
  const months = (en ? 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec' : '1月 2月 3月 4月 5月 6月 7月 8月 9月 10月 11月 12月').split(' ')
  const groups = en ? ['Collection', 'Analysis', 'Delivery'] : ['采集', '分析', '交付']
  const modules = en ? ['Maps', '3D', 'Video', 'Charts', 'Tools', 'Data'] : ['地图', '三维', '视频', '图表', '工具', '数据']
  const primary = [38, 52, 46, 67, 56, 80, 65, 71, 58, 86, 74, 91].map((n, i) => variant ? n + (i % 3 - 1) * 21 : n)
  const secondary = [32, 42, 55, 48, 63, 54, 69, 55, 68, 61, 79, 69].map((n, i) => variant ? n + (i % 4 - 1) * 10 : n)
  const shares = [32, 19, 12, 22, 9, 6].map((n, i) => ({ name: modules[i], value: variant ? n + (i % 2 ? 5 : -3) : n }))
  const timeline = Array.from({ length: 96 }, (_, i) => ({
    x: i,
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    value: Math.round(65 + 22 * Math.sin(i / 7) + (variant ? 13 : 7) * Math.cos(i * 1.6) + i / 4),
  }))
  const scatter = Array.from({ length: 108 }, (_, i) => {
    const g = i % groups.length
    return { group: groups[g], x: 15 + (i * 29 % 60) + g * 12, y: 23 + (i * 13 % 49) + g * (variant ? 16 : 10) + 8 * Math.sin(i) }
  })
  return { months, groups, modules, primary, secondary, shares, timeline, scatter }
}

export type DemoData = ReturnType<typeof demoData>

export interface RenderOptions {
  host: HTMLElement
  index: number
  data: DemoData
  en: boolean
  status?: (text: string) => void
}

export interface DemoHandle {
  resize?: () => void
  destroy: () => void
}

export type Renderer = (options: RenderOptions, signal: AbortSignal) => Promise<DemoHandle>

export interface LibraryMeta {
  key: Library
  name: string
  intro: Pair
  version: string
  docUrl: string
}

export const libraryMetas: Record<Library, LibraryMeta> = {
  echarts: {
    key: 'echarts',
    name: 'Apache ECharts',
    intro: ['纯配置驱动的高性能图表库，支持丰富的几何类型与流转图。', 'Configuration-driven chart library with rich marks and diagram types.'],
    version: 'v6.0.0',
    docUrl: 'https://echarts.apache.org/',
  },
  g2: {
    key: 'g2',
    name: 'AntV G2',
    intro: ['基于图形语法的声明式可视化引擎，自由组合通道、标记与交互。', 'Declarative data visualization engine based on the grammar of graphics.'],
    version: 'v5.4.8',
    docUrl: 'https://g2.antv.antgroup.com/',
  },
  d3: {
    key: 'd3',
    name: 'D3.js',
    intro: ['基于 Web 标准的数据驱动文档，灵活控制 SVG 与力学模拟。', 'Data-driven documents driven by Web standards for bespoke SVG and forces.'],
    version: 'v7.9.0',
    docUrl: 'https://d3js.org/',
  },
  plotly: {
    key: 'plotly',
    name: 'Plotly.js',
    intro: ['专注科研、金融与统计的高层次交互图表，支持 WebGL 三维渲染。', 'High-level scientific and financial charting with WebGL 3D capability.'],
    version: 'v3.3.1',
    docUrl: 'https://plotly.com/javascript/',
  },
}
