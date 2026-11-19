<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import TerrainPanel from './TerrainPanel.vue'

/** 默认视角：港岛北岸，斜视能同时看到维港与半山地形 */
const HOME: [number, number, number] = [114.1605, 22.2865, 12000]

const intro: string[] = [
  '地形（Terrain）是地球表面的高程数据。摄影测量里的 DSM 含建筑、植被等真实表面，DTM 只保留裸露地面，工程上常说的「地形」多指 DTM；Cesium 把高程组织成瓦片，按视距分级加载，所以关掉地形时地球是一个光滑椭球，开启后才有山体、河谷和坡面。',
  'Cesium 支持两类地形服务：`CesiumTerrainProvider` 读取自建的 quantized-mesh 切片（`layer.json` + 压缩网格，含法线、水面掩膜，适合离线/内网、海量数据），`ArcGISTiledElevationTerrainProvider` 读取 ArcGIS ImageServer 的全球高程（免密钥，按需采样，适合快速出效果）。本页默认用后者，与「常见问题解决」里的地形示例是同一个地址。',
  '地形不只是「好看」：相机贴地漫游、`sampleTerrainMostDetailed` 采样高程、贴地图元随坡面起伏、通视分析都依赖它。垂直夸张（`verticalExaggeration`）只放大渲染起伏，不会改变采样出来的真实高程；高程基准是 EGM96 大地水准面，与 WGS84 椭球高之间存在差值，跨系统对接时要换算。',
]

const blocks: CodeBlock[] = [
  {
    title: '按地址选择地形 provider',
    desc: 'ArcGIS ImageServer 与 quantized-mesh 是两套协议，用错会用 CesiumTerrainProvider 去请求 layer.json 直接 404',
    code: `// 统一入口：按 URL 特征选择 provider（项目里已封装为 createTerrainProvider）
async function createTerrainProvider(Cesium, url) {
  const target = url.trim()

  // ArcGIS World Elevation 3D（ImageServer）
  if (/arcgis\\.com|ImageServer|elevation3d/i.test(target)) {
    return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(target)
  }

  // 自建 quantized-mesh 地形（目录下必须有 layer.json）
  return Cesium.CesiumTerrainProvider.fromUrl(target, {
    requestVertexNormals: true, // 要光照/法线就开，瓦片体积略大
  })
}

const provider = await createTerrainProvider(Cesium, url)
viewer.terrainProvider = provider`,
  },
  {
    title: '挂到 Viewer 上并做垂直夸张',
    desc: '地形替换是异步的，失败要回退椭球，否则整个场景会白屏',
    code: `try {
  viewer.terrainProvider = await createTerrainProvider(Cesium, url)
} catch (e) {
  // 回退：没有地形也比白屏好
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
  console.warn('地形加载失败，已回退椭球', e)
}

// 垂直夸张：只影响渲染（1.116 起统一用 scene.verticalExaggeration）
viewer.scene.verticalExaggeration = 2.5

// 让贴地图元参与深度检测（点/线不再穿透山体）
viewer.scene.globe.depthTestAgainstTerrain = true`,
  },
  {
    title: '按需采样地形高程',
    desc: 'sampleTerrainMostDetailed 会自动定位到最精细层级，适合少量点位；批量点位要分批',
    code: `// 屏幕中心落点 = 相机所在经纬度投影到地面
const carto = viewer.camera.positionCartographic

const [result] = await Cesium.sampleTerrainMostDetailed(
  viewer.terrainProvider,
  [new Cesium.Cartographic(carto.longitude, carto.latitude)],
)

console.log('该点地面高程', result.height.toFixed(2), 'm')

// 批量：一次传入多个 Cartographic，服务端会按瓦片批量请求
// 注意：点位过密时先抽稀，或按瓦片分组，避免一次请求上万点`,
  },
  {
    title: '贴地实体怎么跟随地形',
    desc: '点/线/面用 heightReference，标签用 CLAMP_TO_GROUND；贴地图元不要写 height',
    code: `viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(114.16, 22.28),
  point: {
    pixelSize: 10,
    color: Cesium.Color.ORANGE,
    // 关键：高度跟随地形，而不是固定 0
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  label: {
    text: '贴地标注',
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  },
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'quantized-mesh 必须能访问 layer.json',
    body: '自建地形常见问题是目录结构不对：URL 指向的目录下要有 `layer.json` 与各级瓦片，且服务端允许跨域（CORS）。只放瓦片文件、没有 `layer.json`，`CesiumTerrainProvider` 会直接失败。',
  },
  {
    title: '地形和倾斜摄影不是同一张表面',
    body: '倾斜模型是「建筑与地表」的三角网，地形是 DEM。开启地形后，贴地标注可能仍被倾斜模型挡住：这是两套表面。需要贴到模型表面时把 `classificationType` 设为 `BOTH`，或直接把标注抬到模型高度之上。',
  },
  {
    title: '垂直夸张会误导高度判断',
    body: '`verticalExaggeration` 只放大渲染，`sampleTerrainMostDetailed` 返回的仍是真实高程。做量测、坡度、淹没分析时不要开夸张，否则人眼看到的地形和数字对不上。',
  },
  {
    title: '采样是异步且依赖 provider',
    body: '`sampleTerrainMostDetailed` 对 `EllipsoidTerrainProvider` 无效，必须先开启地形；一次传入大量点位会拆成很多瓦片请求，建议先按视距抽稀，或按瓦片分组串行采样。',
  },
  {
    title: '地形地址可以直接复用 FAQ 的配置',
    body: '本项目把默认地形地址收敛到 `defaultTerrainServiceUrl`（`VITE_HK_TERRAIN_URL || globalTerrainUrl`），「常见问题解决」里的贴地、高程采样页面用的也是它，换区域只改这一处。',
  },
]
</script>

<template>
  <DemoPage
    hint="地形加载：开启全球高程（ArcGIS ImageServer，免 Token）或填自建 quantized-mesh 地址，观察地表起伏、垂直夸张与按需采样高程。"
    :home="HOME"
  >
    <template #panel>
      <TerrainPanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="地形（Terrain）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="下面是地形接入最容易踩的几处：provider 选型、失败回退、夸张与采样、贴地冲突。"
      />
    </template>
  </DemoPage>
</template>
