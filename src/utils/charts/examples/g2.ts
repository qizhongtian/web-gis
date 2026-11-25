import type { ChartItem } from '../model'

export const g2Examples: ChartItem[] = [
  {
    id: 'g2-bar',
    library: 'g2',
    level: 'basic',
    title: ['图形语法区间柱状图', 'Interval Bar Chart'],
    hint: ['通过位置与颜色通道绑定，展示各月核心数值。', 'Map months and values to position and color channels with interval mark.'],
    api: 'chart.options({ type: "interval" })',
    tags: ['Interval', 'Basic'],
    code: `// AntV G2 - 区间柱状图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 20,
  paddingTop: 30,
  paddingBottom: 40
});

const dataset = data.months.map((m, i) => ({
  month: m,
  value: data.primary[i]
}));

chart.options({
  type: 'interval',
  data: dataset,
  encode: { x: 'month', y: 'value', color: () => colors[0] },
  style: { radiusTopLeft: 6, radiusTopRight: 6 }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-line',
    library: 'g2',
    level: 'basic',
    title: ['分组多系列折线图', 'Grouped Multi-series Line'],
    hint: ['使用颜色通道划分多系列，支持平滑样条线插值。', 'Color channel separates groups with smooth line interpolation.'],
    api: 'chart.options({ type: "line" }) · shape="smooth"',
    tags: ['Line', 'Grouped', 'Basic'],
    code: `// AntV G2 - 分组多系列折线图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 30,
  paddingTop: 36,
  paddingBottom: 40
});

const dataset = [
  ...data.months.map((m, i) => ({ month: m, value: data.primary[i], type: en ? 'Actual' : '实际' })),
  ...data.months.map((m, i) => ({ month: m, value: data.secondary[i], type: en ? 'Target' : '目标' }))
];

chart.options({
  type: 'line',
  data: dataset,
  encode: { x: 'month', y: 'value', color: 'type', shape: 'smooth' },
  scale: { color: { range: [colors[0], colors[1]] } },
  style: { lineWidth: 2.5 }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-area',
    library: 'g2',
    level: 'basic',
    title: ['渐变面积堆叠趋势图', 'Stacked Area Trend'],
    hint: ['时序面积堆叠，观察整体总量演进与各组成部分贡献。', 'Stacked area chart tracking volume evolution and component shares.'],
    api: 'chart.options({ type: "area" }) · transform: [{ type: "stackY" }]',
    tags: ['Area', 'Stacked', 'Basic'],
    code: `// AntV G2 - 渐变面积堆叠趋势图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 24,
  paddingTop: 30,
  paddingBottom: 40
});

const dataset = [
  ...data.months.map((m, i) => ({ month: m, value: data.primary[i], group: en ? 'Core' : '核心' })),
  ...data.months.map((m, i) => ({ month: m, value: data.secondary[i], group: en ? 'Support' : '支撑' }))
];

chart.options({
  type: 'area',
  data: dataset,
  transform: [{ type: 'stackY' }],
  encode: { x: 'month', y: 'value', color: 'group' },
  scale: { color: { range: [colors[0], colors[1]] } },
  style: { fillOpacity: 0.6 }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-theta',
    library: 'g2',
    level: 'intermediate',
    title: ['极坐标环形构成图', 'Polar Theta Donut Chart'],
    hint: ['通过 stackY 堆叠并变换至极坐标系的环形构成图。', 'StackY transform mapped to polar coordinates for doughnut composition.'],
    api: 'coordinate: { type: "theta", innerRadius: 0.55 }',
    tags: ['Pie', 'Theta', 'Intermediate'],
    code: `// AntV G2 - 极坐标环形构成图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  padding: 30
});

