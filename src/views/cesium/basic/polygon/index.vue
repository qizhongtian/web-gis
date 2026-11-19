<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import GeoLayerPanel from '../GeoLayerPanel.vue'

const HOME: [number, number, number] = [114.095, 22.511, 5000]

const intro: string[] = [
  '面用 `Polygon`（一个或多个环）或 `MultiPolygon`（多个多边形）表示：坐标是「环的数组」，第一个环是外环，后面的环是内环（洞）。RFC 7946 要求外环逆时针、内环顺时针（右手法则），虽然 Cesium 多数情况能自动纠正，但自己生成数据时最好遵守，否则导入其他 GIS 软件可能出问题。',
  'Cesium 里的面有三种常见形态：普通多边形（固定高度/按顶点高程 `perPositionHeight`）、贴地面（`heightReference: CLAMP_TO_GROUND`，内部走 GroundPrimitive 投影到地形/模型表面）、拉伸面（`extrudedHeight`，从底面拉到顶面，做建筑体块、蓄水池、规划范围体积最常用）。贴地与拉伸互斥：开了贴地就不能再拉伸。',
  '面的样式包括填充（`material`，可用颜色、条纹、图片）、描边（`outline/outlineColor/outlineWidth`）。注意贴地面使用 GroundPrimitive，`outline` 在部分平台不渲染或会被地形裁剪，需要描边时通常改用贴地的 `polyline` 沿外环单独画一圈。',
  '面积与周长要用测地线计算：Cesium 的 `EllipsoidGeodesic` 可以算椭球面上的边长；面积推荐用 turf.js 的 `area()`（WGS84 椭球近似，单位平方米），不要用平面 shoelace 直接算经纬度——低纬度误差可达百分之几。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载面数据并设置填充/描边',
    desc: 'GeoJsonDataSource 会把 Polygon 转成 entity.polygon，洞（内环）自动保留',
    code: `const ds = await Cesium.GeoJsonDataSource.load('/data/geojson/polygon.json', {
  fill: Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.3),
  stroke: Cesium.Color.fromCssColorString('#16a34a'),
  strokeWidth: 4,
  clampToGround: true, // 贴地形/模型表面
})

viewer.dataSources.add(ds)

// 逐个改材质：例如条纹填充
ds.entities.values.forEach((entity) => {
  if (!entity.polygon) return
  entity.polygon.material = new Cesium.StripeMaterialProperty({
    evenColor: Cesium.Color.ORANGE.withAlpha(0.5),
    oddColor: Cesium.Color.WHITE.withAlpha(0.2),
    repeat: 8,
  })
})`,
  },
  {
    title: '拉伸面：做建筑体块',
    desc: 'extrudedHeight 从底面拉到顶面，单位米；此时要关掉贴地',
    code: `viewer.entities.add({
  polygon: {
    hierarchy: Cesium.Cartesian3.fromDegreesArray([
      114.094, 22.510,
      114.096, 22.510,
      114.096, 22.512,
      114.094, 22.512,
    ]),
    height: 0,          // 底面高度
    extrudedHeight: 120, // 顶面高度（米）
    material: Cesium.Color.ORANGE.withAlpha(0.65),
    outline: true,
    outlineColor: Cesium.Color.WHITE,
    // 关键：拉伸与贴地互斥
    heightReference: Cesium.HeightReference.NONE,
  },
})`,
  },
  {
    title: '按顶点高程贴合起伏地面',
    desc: 'perPositionHeight 让每个顶点用自己的高程，适合山坡上的面',
    code: `const positions = Cesium.Cartesian3.fromDegreesArrayHeights([
  114.094, 22.510, 12.5,
  114.096, 22.510, 18.2,
  114.096, 22.512, 26.8,
  114.094, 22.512, 20.1,
])

viewer.entities.add({
  polygon: {
    hierarchy: positions,
    perPositionHeight: true, // 用顶点自带高程，不再取统一 height
    material: Cesium.Color.CYAN.withAlpha(0.5),
  },
})`,
  },
  {
    title: '点击拾取与面积/周长',
    desc: '面积用 turf.js（WGS84 椭球），周长用 EllipsoidGeodesic，避免平面近似误差',
    code: `import area from '@turf/area'

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  const entity = picked?.id
  if (!entity?.polygon) return

  const name = entity.properties?.Layer?.getValue(Cesium.JulianDate.now())
  console.log('点击的面', name)

  // 面积（m²）：由 entity 的 hierarchy 还原成 GeoJSON 后计算
  const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now())
  const ring = hierarchy.positions.map((p) => {
    const c = Cesium.Cartographic.fromCartesian(p)
    return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)]
  })
  console.log('面积', area({ type: 'Polygon', coordinates: [ring] }) / 10000, '公顷')
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`,
  },
]

const notes: NoteItem[] = [
  {
    title: '贴地与拉伸不能同时开',
    body: '`heightReference: CLAMP_TO_GROUND` 与 `extrudedHeight` 语义冲突，同时设置会渲染异常。做建筑体块时用 `height: 0 + extrudedHeight`，需要贴合地形就先采样地形高程作为底面高度。',
  },
  {
    title: '贴地面的描边可能不显示',
    body: '贴地面走 GroundPrimitive，`outline` 支持有限（部分平台不渲染或被地形裁剪）。需要描边时沿外环单独加一条贴地 `polyline`，或把面抬高 0.1 米避免与地形 z-fighting。',
  },
  {
    title: '环的方向与洞',
    body: '第一个环是外环，后续环是洞；外环逆时针、内环顺时针。方向反了在部分 Cesium 版本里会被自动纠正，但导入 QGIS/ArcGIS 可能丢洞，生成数据时按 RFC 7946 处理。',
  },
  {
    title: '面积别用平面公式算经纬度',
    body: '经纬度不是等距坐标，直接 shoelace 求面积在高纬度误差很大。用 turf.js 的 `area()`（椭球）或先投影到等积投影再算，结果单位是平方米。',
  },
  {
    title: '面量大时用 Primitive 或 3D Tiles',
    body: '几千个面用 Entity 会明显掉帧，尤其贴地面。可以改用 `Primitive` + `PolygonGeometry`（可开启 `vertexFormat` 减少属性），或把静态面预处理成 3D Tiles 做 LOD。',
  },
]
</script>

<template>
  <DemoPage
    hint="面图层：加载 GeoJSON Polygon（默认 polygon.json），可调填充/描边、贴地与拉伸高度，点击要素读取 properties。"
    :home="HOME"
  >
    <template #panel>
      <GeoLayerPanel geometry="Polygon" />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="GeoJSON 面图层"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="面的坑集中在贴地与拉伸、环方向、面积计算，下面按使用顺序说明。"
      />
    </template>
  </DemoPage>
</template>
