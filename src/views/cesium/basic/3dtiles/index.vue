<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import TilesetPanel from './TilesetPanel.vue'

const HOME: [number, number, number] = [114.1694, 22.3193, 20000]

const intro: string[] = [
  '3D Tiles 是 OGC 的海量三维数据标准：一个 `tileset.json` 描述一棵空间树，根节点用 `boundingVolume` 圈定范围、`geometricError` 表示几何精度，子节点按 LOD 逐级细化，`content` 指向真正的瓦片（`b3dm`、`i3dm`、`pnts`、`cmpt`，或 3D Tiles 1.1 直接使用 `glTF/GLB`）。浏览器只按当前视距和屏幕空间误差（SSE）取需要的层级，所以城市级数据也能流畅浏览。',
  '倾斜摄影是 3D Tiles 最典型的来源：无人机多角度拍照 → 空三解算 → 密集匹配生成 OSGB/OBJ 稠密网格 → 转成 3D Tiles。它带真实纹理、整体观感接近实景，但本质是「一张带纹理的表面」，没有楼层、构件这类语义；要点击单体构件，需要提前做单体化（或在生产阶段写入 batch id / metadata）。本页默认地址就是「常见问题解决」中使用的香港倾斜模型（`defaultMeshTilesetUrl`）。',
  '坐标是第二道坎：3D Tiles 内部使用 ECEF（EPSG:4978），转换工具必须选对源坐标系——WGS84、CGCS2000（EPSG:4490）还是地方独立坐标，选错会整体偏移几十到几百米；`tileset.root.transform` 里就是这层定位矩阵。',
  '性能上主要调三个旋钮：`maximumScreenSpaceError`（越大越糊越省）、`maximumMemoryUsage`（显存上限）、`skipLevelOfDetail/preferLeaves`（跳过中间层、优先叶子节点）。调试时打开 `debugWireframe` 能直接看到 LOD 切分。',
]

const blocks: CodeBlock[] = [
  {
    title: '加载 tileset.json',
    desc: 'Cesium 1.107+ 用 fromUrl（异步工厂），不要再 new Cesium3DTileset()',
    code: `// 1) 创建 tileset（地址既可以同域，也可以跨域，需服务端允许 CORS）
const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
  maximumScreenSpaceError: 16, // 越小越清晰，显存/带宽开销越大
  skipLevelOfDetail: true,     // 大场景跳过中间层，加快首屏
  preferLeaves: true,          // 优先请求叶子节点
  maximumMemoryUsage: 1024,    // 显存上限（MB），按机器调整
})

// 2) 加入场景
viewer.scene.primitives.add(tileset)

// 3) 飞到数据范围（直接 zoomTo 容易贴脸，用包围球算距离）
viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
  duration: 1.4,
  offset: new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(35),
    Cesium.Math.toRadians(-32),
    tileset.boundingSphere.radius * 4,
  ),
})`,
  },
  {
    title: '显隐、线框与屏幕误差',
    desc: '调参时先看线框确认 LOD，再调 SSE 平衡清晰度和帧率',
    code: `tileset.show = true                 // 显隐
tileset.debugWireframe = true       // 线框：看 LOD 切分（上线前关掉）

// 运行中动态调精度
tileset.maximumScreenSpaceError = 32

// 移除要交给 primitives，tileset.destroy() 不要手动调
viewer.scene.primitives.remove(tileset)`,
  },
  {
    title: '点击拾取构件属性',
    desc: 'b3dm/i3dm 通过 batch table 携带属性；纯 glTF 内容没有批次表，只能整体高亮',
    code: `const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  if (!picked) return

  // 倾斜摄影 / BIM 常见：Cesium3DTileFeature
  if (picked instanceof Cesium.Cesium3DTileFeature) {
    picked.color = Cesium.Color.ORANGE // 高亮当前构件

    // 读取 batch table 里的属性
    const names = picked.getPropertyNames() // ['name', 'height', ...]
    const row = names.map((name) => [name, picked.getProperty(name)])
    console.table(row)
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`,
  },
  {
    title: '用样式按属性过滤构件',
    desc: 'Cesium3DTileStyle 可以按属性着色/显隐，做「只看某一层」很实用',
    code: `tileset.style = new Cesium.Cesium3DTileStyle({
  // 楼层高于 10 的构件标红，其余半透明
  color: {
    conditions: [
      ['\${floor} > 10', 'color("red")'],
      ['true', 'color("white", 0.35)'],
    ],
  },
  // 只显示 name 非空的构件
  show: '\${name} !== undefined',
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'b3dm 与 glTF 内容能力不同',
    body: '`b3dm`（Batched 3D Model）带 batch table，可以逐构件拾取属性、按属性着色；3D Tiles 1.1 直接使用 glTF 的 tileset 没有批次表，`scene.pick` 只能拿到整块模型，做不了「点某一户」。需要构件级交互时，让生产端输出带 batch id / metadata 的 3D Tiles。',
  },
  {
    title: '整体偏移先查坐标系与 root.transform',
    body: '倾斜模型偏移最常见的原因是转换时源坐标系选错（WGS84 / CGCS2000 / 地方坐标），其次才是 `root.transform`。排查时打印 `tileset.root.transform` 与 `tileset.boundingSphere.center`，把中心和已知地标对比，能快速定位是数据问题还是加载问题。',
  },
  {
    title: '本地调试必须走 HTTP',
    body: '`file://` 协议下瓦片 XHR 会被浏览器拦截；把 tileset 放到 `public/` 下用 dev server 访问，或起一个静态服务。另外 `tileset.json` 与瓦片目录的相对路径不能改，否则解析不到 content。',
  },
  {
    title: '首屏慢优先调 SSE 与内存',
    body: '首屏白屏久，先看网络面板是不是一次拉了太多层：调大 `maximumScreenSpaceError`、限制 `maximumMemoryUsage`、开启 `skipLevelOfDetail`。真机显存小的设备（集显/移动端）建议 SSE ≥ 24。',
  },
  {
    title: '倾斜摄影不能当测量底图',
    body: '倾斜模型是摄影测量表面，存在空洞、拉花和遮挡，高程精度也低于 DEM/点云。做量测、坡度、淹没分析要用地形或点云，倾斜模型只做可视化与属性挂接。',
  },
]
</script>

<template>
  <DemoPage
    hint="3D Tiles 加载：默认加载香港倾斜摄影（tileset.json），可切换显隐/线框、调整屏幕误差，并点击构件读取 batch table 属性。"
    :home="HOME"
  >
    <template #panel>
      <TilesetPanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="3D Tiles 与倾斜摄影"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="3D Tiles 的问题集中在「内容类型、坐标系、性能」三处，下面按排查顺序列出。"
      />
    </template>
  </DemoPage>
</template>