chart.options({
  type: 'interval',
  data: data.shares,
  coordinate: { type: 'theta', innerRadius: 0.55 },
  transform: [{ type: 'stackY' }],
  encode: { y: 'value', color: 'name' },
  scale: { color: { range: colors } },
  style: { stroke: '#fff', lineWidth: 2, radius: 4 },
  legend: { color: { position: 'bottom' } }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-dodge',
    library: 'g2',
    level: 'intermediate',
    title: ['多系列簇状并排柱图', 'Dodge Grouped Column Chart'],
    hint: ['在同一类别维度上使用 dodgeX 变换实现多柱并排横向对比。', 'DodgeX transform to arrange columns side-by-side for comparison.'],
    api: 'transform: [{ type: "dodgeX" }]',
    tags: ['Column', 'Dodge', 'Intermediate'],
    code: `// AntV G2 - 多系列簇状并排柱图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 24,
  paddingTop: 32,
  paddingBottom: 40
});

const dataset = [
  ...data.months.slice(0, 6).map((m, i) => ({ month: m, value: data.primary[i], series: en ? 'Team 1' : '1组' })),
  ...data.months.slice(0, 6).map((m, i) => ({ month: m, value: data.secondary[i], series: en ? 'Team 2' : '2组' }))
];

chart.options({
  type: 'interval',
  data: dataset,
  transform: [{ type: 'dodgeX' }],
  encode: { x: 'month', y: 'value', color: 'series' },
  scale: { color: { range: [colors[0], colors[2]] } },
  style: { radiusTopLeft: 4, radiusTopRight: 4 }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-scatter',
    library: 'g2',
    level: 'intermediate',
    title: ['多维气泡矩阵散点图', 'Bubble Scatter Matrix'],
    hint: ['位置编码 X/Y，大小通道编码权重，颜色通道区分类别。', 'Size and color channels encode weight and category on 2D plane.'],
    api: 'chart.options({ type: "point" }) · encode.size',
    tags: ['Scatter', 'Bubble', 'Intermediate'],
    code: `// AntV G2 - 多维气泡矩阵散点图
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 24,
  paddingTop: 30,
  paddingBottom: 40
});

chart.options({
  type: 'point',
  data: data.scatter,
  encode: {
    x: 'x',
    y: 'y',
    color: 'group',
    size: (d) => Math.max(5, (d.x + d.y) % 18)
  },
  scale: { color: { range: colors } },
  style: { fillOpacity: 0.65, stroke: '#fff', lineWidth: 1 }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-brush',
    library: 'g2',
    level: 'advanced',
    title: ['散点选区刷选高亮', 'Scatter Brush Highlight'],
    hint: ['在散点图上拖动鼠标拉出矩形框，高亮所选区域散点。', 'Drag to create a selection box highlighting matched scatter points.'],
    api: 'interaction: { brushHighlight: true }',
    tags: ['Scatter', 'Brush', 'Advanced'],
    code: `// AntV G2 - 散点选区刷选高亮
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  paddingLeft: 48,
  paddingRight: 24,
  paddingTop: 30,
  paddingBottom: 40
});

chart.options({
  type: 'point',
  data: data.scatter,
  encode: { x: 'x', y: 'y', color: 'group' },
  scale: { color: { range: colors } },
  style: { fillOpacity: 0.75, r: 5 },
  interaction: { brushHighlight: true }
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
  {
    id: 'g2-overview',
    library: 'g2',
    level: 'advanced',
    title: ['主图与概览时序联动', 'Focus and Overview Linked View'],
    hint: ['在下方时序概览视图中横向框选，实时过滤上方主趋势图。', 'Horizontally brush overview to filter time range in focus view.'],
    api: 'type: "spaceFlex" · direction: "col"',
    tags: ['Overview', 'Time-series', 'Advanced'],
    code: `// AntV G2 - 主图与概览时序联动
// 可用参数: container, G2, data, colors, en

const chart = new G2.Chart({
  container,
  autoFit: true,
  padding: 10
});

const timeline = data.timeline.slice(0, 48);

chart.options({
  type: 'spaceFlex',
  direction: 'col',
  ratio: [3, 1],
  children: [
    {
      type: 'view',
      key: 'focus',
      interaction: { brushXFilter: true },
      paddingLeft: 45,
      paddingRight: 20,
      paddingTop: 10,
      paddingBottom: 25,
      children: [
        {
          type: 'line',
          data: timeline,
          encode: { x: 'date', y: 'value' },
          style: { stroke: colors[0], lineWidth: 2.5 }
        }
      ]
    },
    {
      type: 'view',
      key: 'overview',
      interaction: { brushXFilter: true },
      axis: false,
      paddingLeft: 45,
      paddingRight: 20,
      paddingTop: 5,
      paddingBottom: 25,
      children: [
        {
          type: 'area',
          data: timeline,
          encode: { x: 'date', y: 'value' },
          style: { fill: colors[1], fillOpacity: 0.4 }
        }
      ]
    }
  ]
});

await chart.render();

return {
  resize: () => chart.forceFit(),
  destroy: () => chart.destroy()
};
`,
  },
]
