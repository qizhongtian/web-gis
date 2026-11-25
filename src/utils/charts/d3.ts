import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'
import { getEngine } from './loader'
import { colors, type RenderOptions, type DemoHandle } from './model'

export async function render(options: RenderOptions, signal: AbortSignal): Promise<DemoHandle> {
  const { host, index, data } = options
  const d = await getEngine('d3', signal)
  const w = 860, h = 390, width = 784, height = 320
  const svg = d.select(host).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('height', '100%')
  const g = svg.append('g').attr('transform', 'translate(50,23)')
  const palette = d.scaleOrdinal<string, string>().range(colors)
  let stop: (() => void) | undefined

  if (index <= 1) {
    const points = data.months.map((month: string, i: number) => ({ month, value: data.primary[i] }))
    const x = d.scaleBand().domain(data.months).range([0, width]).padding(0.27)
    const y = d.scaleLinear().domain([0, d.max(data.primary as number[])!]).nice().range([height, 0])
    const cx = (p: typeof points[number]) => x(p.month)! + x.bandwidth() / 2
    g.append('g').call(d.axisLeft(y).ticks(6).tickSize(-width)).call(a => a.selectAll('.tick line').attr('stroke', '#e2e8f0')).call(a => a.select('.domain').remove())
    g.append('g').attr('transform', `translate(0,${height})`).call(d.axisBottom(x).tickSizeOuter(0))
    if (index === 0) {
      g.selectAll('rect').data(points).join('rect').attr('x', p => x(p.month)!).attr('y', p => y(p.value)).attr('width', x.bandwidth()).attr('height', p => height - y(p.value)).attr('rx', 4).attr('fill', colors[0]).append('title').text(p => `${p.month}: ${p.value}`)
    } else {
      const area = d.area<typeof points[number]>().x(cx).y0(height).y1(p => y(p.value)).curve(d.curveMonotoneX)
      const line = d.line<typeof points[number]>().x(cx).y(p => y(p.value)).curve(d.curveMonotoneX)
      g.append('path').datum(points).attr('d', area).attr('fill', '#dbeafe')
      g.append('path').datum(points).attr('d', line).attr('stroke', colors[0]).attr('stroke-width', 3).attr('fill', 'none')
      g.selectAll('circle').data(points).join('circle').attr('cx', cx).attr('cy', p => y(p.value)).attr('r', 4).attr('fill', colors[0]).append('title').text(p => `${p.month}: ${p.value}`)
    }
  } else if (index === 2) {
    const slices = d.pie<typeof data.shares[number]>().sort(null).value(p => p.value)(data.shares)
    const center = svg.append('g').attr('transform', 'translate(430,182)')
    const arc = d.arc<typeof slices[number]>().innerRadius(76).outerRadius(141).padAngle(0.02).cornerRadius(4)
    center.selectAll('path').data(slices).join('path').attr('d', arc).attr('fill', p => palette(p.data.name)).append('title').text(p => `${p.data.name}: ${p.data.value}`)
    center.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#1e293b').attr('font-size', 25).text(d.sum(data.shares, p => p.value))
    const legend = svg.append('g').attr('transform', 'translate(141,360)').selectAll('g').data(data.shares).join('g').attr('transform', (_, i) => `translate(${i * 100})`)
    legend.append('circle').attr('r', 5).attr('fill', p => palette(p.name))
    legend.append('text').attr('x', 10).attr('dy', '0.35em').attr('fill', '#475569').attr('font-size', 13).text(p => p.name)
  } else if (index === 3) {
    const points = data.timeline, main = 223, overview = 49
    const domain = [0, points.length - 1]
    const full = d.scaleLinear().domain(domain).range([0, width])
    const x = full.copy()
    const y = d.scaleLinear().domain([0, d.max(points, (p: { value: number }) => p.value)!]).nice().range([main, 0])
    const yMini = y.copy().range([overview, 0])
    const line = d.line<typeof points[number]>().x(p => x(p.x)).y(p => y(p.value))
    const path = g.append('svg').attr('width', width).attr('height', main).attr('overflow', 'hidden').append('path').datum(points).attr('d', line).attr('fill', 'none').attr('stroke', colors[0]).attr('stroke-width', 2.8)
    const axis = g.append('g').attr('transform', `translate(0,${main})`)
    const drawAxis = () => axis.call(d.axisBottom(x).ticks(7).tickFormat(n => points[Math.round(+n)]?.date.slice(5) ?? ''))
    drawAxis()
    g.append('g').call(d.axisLeft(y).ticks(5))
    const sub = g.append('g').attr('transform', `translate(0,${height - overview})`)
    sub.append('path').datum(points).attr('d', d.area<typeof points[number]>().x(p => full(p.x)).y0(overview).y1(p => yMini(p.value))).attr('fill', '#cbd5e1')
    const brush = d.brushX().extent([[0, 0], [width, overview]]).on('brush end', ({ selection }) => {
      const target = selection ? selection.map(full.invert) : domain
      x.domain(target)
      path.attr('d', line)
      drawAxis()
    })
    sub.append('g').call(brush).call(brush.move, [width * 0.22, width * 0.74])
  } else if (index === 4) {
    const raw = { name: 'root', children: data.groups.map((name: string, i: number) => ({ name, children: data.modules.map(mod => ({ name: `${name}-${mod}`, value: data.primary[(i * 3 + mod.length) % 12] + 12 })) })) }
    const root = d.treemap<typeof raw>().size([width, height]).paddingInner(3).round(true)(d.hierarchy(raw).sum(p => (p as any).value || 0).sort((a, b) => (b.value || 0) - (a.value || 0)))
    const node = g.selectAll('g').data(root.leaves()).join('g').attr('transform', p => `translate(${p.x0},${p.y0})`)
    node.append('rect').attr('width', p => p.x1 - p.x0).attr('height', p => p.y1 - p.y0).attr('rx', 4).attr('fill', p => palette(p.parent?.data.name ?? '')).append('title').text(p => `${p.data.name}: ${p.value}`)
    node.append('text').attr('x', 6).attr('y', 17).attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 600).text(p => p.data.name.replace(/^[^-]+-/, ''))
  } else {
    type Node = SimulationNodeDatum & { id: string; name: string; group: number }
    type Link = SimulationLinkDatum<Node> & { value: number }
    const nodes: Node[] = data.modules.map((name, i) => ({ id: `m-${i}`, name, group: i % 3, x: width * 0.5 + (i - 2.5) * 50, y: height * 0.5 }))
    const links: Link[] = [[0, 1, 14], [0, 2, 8], [1, 3, 11], [2, 3, 17], [3, 4, 12], [4, 5, 19], [2, 5, 9]].map(([s, t, value]) => ({ source: `m-${s}`, target: `m-${t}`, value }))
    const link = g.append('g').attr('stroke', '#cbd5e1').attr('stroke-opacity', 0.8).selectAll('line').data(links).join('line').attr('stroke-width', p => Math.sqrt(p.value))
    const sim = d.forceSimulation(nodes).force('link', d.forceLink<Node, Link>(links).id(p => p.id).distance(90)).force('charge', d.forceManyBody().strength(-240)).force('center', d.forceCenter(width / 2, height / 2))
    const node = g.append('g').selectAll('g').data(nodes).join('g')
    node.append('circle').attr('r', 19).attr('fill', p => palette(String(p.group))).attr('stroke', '#fff').attr('stroke-width', 2.5)
    node.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 600).text(p => p.name)
    node.call(d.drag<any, any>().on('start', (event: any, p: any) => { if (!event.active) sim.alphaTarget(0.3).restart(); p.fx = p.x; p.fy = p.y }).on('drag', (event: any, p: any) => { p.fx = event.x; p.fy = event.y }).on('end', (event: any, p: any) => { if (!event.active) sim.alphaTarget(0); p.fx = null; p.fy = null }))
    sim.on('tick', () => {
      link.attr('x1', p => (p.source as Node).x!).attr('y1', p => (p.source as Node).y!).attr('x2', p => (p.target as Node).x!).attr('y2', p => (p.target as Node).y!)
      node.attr('transform', p => `translate(${p.x},${p.y})`)
    })
    stop = () => sim.stop()
  }
  return { destroy: () => { stop?.(); d.select(host).selectAll('*').remove() } }
}
