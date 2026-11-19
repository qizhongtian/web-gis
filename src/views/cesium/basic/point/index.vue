<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import GeoLayerPanel from '../GeoLayerPanel.vue'

const HOME: [number, number, number] = [114.266, 22.315, 12000]

const intro: string[] = [
  'GeoJSON 是 RFC 7946 定义的矢量数据交换格式：`FeatureCollection` 里装 `Feature`，每个 Feature 由 `geometry` 与 `properties` 组成。点用 `Point`（单个坐标）或 `MultiPoint`（坐标数组）表示，坐标顺序固定是 `[经度, 纬度]`，可选的第三位是高程——注意是经度在前，和很多 GIS 桌面软件「先纬后经」的显示习惯相反，写错会整体跑偏。',
  'Cesium 用 `GeoJsonDataSource` 把 GeoJSON 解析成实体：每个 Feature 变成一个 `Entity`，`Point` 会生成 `point`（默认用 `billboard` 图标），属性表挂到 `entity.properties`。因此样式既可以在 `load` 时统一给（`markerSize/markerColor`），也可以加载后逐个实体改。',
  '「贴地」是点数据最常见的需求：`clampToGround: true` 会让点跟着地形/倾斜模型表面走（内部用 GroundPrimitive，把几何投影到场景表面），代价是每个点都要做深度/投影计算，数量大时开销明显。纯位置点（不贴地）用 `heightReference: NONE` + 高程值，性能更好。',
  '当点超过一万级，不要继续用 Entity：改用 `PointPrimitiveCollection`/`BillboardCollection`（共享一个 Primitive，顶点级批量绘制），或开启 `EntityCluster` 聚合，否则属性系统与拾取遍历会成为瓶颈。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载点数据并统一设置样式',
    desc: 'GeoJsonDataSource 会自动识别几何类型，点默认渲染成 marker 图标',
    code: `const ds = await Cesium.GeoJsonDataSource.load('/data/geojson/ProjectPoint.json', {
  markerColor: Cesium.Color.fromCssColorString('#2563eb'),
  markerSize: 32,                 // 图标像素尺寸
  clampToGround: true,            // 贴地形/模型表面
  // 也可以直接给 point 样式（不贴地时更常用）
  // point: { pixelSize: 8, color: Cesium.Color.ORANGE },
})

viewer.dataSources.add(ds)

// 加载后逐要素微调：点 + 标签
ds.entities.values.forEach((entity) => {
  if (!entity.position) return
  entity.point = new Cesium.PointGraphics({
    pixelSize: 10,
    color: Cesium.Color.ORANGE,
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 1,
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY, // 不被地形/模型遮挡
  })
  entity.label = new Cesium.LabelGraphics({
    text: entity.properties?.Name?.getValue() ?? '点',
    pixelOffset: new Cesium.Cartesian2(0, -18),
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  })
})`,
  },
  {
    title: '点击拾取点的属性',
    desc: 'properties 是 PropertyBag，取值要调用 getValue(JulianDate)',
    code: `const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  const entity = picked?.id
  if (!entity?.properties) return

  // PropertyBag → 普通对象
  const names = entity.properties.propertyNames
  const row = Object.fromEntries(
    names.map((name) => [name, entity.properties[name].getValue(Cesium.JulianDate.now())]),
  )
  console.log('点击的点属性', row)
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`,
  },
  {
    title: '大量点：PointPrimitiveCollection',
    desc: '上万点时用批量 Primitive，绕过 Entity 的属性系统，渲染与拾取都更快',
    code: `const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())

for (const feature of geojson.features) {
  const [lon, lat] = feature.geometry.coordinates
  points.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    pixelSize: 6,
    color: Cesium.Color.fromCssColorString('#2563eb'),
    // 用 id 关联原始属性，拾取时反查
    id: feature.properties,
  })
}

// 拾取：picked.primitive 就是 PointPrimitive，picked.id 是上面塞的属性
const picked = viewer.scene.pick(movement.position)
console.log(picked?.id)`,
  },
]

const notes: NoteItem[] = [
  {
    title: '坐标顺序与非法高程',
    body: 'GeoJSON 是 `[经度, 纬度, 高程?]`，写成 `[纬度, 经度]` 会把点甩到海里。另外不少导出工具会写 `-1.7976931348623157e+308` 这类「无效值」当高程，加载前要清洗成 0 或删除，否则点会飞到椭球外。',
  },
  {
    title: 'clampToGround 有渲染成本',
    body: '贴地会把几何投影到地形/模型表面（GroundPrimitive），点数多时每帧的投影与深度计算很贵。几万点建议关掉贴地、用绝对高度，或按视距抽稀、分块加载。',
  },
  {
    title: 'Entity 不是万能的',
    body: 'Entity 每个都带属性系统与事件监听，几千个就会开始掉帧。大数据量用 `PointPrimitiveCollection`/`BillboardCollection`，需要聚合时用 `EntityCluster`，需要 LOD 时考虑 3D Tiles 点云。',
  },
  {
    title: '图标点与几何点的区别',
    body: '`GeoJsonDataSource` 默认用 `billboard` 图标渲染点，改 `markerSize` 只影响图标像素；想要「圆点/自定义几何」要显式覆盖 `entity.point`，或直接用 `PointPrimitiveCollection`。',
  },
  {
    title: 'disableDepthTestDistance 要慎用',
    body: '它能让点不被地形/建筑遮挡，但会让点「浮在所有东西上面」，破坏前后关系。只对重点标注开启，不要全局设置。',
  },
]
</script>

<template>
  <DemoPage
    hint="点图层：加载 GeoJSON Point（默认 ProjectPoint.json），可调点大小、颜色与贴地，点击要素读取 properties。"
    :home="HOME"
  >
    <template #panel>
      <GeoLayerPanel geometry="Point" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="GeoJSON 点图层"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="点数据的坑集中在坐标顺序、贴地开销和数量级，下面按排查顺序说明。"
      />
    </template>
  </DemoPage>
</template>
