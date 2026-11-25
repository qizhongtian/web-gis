import type { ChartItem } from '../model'

export const echartsExamples: ChartItem[] = [
  {
    id: 'echarts-bar',
    library: 'echarts',
    level: 'basic',
    title: ['标准分类柱状图', 'Category Bar Chart'],
    hint: ['基础柱状图，展示各月核心指标，带数值提示与圆角。', 'Standard bar chart showing monthly indicators with rounded corners.'],
    api: 'xAxis · yAxis · series[type="bar"]',
    tags: ['Bar', 'Basic'],
    code: `// Apache ECharts - 标准分类柱状图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  grid: { top: 45, left: 48, right: 24, bottom: 42 },
  xAxis: {
    type: 'category',
    data: data.months,
    axisTick: { alignWithLabel: true }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#e2e8f0' } }
  },
  series: [
    {
      name: en ? 'Primary' : '主要指标',
      type: 'bar',
      barMaxWidth: 38,
      data: data.primary,
      itemStyle: {
        borderRadius: [6, 6, 0, 0]
      }
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-line',
    library: 'echarts',
    level: 'basic',
    title: ['双系列平滑折线', 'Multi-series Smooth Line'],
    hint: ['双指标时序走势，支持平滑拟合曲线与半透明阴影填充。', 'Multi-series trend curves with smooth fitting and translucent fill.'],
    api: 'series[type="line"] · smooth · areaStyle',
    tags: ['Line', 'Area', 'Basic'],
    code: `// Apache ECharts - 双系列平滑折线
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: { trigger: 'axis' },
  legend: { top: 10 },
  grid: { top: 50, left: 48, right: 24, bottom: 42 },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: data.months
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: en ? 'Current' : '本期趋势',
      type: 'line',
      smooth: true,
      data: data.primary,
      areaStyle: { opacity: 0.25 }
    },
    {
      name: en ? 'Reference' : '参考对比',
      type: 'line',
      smooth: true,
      data: data.secondary,
      lineStyle: { type: 'dashed' }
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-pie',
    library: 'echarts',
    level: 'basic',
    title: ['空心环形占比图', 'Doughnut Pie Chart'],
    hint: ['展示各模块构成的比例分布，支持悬停高亮放大。', 'Distribution of modules using a doughnut shape with hover emphasis.'],
    api: 'series[type="pie"] · radius · emphasis',
    tags: ['Pie', 'Donut', 'Basic'],
    code: `// Apache ECharts - 空心环形占比图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: 12,
    itemWidth: 12,
    itemHeight: 12
  },
  series: [
    {
      name: en ? 'Module Distribution' : '模块占比',
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['50%', '46%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      data: data.shares
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-scatter',
    library: 'echarts',
    level: 'basic',
    title: ['多维散点分布图', 'Scatter Distribution Plot'],
    hint: ['散点映射指标坐标，展示离散分布与聚类特征。', 'Scatter plot displaying discrete distribution and clustering features.'],
    api: 'series[type="scatter"] · symbolSize',
    tags: ['Scatter', 'Basic'],
    code: `// Apache ECharts - 多维散点分布图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const scatterPoints = data.scatter.map(d => [d.x, d.y]);

const option = {
  color: [colors[0]],
  tooltip: {
    formatter: (param) => \`X: \${param.value[0]}, Y: \${param.value[1]}\`
  },
  grid: { top: 40, left: 48, right: 30, bottom: 42 },
  xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
  yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
  series: [
    {
      name: en ? 'Samples' : '采样数据',
      type: 'scatter',
      symbolSize: 12,
      data: scatterPoints,
      itemStyle: {
        opacity: 0.78,
        shadowBlur: 4,
        shadowColor: 'rgba(37,99,235,0.3)'
      }
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-stacked-bar',
    library: 'echarts',
    level: 'intermediate',
    title: ['堆叠横向条形图', 'Stacked Horizontal Bar'],
    hint: ['横向坐标系下对比两组指标的相对累计量。', 'Horizontal stacked bar chart comparing cumulative contributions.'],
    api: 'series.stack · yAxis[type="category"]',
    tags: ['Bar', 'Stacked', 'Intermediate'],
    code: `// Apache ECharts - 堆叠横向条形图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 10 },
  grid: { top: 45, left: 60, right: 30, bottom: 30 },
  xAxis: { type: 'value' },
  yAxis: {
    type: 'category',
    data: data.months.slice(0, 6)
  },
  series: [
    {
      name: en ? 'Team A' : '分队 A',
      type: 'bar',
      stack: 'total',
      data: data.primary.slice(0, 6)
    },
    {
      name: en ? 'Team B' : '分队 B',
      type: 'bar',
      stack: 'total',
      data: data.secondary.slice(0, 6)
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-rose',
    library: 'echarts',
    level: 'intermediate',
    title: ['南丁格尔玫瑰图', 'Nightingale Rose Chart'],
    hint: ['半径与角度双重编码指标数值，极具辨识度的统计图表。', 'Radius and angle dual-encoded Nightingale rose chart.'],
    api: 'series[type="pie"] · roseType="radius"',
    tags: ['Pie', 'Rose', 'Intermediate'],
    code: `// Apache ECharts - 南丁格尔玫瑰图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: { trigger: 'item', formatter: '{b}: {c}' },
  legend: { bottom: 8 },
  series: [
    {
      name: en ? 'Proportion' : '比重',
      type: 'pie',
      radius: [25, 110],
      center: ['50%', '46%'],
      roseType: 'radius',
      itemStyle: {
        borderRadius: 6
      },
      data: data.shares
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-radar',
    library: 'echarts',
    level: 'intermediate',
    title: ['多维雷达能力评估', 'Multidimensional Radar Chart'],
    hint: ['在极坐标多边形中评估各项能力维度与基准对比。', 'Evaluate multiple capability dimensions against benchmarks on radar.'],
    api: 'radar.indicator · series[type="radar"]',
    tags: ['Radar', 'Intermediate'],
    code: `// Apache ECharts - 多维雷达能力评估
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const indicators = (en
  ? ['Rendering', 'Interaction', 'Scalability', 'Performance', 'Styling', 'API']
  : ['渲染性能', '交互流畅', '可扩展性', '计算效率', '视觉表现', '接口友好']
).map(name => ({ name, max: 100 }));

const option = {
  color: [colors[0], colors[1]],
  tooltip: {},
  legend: { top: 10 },
  radar: {
    indicator: indicators,
    center: ['50%', '54%'],
    radius: '62%'
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: [88, 92, 85, 78, 94, 90],
          name: en ? 'Framework A' : '框架方案 A',
          areaStyle: { opacity: 0.25 }
        },
        {
          value: [72, 80, 94, 88, 80, 85],
          name: en ? 'Framework B' : '框架方案 B',
          areaStyle: { opacity: 0.2 }
        }
      ]
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-zoom',
    library: 'echarts',
    level: 'advanced',
    title: ['时间窗口区域缩放', 'Time Range Slider Zoom'],
    hint: ['96 个时序点大数据集，支持底部滚动滑块与视口内滚轮缩放。', 'Time-series data zoom slider with mousewheel and viewport dragging.'],
    api: 'dataZoom[type="slider"] · dataZoom[type="inside"]',
    tags: ['Zoom', 'Time-series', 'Advanced'],
    code: `// Apache ECharts - 时间窗口区域缩放
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const option = {
  color: colors,
  tooltip: { trigger: 'axis' },
  grid: { top: 40, left: 48, right: 24, bottom: 75 },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: data.timeline.map(d => d.date)
  },
  yAxis: { type: 'value' },
  dataZoom: [
    {
      type: 'inside',
      start: 25,
      end: 75
    },
    {
      type: 'slider',
      bottom: 15,
      start: 25,
      end: 75
    }
  ],
  series: [
    {
      name: en ? 'Trend' : '时序指标',
      type: 'line',
      data: data.timeline.map(d => d.value),
      showSymbol: false,
      areaStyle: { opacity: 0.2 }
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
  {
    id: 'echarts-sankey',
    library: 'echarts',
    level: 'advanced',
    title: ['业务流量关系桑基图', 'Sankey Flow Diagram'],
    hint: ['展示多层级节点之间的流转关系，支持节点拖拽与流向高亮。', 'Sankey diagram showing node flows with draggable layout.'],
    api: 'series[type="sankey"] · nodeGap · emphasis',
    tags: ['Sankey', 'Graph', 'Advanced'],
    code: `// Apache ECharts - 业务流量关系桑基图
// 可用参数: container, echarts, data, colors, en

const chart = echarts.init(container);

const nodes = (en
  ? ['Input', 'Clean', 'Analyze', 'Visualize', 'Export']
  : ['原始输入', '数据清洗', '空间分析', '图表可视', '成品交付']
).map(name => ({ name }));

const links = [
  { source: nodes[0].name, target: nodes[1].name, value: 45 },
  { source: nodes[0].name, target: nodes[2].name, value: 30 },
  { source: nodes[1].name, target: nodes[2].name, value: 25 },
  { source: nodes[1].name, target: nodes[3].name, value: 20 },
  { source: nodes[2].name, target: nodes[3].name, value: 40 },
  { source: nodes[2].name, target: nodes[4].name, value: 15 },
  { source: nodes[3].name, target: nodes[4].name, value: 55 }
];

const option = {
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'sankey',
      left: 30,
      right: 70,
      top: 30,
      bottom: 30,
      data: nodes,
      links: links,
      lineStyle: { color: 'gradient', opacity: 0.45 },
      emphasis: { focus: 'adjacency' }
    }
  ]
};

chart.setOption(option);

return {
  resize: () => chart.resize(),
  destroy: () => chart.dispose()
};
`,
  },
]
