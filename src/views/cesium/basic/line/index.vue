<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import GeoLayerPanel from '../GeoLayerPanel.vue'

const HOME: [number, number, number] = [113.995, 22.43, 12000]

const intro: string[] = [
  '线用 `LineString`（一组有序坐标）或 `MultiLineString`（多组）表示，GeoJSON 只描述几何，线宽、颜色、材质都要在 Cesium 里设置。Cesium 的 `polyline` 走 WebGL 线绘制，很多平台对线宽支持有限（通常只能画 1px 实线），需要更宽的线时用 `PolylineGlowMaterial`/`PolylineOutlineMaterial` 或改用 Primitive 的 `PolylineGeometry`（有真实宽度）。',
  '贴地的线（`clampToGround: true`）会沿地形起伏，Cesium 会对折线做细分（默认 `clampToGround` 的 granularity 约 1 度），节点越密越贴合，但顶点数也越多；一条几千点的道路贴地后可能变成几万个顶点，这是线数据最常见的性能来源。',
  '线的交互通常是「点击查属性」：GeoJsonDataSource 会把 Feature 的 properties 挂到实体上，`scene.pick` 拿到 Entity 后读 `properties` 即可。线宽/材质变化用 `entity.polyline.material`、`entity.polyline.width` 修改，不需要重新加载数据。',
  '数据量大时（上万条线、几十万顶点），改用 `PolylineCollection` 或把线预处理成 3D Tiles；不要用 Entity 一条条加，Entity 的属性系统会成为主要开销。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载线数据并设置样式',
    desc: '线默认 1px 左右，宽度与颜色在 load 或实体上设置',
    code: `const ds = await Cesium.GeoJsonDataSource.load('/data/geojson/Site_Boundary_line.json', {
  stroke: Cesium.Color.fromCssColorString('#f97316'),
  strokeWidth: 5,          // 注意：部分平台会被 WebGL 限制为 1px
  clampToGround: true,     // 沿线贴地形
})

viewer.dataSources.add(ds)

// 逐条改材质：发光让线在影像上更醒目
ds.entities.values.forEach((entity) => {
  if (!entity.polyline) return
  entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
    glowPower: 0.2,
    color: Cesium.Color.ORANGE,
  })
  entity.polyline.width = 6
})`,
  },
  {
    title: '虚线 / 流动线材质',
    desc: 'PolylineDashMaterialProperty 适合轨迹、管线；流动效果用 CallbackProperty 改 dashOffset',
    code: `// 静态虚线
entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
  color: Cesium.Color.CYAN,
  dashLength: 16,
})

// 流动虚线：每帧推进 dashOffset
entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
  color: Cesium.Color.CYAN,
  dashLength: 24,
  dashOffset: new Cesium.CallbackProperty(() => {
    return (performance.now() / 30) % 24
  }, false),
})`,
  },
  {
    title: '点击拾取线的属性',
    desc: '线与点一样，属性挂在 entity.properties 上',
    code: `const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  const entity = picked?.id
  if (!entity?.properties) return

  // 例如道路名称、编号、长度等字段
  const name = entity.properties.NAME_ENG?.getValue(Cesium.JulianDate.now())
  const length = entity.properties.Shape_Leng?.getValue(Cesium.JulianDate.now())
  console.log('点击的线', name, length)
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`,
  },
  {
    title: '大量线：PolylineCollection',
    desc: '一次绘制上万条线，比 Entity 快一个量级',
    code: `const lines = viewer.scene.primitives.add(new Cesium.PolylineCollection())

for (const feature of geojson.features) {
  const positions = feature.geometry.coordinates.map(([lon, lat]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat),
  )
  lines.add({
    positions,
    width: 2,
    material: Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#f97316'),
    }),
    id: feature.properties,
  })
}

// 拾取：picked.primitive 是 Polyline，picked.id 是原始属性`,
  },
]

const notes: NoteItem[] = [
  {
    title: '线宽在 WebGL 下不可靠',
    body: '很多浏览器只支持 1px 线宽，`strokeWidth: 5` 可能看不出变化。需要真实宽度时用 `PolylineGeometry`（Primitive）或 `PolylineGlowMaterial` 的发光宽度模拟，不要指望 `lineWidth` 生效。',
  },
  {
    title: '贴地线会大量增加顶点',
    body: '`clampToGround` 会按地形细分折线，几千点的道路可能变成几万顶点；长线建议先按视距抽稀，或分段加载，避免一次性贴地。',
  },
  {
    title: '坐标顺序与重复点',
    body: '同样是 `[经度, 纬度]`。重复坐标、零长度线段会让 Cesium 报 `positions` 顶点不足或渲染异常，加载前要过滤重复点（连续两点距离为 0）。',
  },
  {
    title: '线的高程与地形冲突',
    body: '贴地线与地形同面时容易出现 z-fighting（闪烁），可以通过 `polyline.clampToGround` 配合 `scene.globe.depthTestAgainstTerrain` 调整，或改用带高度的折线。',
  },
  {
    title: '海量线优先考虑 3D Tiles',
    body: '线数量到十万级时，无论 Entity 还是 PolylineCollection 都会吃力；把线预处理成 3D Tiles（或矢量瓦片 + 按需渲染）更稳。',
  },
]
</script>

<template>
  <DemoPage
    hint="线图层：加载 GeoJSON LineString（默认 Site_Boundary_line.json），可调线宽/颜色/贴地，点击线读取 properties。"
    :home="HOME"
  >
    <template #panel>
      <GeoLayerPanel geometry="LineString" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="GeoJSON 线图层"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="线的坑集中在宽度限制、贴地顶点膨胀与数量级，下面按排查顺序说明。"
      />
    </template>
  </DemoPage>
</template>
