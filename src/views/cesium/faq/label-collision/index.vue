<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import LabelCollisionPanel from './LabelCollisionPanel.vue'

/** 默认视角：香港全景（点位铺满各区，最容易看出压字） */
const HOME: [number, number, number] = [114.17, 22.33, 24000]

const blocks: CodeBlock[] = [
  {
    title: '为什么不能直接开 label',
    desc: 'label 默认都在，Cesium 不做文字避让；点一多就是互相压字，视觉上等于没有信息',
    code: `// 常见写法：每个点一个 label，全部 show
labels.add({ position, text: p.name, font: FONT })

// 5000 个点全港视角下，屏幕上真正能读清的不到 1/10，
// 剩下的全叠在一起；旋转视角时叠的顺序还会变，
// 出现“字在闪”的观感

// 结论：label 必须自己算“谁该显示、显示在哪”`,
  },
  {
    title: '先量出真实文字宽度（长短不一才排得准）',
    desc: '不要用字符数估算宽度，中文 / 英文 / 数字混排误差很大；canvas.measureText 一次量好并缓存',
    code: `const FONT = '600 13px "Microsoft YaHei", sans-serif'

const ctx = document.createElement('canvas').getContext('2d')
ctx.font = FONT

const widthCache = new Map()
function measure(text) {
  let w = widthCache.get(text)
  if (w === undefined) {
    // +16：背景 padding 与描边，宁可算宽一点，也别贴太紧
    w = Math.ceil(ctx.measureText(text).width) + 16
    widthCache.set(text, w)
  }
  return w
}

// 注意：canvas 的 font 必须和 label 的 font 完全一致，
// 少一个 600 或换一种字体，量出来的宽度就偏了`,
  },
  {
    title: '投影到屏幕，得到像素矩形',
    desc: 'label 是屏幕空间的东西，必须在屏幕坐标里做碰撞；相机背后、视口外的点先剔除',
    code: `const sp = C.SceneTransforms.wgs84ToWindowCoordinates(
  scene, it.position, scratch,
)
if (!sp) {            // 相机背后
  it.label.show = false
  continue
}
// 视口裁剪：这一步很关键，远处的点不用参与碰撞
if (sp.x < -it.width || sp.x > W + it.width ||
    sp.y < -H || sp.y > H + it.height) {
  it.label.show = false
  continue
}

// label 是 CENTER / CENTER，矩形 = 屏幕点 + 像素偏移
const x0 = sp.x + dx - it.width / 2
const y0 = sp.y + dy - it.height / 2`,
  },
  {
    title: '网格加速的矩形碰撞：O(n)，不是 O(n²)',
    desc: '两两比较 5000 点是 1250 万次；按 32px 网格分桶后每个矩形只测自己覆盖的几个格子',
    code: `const CELL = 32
const grid = new Map()   // 格子 key -> 已放置矩形下标
const rects = []         // [x0, y0, x1, y1, ...]

function collides(x0, y0, x1, y1) {
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
      const bucket = grid.get(cx * 8192 + cy)
      if (!bucket) continue
      for (const idx of bucket) {
        if (x0 < rects[idx * 4 + 2] && x1 > rects[idx * 4] &&
            y0 < rects[idx * 4 + 3] && y1 > rects[idx * 4 + 1]) return true
      }
    }
  }
  return false
}
// 放下时再把矩形写进它覆盖的所有格子`,
  },
  {
    title: '候选位置 + 优先级，显示率能翻倍',
    desc: '只往上放，稍微密一点就全被挤掉；给上/下/左/右四个位置，再把重要的先放，显示率明显提升',
    code: `// 1) 排序：重点点位优先，其次离相机近的
items.sort((a, b) =>
  b.priority - a.priority || a.dist - b.dist)

// 2) 依次试 4 个位置，第一个不撞的就用
const cands = [
  [0, -(h / 2 + 12)],   // 上
  [0, +(h / 2 + 12)],   // 下
  [-(w / 2 + 12), 0],   // 左
  [+(w / 2 + 12), 0],   // 右
]
for (const [dx, dy] of cands) {
  if (collides(...)) continue
  occupy(...)
  label.pixelOffset = new C.Cartesian2(dx, dy)
  break
}

// 3) 四个都撞 → label.show = false（隐藏，而不是叠着画）`,
  },
  {
    title: '什么时候重排：camera.changed + 节流',
    desc: '每帧重排 5000 个点没必要；相机变化时按间隔算一次，停稳再补一次，拖动时也不掉帧',
    code: `viewer.camera.percentageChanged = 0.01
const LAYOUT_INTERVAL = 80

let raf = 0
let last = 0
function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const now = performance.now()
    if (now - last < LAYOUT_INTERVAL) return   // 节流
    last = now
    layout()                                   // 200~5000 点都够用
  })
}

viewer.camera.changed.addEventListener(schedule)
viewer.camera.moveEnd.addEventListener(() => layout())`,
  },
  {
    title: '渲染层：LabelCollection 而不是 Entity',
    desc: '上万 Entity 每帧都要遍历数据源 + 更新 Property；LabelCollection 是批渲染，隐藏只是跳过一条实例',
    code: `// 好：一次 add，之后只改 show / pixelOffset
const labels = new C.LabelCollection()
viewer.scene.primitives.add(labels)
const label = labels.add({
  position, text: p.name, font: FONT,
  horizontalOrigin: C.HorizontalOrigin.CENTER,
  verticalOrigin: C.VerticalOrigin.CENTER,
  showBackground: true,
})
label.show = false        // 碰撞判定结果

// 点同样用 PointPrimitiveCollection，5000 点一次绘制
const dots = new C.PointPrimitiveCollection()

// 差：viewer.entities.add({ label, billboard })
// 每个 Entity 都是 PropertyBag + 每个点一次数据源更新`,
  },
  {
    title: '点位图标用图片 + label 黄字黑描边',
    desc: '图标走 BillboardCollection（批量绘制，5000 个图标也只是一个 draw call）；配色用 FILL_AND_OUTLINE，黑描边代替白底块，不挡地图',
    code: `billboards.add({
  position,
  image: p.pin,             // public/image 里随机取一张
  width: p.size,
  height: p.size,
  verticalOrigin: C.VerticalOrigin.BOTTOM,   // 针尖落在点位上
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
})

labels.add({
  text: p.name,
  font: FONT,
  fillColor: C.Color.fromCssColorString('#FFD400'),    // 黄字
  outlineColor: C.Color.fromCssColorString('#000000'), // 黑描边
  outlineWidth: 4,
  style: C.LabelStyle.FILL_AND_OUTLINE,
  showBackground: false,     // 用描边代替背景块
  pixelOffset: new C.Cartesian2(0, -(p.size + 15)),
})

// 量宽度时记得把描边算进去，否则避让会贴太紧
const width = Math.ceil(ctx.measureText(text).width) + 10`,
  },
  {
    title: '背景地形 / 倾斜摄影：面板输入框直接加载',
    desc: '地址写进输入框，回车或失焦即重载；关掉开关要把 tileset 移出场景、地形还原成椭球，否则切页面会残留',
    code: `// 倾斜摄影
const ts = await C.Cesium3DTileset.fromUrl(url, {
  maximumScreenSpaceError: 16,
})
viewer.scene.primitives.add(ts)

// 地形（quantized-mesh 用 CesiumTerrainProvider；ArcGIS ImageServer 用 ArcGISTiledElevationTerrainProvider）
const provider = await C.CesiumTerrainProvider.fromUrl(url, {
  requestVertexNormals: true,
})
viewer.terrainProvider = provider

// 关闭 / 卸载
viewer.scene.primitives.remove(ts)
viewer.terrainProvider = new C.EllipsoidTerrainProvider()`,
  },
  {
    title: '方案 B：EntityCluster + 自定义气泡',
    desc: '不想自己写避让、且能接受“合并成一个数量气泡”时最省事；默认只有裸数字，用 clusterEvent 换成图片气泡',
    code: `const ds = new C.CustomDataSource('labels')
viewer.dataSources.add(ds)

// 属性名是 clustering（不是 cluster），写成 cluster 会直接报 undefined
ds.clustering.enabled = true
ds.clustering.pixelRange = 40          // 聚类半径（像素）
ds.clustering.minimumClusterSize = 2   // 2 个以上才合并
ds.clustering.clusterPoints = true
ds.clustering.clusterLabels = false
ds.clustering.clusterBillboards = true

// 默认气泡只是一个数字 label，样式没法调；
// 监听 clusterEvent，自己给 billboard 换图、把 label 关掉
ds.clustering.clusterEvent.addEventListener((entities, cluster) => {
  const { canvas, size } = clusterImage(entities.length)  // 现场画一张圆徽标
  cluster.label.show = false
  cluster.billboard.show = true
  cluster.billboard.image = canvas
  cluster.billboard.width = size
  cluster.billboard.height = size
  cluster.billboard.verticalOrigin = C.VerticalOrigin.BOTTOM
  cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
})

ds.entities.add({ position, billboard: {...}, label: {...} })`,
  },
  {
    title: '方案总结：三条路线怎么选',
    desc: '显示率、代码量、可读性三者取舍；量大时推荐“近处避让 + 远处聚簇 / 距离裁剪”的组合',
    code: `/*
 * 1) 不处理（raw）
 *    代码量：0
 *    问题：全叠在一起，等于没标；旋转视角时叠的顺序还会变
 *
 * 2) 碰撞避让（declutter）—— 本页默认
 *    代码量：中（约 150 行）
 *    显示率：最高，且每条都保留真实名字，可指定优先级
 *    性能：O(n)，5000 点单次布局十几毫秒；只在相机变化时算
 *    注意：一定要先视口裁剪；网格 or 四叉树加速别省
 *
 * 3) 实体聚簇（EntityCluster）
 *    代码量：最少（几行）
 *    显示率：高，但只显示“N 个点位”，看不到具体名字
 *    性能：Entity 本身更重，几千点以上建议配合分类/分页
 *
 * 4) 大量点的组合拳（推荐 1w+）
 *    - 近距离（<= 3km）：碰撞避让，显示名字
 *    - 中距离：EntityCluster 聚簇，或只显示点
 *    - 远距离：distanceDisplayCondition 直接不渲染 label
 *    - 再往上：按瓦片 / 网格分块，只对当前视野块建 label（分页加载）
 *
 * 另外两个便宜好用的手段：
 *    distanceDisplayCondition  按相机距离自动显隐
 *    translucencyByDistance    远处文字渐隐，视觉更干净
 */`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'Cesium 不自带文字避让',
    body: 'label 默认全部显示，`disableDepthTestDistance` 只管深度遮挡，点一多必然互相压字。想让名字都读得出来，只能在屏幕空间自己算矩形碰撞。',
  },
  {
    title: '文字宽度必须先量准',
    body: '按字数估宽在长短名混排时一定错位。用 canvas 的 `measureText`，font 与 label 的 font 保持一致（字号 + 字重 + 字族），量出来的像素宽才可信。',
  },
  {
    title: '碰撞别写 O(n²)',
    body: '把屏幕按固定大小分网格，每个 label 只跟邻近格子里的矩形比较；5000 点时单次布局可以从几十毫秒降到几毫秒。',
  },
  {
    title: '重排要节流',
    body: '放进 `camera.changed` 里触发，再叠一层时间阈值或 `requestAnimationFrame` 合并；塞进 `postRender` 每帧排，等于把相机操作卡死。',
  },
  {
    title: '渲染层用 LabelCollection',
    body: '几千个 label 用 Entity 会逐条求值；`LabelCollection` 一次提交，文字相同还能复用字形图集。再配合 `distanceDisplayCondition` 把远处的字直接剔掉。',
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          点位一多，label 就会互相压字。本页对比三种处理：<code>不处理</code>（重现问题）、<code>碰撞避让</code>（自研屏幕空间检测，按真实文字宽度排布，长短名都贴得准）、<code>实体聚簇</code>（Cesium 自带合并）。默认 200 个点 + 碰撞避让，图标从 <code>public/image</code> 随机取、label 统一黄字黑描边；左上角可直接改地形 / 倾斜摄影地址（已填默认值，关掉开关即卸载）。切到 5000 点可看统计里的显示率与单次布局耗时。
        </span>
      </div>
      <CesiumViewer class="map" :home="HOME">
        <LabelCollisionPanel />
      </CesiumViewer>
    </section>

    <GuidePanel
      class="code-pane"
      title="实现要点"
      :blocks="blocks"
      blocks-title="关键代码"
      guide-label="关键代码"
      :notes="notes"
      notes-tip="以下是自研避让最容易踩的几处，按「先能量、再排布、再压耗时」的顺序整理。"
    />
  </div>
</template>

<style scoped>
.faq-page {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.map-wrap {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.hint {
  display: flex;
  flex: none;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.55;
}
.hint code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.1);
  font-size: 11px;
}
.hint .el-icon {
  margin-top: 2px;
  flex: none;
}
.map {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
.code-pane {
  width: 460px;
  flex: none;
}
@media (max-width: 1366px) {
  .code-pane {
    width: 380px;
  }
}
</style>
