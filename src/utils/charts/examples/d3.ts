import type { ChartItem } from '../model'

export const d3Examples: ChartItem[] = [
  {
    id: 'd3-bar',
    library: 'd3',
    level: 'basic',
    title: ['标准 SVG 交互柱状图', 'Standard SVG Bar Chart'],
    hint: ['使用 d3.scaleBand 和 d3.scaleLinear，纯原生 SVG 绘制与悬浮交互。', 'Raw SVG bars generated using d3 scaleBand and scaleLinear.'],
    api: 'd3.scaleBand · d3.scaleLinear · d3.axisBottom',
    tags: ['SVG', 'Bar', 'Basic'],
    code: `// D3.js - 标准 SVG 交互柱状图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const margin = { top: 30, right: 20, bottom: 40, left: 45 };

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

const x = d3.scaleBand()
  .domain(data.months)
  .range([margin.left, width - margin.right])
  .padding(0.28);

const y = d3.scaleLinear()
  .domain([0, d3.max(data.primary) * 1.15])
  .nice()
  .range([height - margin.bottom, margin.top]);

// 绘制轴线
svg.append('g')
  .attr('transform', \`translate(0,\${height - margin.bottom})\`)
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .call(g => g.selectAll('text').attr('fill', '#475569'));

svg.append('g')
  .attr('transform', \`translate(\${margin.left},0)\`)
  .call(d3.axisLeft(y).ticks(5))
  .call(g => g.select('.domain').remove())
  .call(g => g.selectAll('.tick line').clone().attr('x2', width - margin.right - margin.left).attr('stroke', '#f1f5f9'));

// 绘制柱体
svg.append('g')
  .selectAll('rect')
  .data(data.months.map((m, i) => ({ month: m, value: data.primary[i] })))
  .join('rect')
  .attr('x', d => x(d.month))
  .attr('y', d => y(d.value))
  .attr('height', d => y(0) - y(d.value))
  .attr('width', x.bandwidth())
  .attr('fill', colors[0])
  .attr('rx', 4)
  .append('title')
  .text(d => d.month + ': ' + d.value);

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-line-area',
    library: 'd3',
    level: 'basic',
    title: ['平滑折线与渐变背景面积', 'Gradient Line and Area Chart'],
    hint: ['d3.line 与 d3.area 结合 curveMonotoneX 平滑样条与渐变着色。', 'Smooth line with SVG linearGradient background using curveMonotoneX.'],
    api: 'd3.line · d3.area · d3.curveMonotoneX',
    tags: ['Line', 'Area', 'Basic'],
    code: `// D3.js - 平滑折线与渐变背景面积
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const margin = { top: 30, right: 24, bottom: 40, left: 45 };

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

// 定义渐变
const defs = svg.append('defs');
const gradient = defs.append('linearGradient')
  .attr('id', 'area-grad')
  .attr('x1', '0%').attr('y1', '0%')
  .attr('x2', '0%').attr('y2', '100%');
gradient.append('stop').attr('offset', '0%').attr('stop-color', colors[0]).attr('stop-opacity', 0.5);
gradient.append('stop').attr('offset', '100%').attr('stop-color', colors[0]).attr('stop-opacity', 0.02);

const dataset = data.months.map((m, i) => ({ month: m, value: data.primary[i] }));

const x = d3.scalePoint()
  .domain(data.months)
  .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
  .domain([0, d3.max(data.primary) * 1.2])
  .nice()
  .range([height - margin.bottom, margin.top]);

const line = d3.line()
  .x(d => x(d.month))
  .y(d => y(d.value))
  .curve(d3.curveMonotoneX);

const area = d3.area()
  .x(d => x(d.month))
  .y0(y(0))
  .y1(d => y(d.value))
  .curve(d3.curveMonotoneX);

// 绘制面积与折线
svg.append('path').datum(dataset).attr('fill', 'url(#area-grad)').attr('d', area);
svg.append('path').datum(dataset).attr('fill', 'none').attr('stroke', colors[0]).attr('stroke-width', 3).attr('d', line);

// 坐标轴
svg.append('g').attr('transform', \`translate(0,\${height - margin.bottom})\`).call(d3.axisBottom(x));
svg.append('g').attr('transform', \`translate(\${margin.left},0)\`).call(d3.axisLeft(y).ticks(5));

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-donut',
    library: 'd3',
    level: 'basic',
    title: ['交互式空心环形图', 'Interactive Donut Chart'],
    hint: ['d3.pie 计算扇区弧度，d3.arc 生成内切圆弧路径与外圈标签。', 'Donut geometry built via d3.pie and d3.arc.'],
    api: 'd3.pie · d3.arc',
    tags: ['Pie', 'Donut', 'Basic'],
    code: `// D3.js - 交互式空心环形图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const radius = Math.min(width, height) / 2 - 32;

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`)
  .append('g')
  .attr('transform', \`translate(\${width / 2},\${height / 2})\`);

const color = d3.scaleOrdinal()
  .domain(data.shares.map(d => d.name))
  .range(colors);

const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

const arc = d3.arc()
  .innerRadius(radius * 0.55)
  .outerRadius(radius)
  .cornerRadius(6);

const arcs = svg.selectAll('.arc')
  .data(pie(data.shares))
  .join('g')
  .attr('class', 'arc');

arcs.append('path')
  .attr('d', arc)
  .attr('fill', d => color(d.data.name))
  .attr('stroke', '#fff')
  .style('stroke-width', '2px');

arcs.append('text')
  .attr('transform', d => \`translate(\${arc.centroid(d)})\`)
  .attr('text-anchor', 'middle')
  .attr('font-size', '11px')
  .attr('fill', '#fff')
  .text(d => d.data.name);

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-scatter',
    library: 'd3',
    level: 'basic',
    title: ['二维散点气泡分布图', 'Scatter Bubble Chart'],
    hint: ['气泡半径按数据权重映射，支持颜色分类与平滑点过渡。', 'Bubble scatter chart mapping coordinates and radius dynamically.'],
    api: 'd3.scaleSqrt · d3.scaleOrdinal',
    tags: ['Scatter', 'Bubble', 'Basic'],
    code: `// D3.js - 二维散点气泡分布图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const margin = { top: 30, right: 30, bottom: 40, left: 45 };

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

const x = d3.scaleLinear()
  .domain([0, 100])
  .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
  .domain([0, 90])
  .range([height - margin.bottom, margin.top]);

const r = d3.scaleSqrt()
  .domain([0, 100])
  .range([4, 12]);

const color = d3.scaleOrdinal()
  .domain(data.groups)
  .range(colors);

svg.append('g').attr('transform', \`translate(0,\${height - margin.bottom})\`).call(d3.axisBottom(x));
svg.append('g').attr('transform', \`translate(\${margin.left},0)\`).call(d3.axisLeft(y));

svg.selectAll('circle')
  .data(data.scatter.slice(0, 60))
  .join('circle')
  .attr('cx', d => x(d.x))
  .attr('cy', d => y(d.y))
  .attr('r', d => r(d.x + d.y))
  .attr('fill', d => color(d.group))
  .attr('fill-opacity', 0.65)
  .attr('stroke', '#fff')
  .attr('stroke-width', 1.5);

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-gauge',
    library: 'd3',
    level: 'intermediate',
    title: ['仪表量表弧形进度图', 'Arc Gauge Progress Meter'],
    hint: ['极坐标下生成半圆弧进度条，结合指示器展示综合得分。', 'Semicircular arc gauge showing progress percentage and score.'],
    api: 'd3.arc · startAngle · endAngle',
    tags: ['Gauge', 'Arc', 'Intermediate'],
    code: `// D3.js - 仪表量表弧形进度图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const radius = Math.min(width, height) / 2 - 20;

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`)
  .append('g')
  .attr('transform', \`translate(\${width / 2},\${height / 2 + 30})\`);

const arcBg = d3.arc()
  .innerRadius(radius * 0.72)
  .outerRadius(radius)
  .startAngle(-Math.PI / 2)
  .endAngle(Math.PI / 2);

const score = 78; // 进度百分比
const angle = -Math.PI / 2 + (Math.PI * score / 100);

const arcVal = d3.arc()
  .innerRadius(radius * 0.72)
  .outerRadius(radius)
  .startAngle(-Math.PI / 2)
  .endAngle(angle)
  .cornerRadius(6);

svg.append('path').attr('d', arcBg).attr('fill', '#e2e8f0');
svg.append('path').attr('d', arcVal).attr('fill', colors[0]);

svg.append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '-0.1em')
  .attr('font-size', '36px')
  .attr('font-weight', 'bold')
  .attr('fill', '#1e293b')
  .text(\`\${score}%\`);

svg.append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '1.8em')
  .attr('font-size', '13px')
  .attr('fill', '#64748b')
  .text(en ? 'System Performance Score' : '综合性能评估得分');

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-brush',
    library: 'd3',
    level: 'intermediate',
    title: ['双向概览刷选缩放', 'Brush and Zoom Overview'],
    hint: ['d3.brushX 绑定底层概览时间轴，刷选实时缩放主视口曲线。', 'Two-tier timeline chart where brushX scales the main view.'],
    api: 'd3.brushX · d3.scaleLinear.domain',
    tags: ['Brush', 'Zoom', 'Intermediate'],
    code: `// D3.js - 双向概览刷选缩放
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;
const margin = { top: 20, right: 20, bottom: 90, left: 45 };
const margin2 = { top: height - 60, right: 20, bottom: 20, left: 45 };

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

const x = d3.scaleLinear().domain([0, data.timeline.length - 1]).range([margin.left, width - margin.right]);
const x2 = d3.scaleLinear().domain(x.domain()).range([margin2.left, width - margin2.right]);
const y = d3.scaleLinear().domain([0, 120]).range([margin.top + 160, margin.top]);
const y2 = d3.scaleLinear().domain(y.domain()).range([height - margin2.bottom, margin2.top]);

const line = d3.line().x(d => x(d.x)).y(d => y(d.value)).curve(d3.curveMonotoneX);
const line2 = d3.line().x(d => x2(d.x)).y(d => y2(d.value));

// 剪裁路径
svg.append('defs').append('clipPath')
  .attr('id', 'clip-d3')
  .append('rect')
  .attr('x', margin.left)
  .attr('y', margin.top)
  .attr('width', width - margin.left - margin.right)
  .attr('height', 160);

const focus = svg.append('g');
const path = focus.append('path')
  .datum(data.timeline)
  .attr('clip-path', 'url(#clip-d3)')
  .attr('fill', 'none')
  .attr('stroke', colors[0])
  .attr('stroke-width', 2)
  .attr('d', line);

const context = svg.append('g');
context.append('path')
  .datum(data.timeline)
  .attr('fill', 'none')
  .attr('stroke', colors[1])
  .attr('stroke-width', 1.5)
  .attr('d', line2);

const brush = d3.brushX()
  .extent([[margin2.left, margin2.top], [width - margin2.right, height - margin2.bottom]])
  .on('brush end', ({ selection }) => {
    x.domain(selection ? selection.map(x2.invert) : x2.domain());
    path.attr('d', line);
  });

context.append('g').call(brush).call(brush.move, [x2(15), x2(65)]);

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-treemap',
    library: 'd3',
    level: 'advanced',
    title: ['层级权重矩形树图', 'Hierarchical Treemap'],
    hint: ['d3.hierarchy 配合 d3.treemap 计算空间切块，面积表达权重。', 'Treemap layout dividing area by hierarchical weight values.'],
    api: 'd3.hierarchy · d3.treemap',
    tags: ['Treemap', 'Hierarchy', 'Advanced'],
    code: `// D3.js - 层级权重矩形树图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

const treeData = {
  name: 'Root',
  children: data.groups.map((group, i) => ({
    name: group,
    children: [
      { name: \`\${group}-1\`, value: 35 + i * 15 },
      { name: \`\${group}-2\`, value: 25 + i * 10 },
      { name: \`\${group}-3\`, value: 18 + i * 8 }
    ]
  }))
};

const root = d3.hierarchy(treeData)
  .sum(d => d.value)
  .sort((a, b) => b.value - a.value);

d3.treemap().size([width, height]).padding(3)(root);

const color = d3.scaleOrdinal().domain(data.groups).range(colors);

const leaf = svg.selectAll('g')
  .data(root.leaves())
  .join('g')
  .attr('transform', d => \`translate(\${d.x0},\${d.y0})\`);

leaf.append('rect')
  .attr('width', d => d.x1 - d.x0)
  .attr('height', d => d.y1 - d.y0)
  .attr('fill', d => color(d.parent.data.name))
  .attr('fill-opacity', 0.85)
  .attr('rx', 4);

leaf.append('text')
  .attr('x', 6)
  .attr('y', 18)
  .attr('font-size', '11px')
  .attr('fill', '#fff')
  .text(d => \`\${d.data.name} (\${d.data.value})\`);

return {
  destroy: () => d3.select(container).selectAll('*').remove()
};
`,
  },
  {
    id: 'd3-force',
    library: 'd3',
    level: 'advanced',
    title: ['可拖拽力导向拓扑图', 'Interactive Force-directed Graph'],
    hint: ['d3.forceSimulation 力学引擎模拟引力与斥力，支持鼠标拖拽互动。', 'Force-directed network graph with drag simulation.'],
    api: 'd3.forceSimulation · d3.forceLink · d3.drag',
    tags: ['Force', 'Graph', 'Advanced'],
    code: `// D3.js - 可拖拽力导向拓扑图
// 可用参数: container, d3, data, colors, en

const width = container.clientWidth || 560;
const height = container.clientHeight || 360;

const svg = d3.select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('viewBox', \`0 0 \${width} \${height}\`);

const nodes = [
  { id: 'Center', group: 0, r: 16 },
  { id: 'Node A', group: 1, r: 11 },
  { id: 'Node B', group: 1, r: 11 },
  { id: 'Node C', group: 2, r: 11 },
  { id: 'Node D', group: 2, r: 11 },
  { id: 'Node E', group: 3, r: 11 },
  { id: 'Node F', group: 3, r: 11 }
];

const links = [
  { source: 'Center', target: 'Node A' },
  { source: 'Center', target: 'Node B' },
  { source: 'Center', target: 'Node C' },
  { source: 'Node A', target: 'Node D' },
  { source: 'Node B', target: 'Node E' },
  { source: 'Node C', target: 'Node F' },
  { source: 'Node E', target: 'Node F' }
];

const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(d => d.id).distance(65))
  .force('charge', d3.forceManyBody().strength(-160))
  .force('center', d3.forceCenter(width / 2, height / 2));

const link = svg.append('g')
  .selectAll('line')
  .data(links)
  .join('line')
  .attr('stroke', '#cbd5e1')
  .attr('stroke-width', 2);

const node = svg.append('g')
  .selectAll('circle')
  .data(nodes)
  .join('circle')
  .attr('r', d => d.r)
  .attr('fill', d => colors[d.group % colors.length])
  .attr('stroke', '#fff')
  .attr('stroke-width', 2)
  .call(d3.drag()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    })
  );

simulation.on('tick', () => {
  link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  node.attr('cx', d => d.x).attr('cy', d => d.y);
});

return {
  destroy: () => {
    simulation.stop();
    d3.select(container).selectAll('*').remove();
  }
};
`,
  },
]
