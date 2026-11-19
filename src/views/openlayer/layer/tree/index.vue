<script setup lang="ts">
import { shallowRef } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createBaseLayer, createDemoMap } from '@/utils/gis/olDemo'

interface TreeNode {
  id: string
  label: string
  depth: number
  layer?: any
  group?: any
  visible: boolean
}

const nodes = shallowRef<TreeNode[]>([])
let map: any = null

function refresh() {
  nodes.value = nodes.value.map((n) => ({
    ...n,
    visible: n.layer ? n.layer.getVisible() : n.group.getVisible(),
  }))
}

function toggleNode(node: TreeNode) {
  if (node.group) {
    const next = !node.group.getVisible()
    node.group.setVisible(next)
    node.group.getLayers().forEach((l: any) => l.setVisible(next))
  } else {
    node.layer.setVisible(!node.layer.getVisible())
  }
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  const { Feature, Point, VectorSource, VectorLayer, LayerGroup, Style, Fill, Stroke, CircleStyle } = lib

  const base = createBaseLayer(lib, 'light')
  const cities = new VectorLayer({
    source: new VectorSource({
      features: ['北京', '天津', '石家庄'].map(
        (name, i) =>
          new Feature({
            geometry: new Point(lib.fromLonLat([[116.407, 39.904], [117.2, 39.084], [114.514, 38.042]][i])),
            name,
          }),
      ),
    }),
    style: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#f97316' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })
  const route = new VectorLayer({
    source: new VectorSource({
      features: [
        new Feature({
          geometry: new lib.LineString([
            lib.fromLonLat([114.514, 38.042]),
            lib.fromLonLat([116.407, 39.904]),
            lib.fromLonLat([117.2, 39.084]),
          ]),
        }),
      ],
    }),
    style: new Style({ stroke: new Stroke({ color: '#22d3ee', width: 3 }) }),
  })
  const area = new VectorLayer({
    source: new VectorSource({
      features: [
        new Feature({
          geometry: lib.polygonFromExtent(lib.transformExtent([115.6, 39.3, 117.1, 40.2], 'EPSG:4326', 'EPSG:3857')),
        }),
      ],
    }),
    style: new Style({
      fill: new Fill({ color: 'rgba(59,130,246,0.18)' }),
      stroke: new Stroke({ color: '#3b82f6', width: 2, lineDash: [8, 6] }),
    }),
  })

  const vectorGroup = new LayerGroup({ layers: [area, route, cities] })
  const baseGroup = new LayerGroup({ layers: [base] })

  map = createDemoMap(lib, el, { center: [116.2, 39.1], zoom: 7, base: 'none', layers: [baseGroup, vectorGroup] })

  nodes.value = [
    { id: 'base', label: '底图组', depth: 0, group: baseGroup, visible: true },
    { id: 'base-1', label: '浅色底图', depth: 1, layer: base, visible: true },
    { id: 'vec', label: '矢量数据组', depth: 0, group: vectorGroup, visible: true },
    { id: 'area', label: '规划范围（面）', depth: 1, layer: area, visible: true },
    { id: 'route', label: '城市连线（线）', depth: 1, layer: route, visible: true },
    { id: 'cities', label: '城市点位（点）', depth: 1, layer: cities, visible: true },
  ]

  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">图层树：LayerGroup 组织分组层级，父级显隐联动子图层，等价于常见的图层管理面板</p>
    <div class="rounded-lg border border-[#e6e8eb] bg-white p-2">
      <div
        v-for="node in nodes"
        :key="node.id"
        class="flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-[#f8fafc]"
        :style="{ paddingLeft: `${node.depth * 18 + 8}px` }"
      >
        <el-checkbox :model-value="node.visible" size="small" @change="toggleNode(node)" />
        <span :class="node.depth === 0 ? 'font-semibold text-[#334155]' : 'text-[#64748b]'">{{ node.label }}</span>
      </div>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
