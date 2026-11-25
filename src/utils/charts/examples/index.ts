import { chartExamplePath, chartLevelLabels, chartLevels, libraries, type ChartItem, type Library } from '../model'
import { d3Examples } from './d3'
import { echartsExamples } from './echarts'
import { g2Examples } from './g2'
import { plotlyExamples } from './plotly'

export const chartItemsByLibrary: Record<Library, ChartItem[]> = {
  echarts: echartsExamples,
  g2: g2Examples,
  d3: d3Examples,
  plotly: plotlyExamples,
}

export const allChartItems = libraries.flatMap(library => chartItemsByLibrary[library])
export const chartExamplesByPath = new Map(allChartItems.map(item => [chartExamplePath(item), item]))

export function chartMenuMessages(language: 0 | 1) {
  return {
    ...Object.fromEntries(chartLevels.map(level => [`chartLevel_${level}`, chartLevelLabels[level][language]])),
    ...Object.fromEntries(allChartItems.map(item => [`chartExample_${item.id}`, item.title[language]])),
  }
}
