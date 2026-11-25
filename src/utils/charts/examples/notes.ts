import type { ChartItem, Library, Pair } from '../model'

const libraryNotes: Record<Library, Pair> = {
  echarts: ['容器有宽高后再调用 echarts.init；容器尺寸变化时调用 resize，离开页面时调用 dispose。', 'Call echarts.init only after the container has dimensions. Resize on layout changes and dispose on unmount.'],
  g2: ['G2 v5 使用 options/encode，不能直接套用 G2 v4 写法。等待 render() 完成后再操作图表。', 'G2 v5 uses options/encode, unlike v4. Wait for render() to finish before working with the chart.'],
  d3: ['设置 SVG 的 viewBox 以适应尺寸变化；更新时应通过 join 更新元素，或清理旧 SVG，避免重复叠加。', 'Set an SVG viewBox for resizing. Update elements with join or remove the old SVG before redrawing.'],
  plotly: ['newPlot 返回 Promise。绑定事件前先 await，卸载时调用 Plotly.purge 释放资源。', 'newPlot returns a Promise. Await it before binding events, and call Plotly.purge on unmount.'],
}

const exampleNotes: Record<string, Pair> = {
  'echarts-bar': ['月份与数值按下标对应；替换数据时保持两组数组的长度和顺序一致。', 'Month labels and values match by index; keep both arrays aligned.'],
  'echarts-line': ['缺失值用 null 表示，不要填成 0；否则会把缺测画成真实的零值。', 'Use null for missing observations. Zero would be drawn as a real measurement.'],
  'echarts-pie': ['扇区应使用非负值且总和大于零；radius 的两个值依次为内径比例和外径比例。', 'Use non-negative values with a positive total. Radius entries are the inner and outer radii.'],
  'echarts-scatter': ['tooltip 的 value 按 [x, y] 读取；增加维度时同步调整格式化逻辑。', 'The tooltip reads value as [x, y]. Update the formatter when adding dimensions.'],
  'echarts-stacked-bar': ['只有 stack 名称相同的系列才会堆叠；每个系列都要和分类轴一一对应。', 'Series stack only if they share a stack name, and their values must align with the category axis.'],
  'echarts-rose': ['roseType: radius 同时用角度和半径表达大小，精确比较时优先看提示值。', 'With roseType: radius, both angle and radius vary; use tooltip values for precise comparison.'],
  'echarts-radar': ['每个 value 必须与 indicator 的顺序匹配；比较多组时使用相同量纲或统一归一化。', 'Match each value to its indicator by position. Compare crossed units only after normalization.'],
  'echarts-zoom': ['start/end 是 0–100 的百分比，不是日期；按实际日期定位请用 startValue/endValue。', 'start/end are percentages, not dates. Use startValue/endValue for actual dates.'],
  'echarts-sankey': ['source/target 必须和节点 name 完全一致；不要构建循环流向，流量使用正数。', 'source/target must match node names. Avoid cycles and use positive flow values.'],
  'g2-bar': ['月份字段应保持一致的文本格式；缺值不要转成字符串，否则数值比例尺会失效。', 'Keep month labels consistent and preserve numeric values for the quantitative scale.'],
  'g2-line': ['每个系列先按时间排序；颜色通道不仅上色，也决定折线分组。', 'Sort each series by time. The color channel also defines line grouping.'],
  'g2-area': ['stackY 会显示累计量，而不是让两条面积独立重叠；图例应说明组成关系。', 'stackY shows a cumulative total, not overlapping independent areas. Label the components accordingly.'],
  'g2-theta': ['theta 只负责坐标变换，扇区还需要 stackY；让各类别数值为非负。', 'theta only changes coordinates; stackY forms the slices. Use non-negative values.'],
  'g2-dodge': ['dodgeX 需要颜色或分组字段；只有一个系列时不会出现并排效果。', 'dodgeX needs a group or color channel; one series cannot produce side-by-side bars.'],
  'g2-scatter': ['size 是第三个数据通道；想让气泡可比较，固定 size 比例尺的范围。', 'Size encodes a third variable. Fix its scale range for consistent comparisons.'],
  'g2-brush': ['brushHighlight 只高亮，不删除数据；若需要改变数据范围，使用过滤交互。', 'brushHighlight only changes emphasis. Use a filter interaction to alter the displayed range.'],
  'g2-overview': ['两视图要共享 x 编码，并都启用 brushXFilter 才能联动。', 'Both views must share the x encoding and enable brushXFilter to stay linked.'],
  'd3-bar': ['柱高为 y(0) − y(value)，不是 value；SVG 的 y 轴向下增长。', 'Bar height is y(0) − y(value), not the raw value. SVG y increases downwards.'],
  'd3-line-area': ['curveMonotoneX 假定 x 单调；先按时间排序，再生成折线和面积。', 'curveMonotoneX assumes monotonic x values. Sort by time before constructing paths.'],
  'd3-donut': ['弧度由 pie() 生成，arc() 再转成 SVG 路径；比例直接传给 arc() 不会自动排布。', 'pie() computes angles and arc() builds SVG paths. arc() does not lay out raw shares.'],
  'd3-scatter': ['气泡用 scaleSqrt 将半径映射到权重，使圆面积而不是半径代表大小。', 'Use scaleSqrt so the circle area, rather than its radius, encodes weight.'],
  'd3-gauge': ['角度单位是弧度；外部进度值应先限制在 0–100。', 'Angles use radians; clamp external progress values to 0–100 first.'],
  'd3-brush': ['brush 返回屏幕像素，用 invert 转成数据范围；取消选区时 selection 为 null。', 'Brush coordinates are pixels. Convert them with invert; a cleared selection is null.'],
  'd3-treemap': ['先对层级数据调用 sum()，再运行 treemap；没有权重的叶子可能没有面积。', 'Call sum() before computing the treemap. Leaves without weight can have no visible area.'],
  'd3-force': ['力模拟会修改节点坐标与边引用，复用原始数据时先复制；离开页面时调用 stop()。', 'Forces mutate node positions and link references. Clone reusable data and stop the simulation on unmount.'],
  'plotly-bar': ['x 和 y 数组按位置配对；新版轴标题可用 axis.title.text。', 'x and y entries pair by index. Set axis titles with axis.title.text.'],
  'plotly-line': ['rangeslider 需要有序的可解析日期；保留足够的底部空间放滑块。', 'Use ordered, parseable dates for the range slider and leave enough room below the plot.'],
  'plotly-donut': ['hole 的范围是 0–1；小扇区标签拥挤时优先保留悬停提示。', 'hole is a fraction from 0 to 1. For small slices, favor tooltip labels over crowded text.'],
  'plotly-radar': ['要闭合折线，结尾重复首个类别和数值。各系列应使用同一类别顺序。', 'Repeat the first category and value to close the line. Match category order across traces.'],
  'plotly-box-violin': ['箱线图与小提琴图应使用同一批原始样本比较；不能拿汇总后的均值替代样本。', 'Use the same raw samples in box and violin traces. Aggregated means cannot replace samples.'],
  'plotly-heatmap': ['z 的行对应 y，列对应 x；替换数据时不要把矩阵转置。', 'Each z row corresponds to y and each column to x. Do not transpose the matrix accidentally.'],
  'plotly-lasso': ['要使用支持选区的散点类型；plotly_selected 的 points 可能为空，清选区使用 plotly_deselect。', 'Use a selectable scatter trace. Selection can be empty; listen for plotly_deselect to clear it.'],
  'plotly-surface': ['浏览器需要支持 WebGL；z 是二维规则网格，行对应 y、列对应 x。', 'Requires WebGL. z is a rectangular grid with rows for y and columns for x.'],
}

export function chartNotes(item: ChartItem): Pair[] {
  return [exampleNotes[item.id], libraryNotes[item.library]].filter(Boolean)
}
