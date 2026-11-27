<script setup lang="ts">
import type { Viewer } from 'cesium'
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel, { type NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { HK_POINT_CLAMP_HOME } from '@/utils/gis/cesiumConfig'
import PointSurfacePanel from './PointSurfacePanel.vue'
import type { Cesium } from './surface'
function viewerOptions(C: Cesium): Viewer.ConstructorOptions {
  // 用 Cesium 本地生成的格网观察起伏，不请求在线地图瓦片。
  return {
    baseLayer: new C.ImageryLayer(new C.GridImageryProvider({
      cells: 8, color: C.Color.fromCssColorString('#e1efe8').withAlpha(0.25),
      glowWidth: 0, backgroundColor: C.Color.fromCssColorString('#789a91'),
    })),
    skyBox: false,
    skyAtmosphere: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  }
}

const blocks: CodeBlock[] = [
  {
    title: '批量画点，缩放由 Cesium 计算',
    desc: '集合必须传 scene 才支持 HeightReference；针尖用 BOTTOM 锚定。',
    code: `const icons = scene.primitives.add(new C.BillboardCollection({ scene }))
const scaleByDistance = new C.NearFarScalar(160, 1.65, 16000, 0.42)
const owner = Symbol('demo-point')
points.forEach(({ lon, lat }, index) => icons.add({
  id: { owner, index },
  position: C.Cartesian3.fromDegrees(lon, lat, 0),
  image: pin, width: 21, height: 28,
  scaleByDistance,
  verticalOrigin: C.VerticalOrigin.BOTTOM,
  heightReference: reference,
}))`,
  },
  {
    title: '点选只修改前后两条',
    desc: '从 pick 返回的 id 找回下标；保留深度遮挡，不穿建筑选点。',
    code: `const id = scene.pick(position)?.id
const hit = id?.owner === owner ? id.index : undefined
const next = hit === selected ? undefined : hit
if (selected !== undefined) {
  icons.get(selected).image = pin
  icons.get(selected).scale = 1
}
selected = next
if (selected !== undefined) {
  icons.get(selected).image = highlightedPin
  icons.get(selected).scale = 1.55 // 与距离缩放相乘
}
scene.requestRender()`,
  },
  {
    title: '单一表面：按场景选择 HeightReference',
    desc: '点数不多且只开启一种表面时，直接使用对应的自动贴附枚举。',
    code: `const { HeightReference: H } = C
const reference = terrainReady ? H.CLAMP_TO_TERRAIN
  : tilesReady ? H.CLAMP_TO_3D_TILE : H.NONE
const tileset = await C.Cesium3DTileset.fromUrl(url, { enableCollision: true })
scene.primitives.add(tileset)`,
  },
  {
    title: '海量点 / 双源：分批采高，渲染使用绝对高度',
    desc: '批量采地形，再与已加载网格取较高值。写入位置后使用 NONE，不随镜头反复采样。',
    code: `// 超过 1000 点或双源同时开启，每批 200 点，批间让出一帧。
const terrainSamples = provider.availability
  ? await C.sampleTerrainMostDetailed(provider, cartographics)
  : await C.sampleTerrain(provider, 15, cartographics)
// 没有地形时跳过上面的批量采样。
const terrainHeight = terrainSamples[i]?.height
const tileHeight = tileset?.getHeight(cartographics[i], scene)
const heights = [terrainHeight, tileHeight].filter(Number.isFinite)
const height = heights.length ? Math.max(...heights) + 0.25 : 0
billboard.heightReference = C.HeightReference.NONE
billboard.position = C.Cartesian3.fromDegrees(point.lon, point.lat, height)`,
  },
]
const notes: NoteItem[] = [
  { title: '建筑顶部与地形不是同一个高度', body: '只贴倾斜时使用 `CLAMP_TO_3D_TILE`，覆盖区外不保证命中；想让模型之外也贴地，请同时开启地形。点位没有高程时，无法仅凭经纬度区分屋顶、地面或楼层。' },
  { title: '加载清单不等于网格已经可查询', body: '`getHeight` 仅查询已加载的 3D Tiles 网格，不适用于点云；等当前视野瓦片加载后再取值。平移到新区域或瓦片细化后，可点「重新取值」。' },
  { title: '双源不要依赖最后一次贴附回调', body: '地形和模型的加载时机不同，后到的回调可能覆盖前面的贴附结果。本例双源时分批取较高值；单源且 1000 点以内用自动贴附。已有绝对高程就设 `NONE`。1000 是演示阈值，实际项目需按设备和场景测量。' },
  { title: '与「点位贴地(无高程)」共用默认场景', body: '默认地形与倾斜摄影分别使用 `defaultTerrainServiceUrl` 和 `defaultMeshTilesetUrl`。可在面板中修改服务地址并点击「应用地址」，请使用有权访问且允许跨域的资源。' },
]
</script>

<template>
  <div class="surface-page">
    <section class="scene-column" aria-label="海量点位场景">
      <p class="scene-hint">默认从中国香港全景查看点位分布。点击「近看基准点」比较图标在地形与 3D Tiles 上的贴附效果，滚轮可调整观察距离。</p>
      <CesiumViewer class="surface-viewer" :options="viewerOptions" :home="HK_POINT_CLAMP_HOME" :status-bar="false">
        <PointSurfacePanel />
      </CesiumViewer>
    </section>
    <GuidePanel class="surface-guide" title="实现要点" guide-label="关键代码" blocks-title="关键代码" :blocks="blocks" :notes="notes" />
  </div>
</template>

<style scoped>
.surface-page { display: grid; grid-template-columns: minmax(0, 1fr) minmax(292px, 34%); gap: 9px; padding: 9px; height: 100%; min-height: 0; overflow: auto; }
.scene-column { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; }
.scene-hint { margin: 0; padding: 7px 10px; border: 1px solid #dbeafe; border-radius: 7px; background: #eff6ff; color: #214c87; font-size: 12px; line-height: 1.5; }
.surface-viewer { flex: 1; min-height: 0; border-radius: 9px; overflow: hidden; border: 1px solid #d9e3ed; }
.surface-guide { min-width: 0; min-height: 0; }
@media (max-width: 1000px) {
  .surface-page { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(480px, 1fr) 370px; }
}
</style>
