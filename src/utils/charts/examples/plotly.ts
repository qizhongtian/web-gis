import type { ChartItem } from '../model'

export const plotlyExamples: ChartItem[] = [
  {
    id: 'plotly-bar',
    library: 'plotly',
    level: 'basic',
    title: ['交互式分类柱状图', 'Interactive Category Bar Chart'],
    hint: ['Plotly 默认自带交互提示悬浮框与右上角快速工具栏。', 'Interactive bar chart with hover tooltips and toolbar.'],
    api: 'Plotly.newPlot · type="bar"',
    tags: ['Bar', 'Basic'],
    code: `// Plotly.js - 交互式分类柱状图
// 可用参数: container, Plotly, data, colors, en

const trace = {
  x: data.months,
  y: data.primary,
  type: 'bar',
  marker: {
    color: colors[0],
    opacity: 0.88
  }
};

const layout = {
  autosize: true,
  margin: { l: 45, r: 25, t: 30, b: 40 },
  xaxis: { title: en ? 'Month' : '月份' },
  yaxis: { title: en ? 'Value' : '数值', gridcolor: '#e2e8f0' }
};

await Plotly.newPlot(container, [trace], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-line',
    library: 'plotly',
    level: 'basic',
    title: ['时序折线与范围滑块', 'Time Series Line with Slider'],
    hint: ['下置 rangeslider 范围滑块，支持选区联动与双序列对比。', 'Rangeslider-enabled time series comparing two trends.'],
    api: 'type="scatter" · mode="lines" · xaxis.rangeslider',
    tags: ['Line', 'Time-series', 'Basic'],
    code: `// Plotly.js - 时序折线与范围滑块
// 可用参数: container, Plotly, data, colors, en

const dates = data.timeline.slice(0, 48).map(d => d.date);
const values1 = data.timeline.slice(0, 48).map(d => d.value);
const values2 = data.timeline.slice(0, 48).map(d => Math.round(d.value * 0.75 + 15));

const trace1 = {
  x: dates,
  y: values1,
  type: 'scatter',
  mode: 'lines',
  name: en ? 'Actual' : '实际值',
  line: { color: colors[0], width: 2.5 }
};

const trace2 = {
  x: dates,
  y: values2,
  type: 'scatter',
  mode: 'lines',
  name: en ? 'Predicted' : '预测值',
  line: { color: colors[2], width: 2, dash: 'dot' }
};

const layout = {
  autosize: true,
  margin: { l: 45, r: 25, t: 30, b: 40 },
  hovermode: 'x unified',
  legend: { orientation: 'h', y: 1.15 },
  xaxis: {
    type: 'date',
    rangeslider: { visible: true, thickness: 0.16 }
  },
  yaxis: { gridcolor: '#e2e8f0' }
};

await Plotly.newPlot(container, [trace1, trace2], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-donut',
    library: 'plotly',
    level: 'basic',
    title: ['环形百分比构成图', 'Donut Share Chart'],
    hint: ['hole 属性挖孔构成环形图，悬停展示精准份额与数值。', 'Donut chart mapping category shares with center hole.'],
    api: 'type="pie" · hole=0.55 · textinfo="percent+label"',
    tags: ['Pie', 'Donut', 'Basic'],
    code: `// Plotly.js - 环形百分比构成图
// 可用参数: container, Plotly, data, colors, en

const trace = {
  labels: data.shares.map(d => d.name),
  values: data.shares.map(d => d.value),
  type: 'pie',
  hole: 0.52,
  textinfo: 'label+percent',
  marker: { colors }
};

const layout = {
  autosize: true,
  margin: { l: 20, r: 20, t: 30, b: 20 },
  showlegend: true,
  legend: { orientation: 'h', y: -0.1 }
};

await Plotly.newPlot(container, [trace], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-radar',
    library: 'plotly',
    level: 'basic',
    title: ['极坐标雷达多边形图', 'Polar Radar Polygon'],
    hint: ['scatterpolar 极坐标绘制闭合多边形，对比多维能力指标。', 'Polar coordinate polygon evaluating radar metrics.'],
    api: 'type="scatterpolar" · fill="toself"',
    tags: ['Polar', 'Radar', 'Basic'],
    code: `// Plotly.js - 极坐标雷达多边形图
// 可用参数: container, Plotly, data, colors, en

const categories = en
  ? ['Speed', 'Stability', 'Coverage', 'Usability', 'Extensibility', 'Speed']
  : ['计算速度', '运行稳定', '覆盖范围', '易用程度', '扩展灵活', '计算速度'];

const trace1 = {
  type: 'scatterpolar',
  r: [85, 90, 75, 92, 88, 85],
  theta: categories,
  fill: 'toself',
  name: en ? 'Model Alpha' : '模型 Alpha',
  line: { color: colors[0] }
};

const trace2 = {
  type: 'scatterpolar',
  r: [70, 80, 95, 78, 82, 70],
  theta: categories,
  fill: 'toself',
  name: en ? 'Model Beta' : '模型 Beta',
  line: { color: colors[1] }
};

const layout = {
  autosize: true,
  margin: { l: 40, r: 40, t: 40, b: 40 },
  polar: {
    radialaxis: { visible: true, range: [0, 100] }
  },
  legend: { orientation: 'h', y: 1.15 }
};

await Plotly.newPlot(container, [trace1, trace2], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-box-violin',
    library: 'plotly',
    level: 'intermediate',
    title: ['箱线与小提琴复合分布', 'Box and Violin Plot'],
    hint: ['结合箱线四分位数与小提琴概率密度，直观展示统计分布。', 'Box and violin plot combining quartiles with kernel density.'],
    api: 'type="box" · type="violin" · boxmode="group"',
    tags: ['Box', 'Violin', 'Intermediate'],
    code: `// Plotly.js - 箱线与小提琴复合分布
// 可用参数: container, Plotly, data, colors, en

const traces = data.groups.flatMap((group, i) => {
  const y = data.timeline.filter((_, j) => j % 3 === i).map((d, j) =>
    Math.round(d.value * (0.6 + 0.15 * i) + data.primary[j % data.primary.length] * 0.2)
  );
  return [
    {
      type: 'box',
      y: y,
      name: group,
      marker: { color: colors[i] },
      boxpoints: 'outliers'
    },
    {
      type: 'violin',
      y: y,
      name: group,
      line: { color: colors[i] },
      meanline: { visible: true }
    }
  ];
});

const layout = {
  autosize: true,
  margin: { l: 45, r: 25, t: 30, b: 40 },
  yaxis: { gridcolor: '#e2e8f0' },
  showlegend: false
};

await Plotly.newPlot(container, traces, layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-heatmap',
    library: 'plotly',
    level: 'intermediate',
    title: ['二维统计密度热力矩阵', '2D Density Heatmap'],
    hint: ['在离散 X/Y 轴上用色彩渐变展示密度与强度矩阵。', 'Heatmap visualizing value density across 2D categorical grid.'],
    api: 'type="heatmap" · colorscale="Viridis"',
    tags: ['Heatmap', 'Density', 'Intermediate'],
    code: `// Plotly.js - 二维统计密度热力矩阵
// 可用参数: container, Plotly, data, colors, en

const x = data.months.slice(0, 8);
const y = (en ? ['Morning', 'Noon', 'Evening', 'Night'] : ['早间', '午间', '晚间', '夜间']);

const z = y.map((_, yi) =>
  x.map((_, xi) => Math.round(20 + 70 * Math.sin((xi + 1) * 0.5) * Math.cos((yi + 1) * 0.8) + (xi + yi) * 4))
);

const trace = {
  z: z,
  x: x,
  y: y,
  type: 'heatmap',
  colorscale: 'Blues',
  hoverongaps: false
};

const layout = {
  autosize: true,
  margin: { l: 60, r: 30, t: 30, b: 40 }
};

await Plotly.newPlot(container, [trace], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-lasso',
    library: 'plotly',
    level: 'advanced',
    title: ['散点套索交互圈选', 'Scatter Lasso Selection Event'],
    hint: ['启用 lasso 套索工具，圈选散点后触发 plotly_selected 回调。', 'Lasso selection tool capturing interactive scatter picks.'],
    api: 'layout.dragmode="lasso" · plotly_selected',
    tags: ['Scatter', 'Lasso', 'Advanced'],
    code: `// Plotly.js - 散点套索交互圈选
// 可用参数: container, Plotly, data, colors, en, status

const traces = data.groups.map((group, i) => {
  const points = data.scatter.filter(d => d.group === group);
  return {
    type: 'scatter',
    mode: 'markers',
    name: group,
    x: points.map(d => d.x),
    y: points.map(d => d.y),
    marker: { size: 9, color: colors[i] },
    selected: { marker: { opacity: 1, size: 12 } },
    unselected: { marker: { opacity: 0.18 } }
  };
});

const layout = {
  autosize: true,
  dragmode: 'lasso',
  margin: { l: 45, r: 25, t: 30, b: 40 },
  xaxis: { gridcolor: '#e2e8f0' },
  yaxis: { gridcolor: '#e2e8f0' }
};

const plot = await Plotly.newPlot(container, traces, layout, { displaylogo: false, responsive: true });
plot.on('plotly_selected', event => {
  const count = event?.points?.length ?? 0;
  status(en ? count + ' points selected' : '已选中 ' + count + ' 个点');
});
plot.on('plotly_deselect', () => status(''));

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
  {
    id: 'plotly-surface',
    library: 'plotly',
    level: 'advanced',
    title: ['WebGL 3D 旋转曲面图', 'WebGL 3D Surface Plot'],
    hint: ['基于 WebGL 硬件加速，鼠标按住左键自由三维旋转与缩放。', 'Hardware-accelerated WebGL 3D surface with full rotation.'],
    api: 'type="surface" · scene.aspectratio · contours',
    tags: ['3D', 'Surface', 'WebGL', 'Advanced'],
    code: `// Plotly.js - WebGL 3D 旋转曲面图
// 可用参数: container, Plotly, data, colors, en

const size = 30;
const x = Array.from({ length: size }, (_, i) => (i - size / 2) / 3);
const z = x.map(y =>
  x.map(v => {
    const r = Math.hypot(v, y);
    return Math.cos(1.8 * r) * Math.exp(-r * 0.22);
  })
);

const trace = {
  type: 'surface',
  x: x,
  y: x,
  z: z,
  colorscale: 'Viridis',
  contours: {
    z: { show: true, usecolormap: true, project: { z: true } }
  }
};

const layout = {
  autosize: true,
  margin: { l: 5, r: 5, t: 20, b: 10 },
  scene: {
    aspectmode: 'manual',
    aspectratio: { x: 1, y: 1, z: 0.6 }
  }
};

await Plotly.newPlot(container, [trace], layout, { displaylogo: false, responsive: true });

return {
  resize: () => Plotly.Plots.resize(container),
  destroy: () => Plotly.purge(container)
};
`,
  },
]
