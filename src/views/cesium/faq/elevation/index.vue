<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import CodePanel, { type CodeBlock } from '@/components/CodePanel.vue'
import ElevationPanel from './ElevationPanel.vue'

/** 默认视角：香港全景 */
const HOME: [number, number, number] = [114.1694, 22.3193, 38000]

const blocks: CodeBlock[] = [
  {
    title: '倾斜摄影：tileset.getHeight',
    desc: '同步返回，和相机在哪、画面渲染没渲染都无关；不需要 enableCollision',
    code: `// cartographic 只有经纬度，高度会被忽略
const carto = C.Cartographic.fromDegrees(p.lon, p.lat)

// 第二个参数必须传 scene
const h = tileset.getHeight(carto, viewer.scene)

// 取不到（瓦片没加载）
if (!Number.isFinite(h)) {
  // 等 allTilesLoaded 后再取一次
}`,
  },
  {
    title: '地形：sampleTerrainMostDetailed',
    desc: '异步，会按需加载最精细瓦片，比 scene.getHeight 准；一次传一批',
    code: `// 1) 拼一批点（尽量攒够再一起提交）
const cartos = points.map((p) =>
  C.Cartographic.fromDegrees(p.lon, p.lat))

// 2) 采样完会把 height 写回原对象
await C.sampleTerrainMostDetailed(
  viewer.terrainProvider,
  cartos,
)
const heights = cartos.map((c) => c.height)

// 地形瓦片铺满后再取，否则只有低层级（误差可达几十米）
viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) resolveHeights()
})`,
  },
  {
    title: '合并规则：倾斜优先 + 地形兜底',
    desc: '和 CLAMP_TO_GROUND 的规则保持一致，两种模式混用不会有偏差',
    code: `let height = terrainOn ? terrainHeight : 0
let source = terrainOn ? 'terrain' : 'ellipsoid'

if (tilesOn && Number.isFinite(tileHeight) && tileHeight > height) {
  height = tileHeight
  source = 'tiles'
}

// 渲染：绝对高度 + HeightReference.NONE
const position = C.Cartesian3.fromDegrees(p.lon, p.lat, height)`,
  },
  {
    title: '点位多要分片，否则主线程死锁',
    desc: '实测 5000 点同步 getHeight = 15.5s 冻结；分片后单帧最长 0.4s',
    code: `// getHeight 是同步的，一次约 3ms/点
const CHUNK = 120
for (let i = 0; i < points.length; i += CHUNK) {
  const end = Math.min(i + CHUNK, points.length)
  for (let k = i; k < end; k++) {
    const p = points[k]
    const h = tileset.getHeight(
      C.Cartographic.fromDegrees(p.lon, p.lat),
      viewer.scene,
    )
    p.height = Number.isFinite(h) ? h : p.height
  }
  // 进度 + 让出一帧，页面保持可交互
  progress.value = Math.round((end / points.length) * 100)
  await new Promise((r) => requestAnimationFrame(r))
}

// 地形采样同理分片：内部按瓦片分组，
// 点位分散到不同瓦片时请求量会爆炸
// （实测 1000 点散布全港 > 60s，5000 点聚在中环只要 6s）
for (let i = 0; i < cartos.length; i += 300) {
  await C.sampleTerrainMostDetailed(viewer.terrainProvider, cartos.slice(i, i + 300))
  await new Promise((r) => requestAnimationFrame(r))
}`,
  },
  {
    title: '表格限量 + label 按距离显隐',
    desc: '取值本身不贵，真正拖垮页面的是成千上万个 DOM 和字形',
    code: `// 表格只渲染前 100 行，其余用文字提示
const MAX_ROWS = 100
const shownRows = computed(() => points.value.slice(0, MAX_ROWS))

// label 的显隐看视角距离，不看点位数量：
// distanceDisplayCondition 交给 Cesium 每帧按「相机到点位」的距离裁剪
label: {
  text: p.name,
  heightReference: C.HeightReference.NONE,
  distanceDisplayCondition: new C.DistanceDisplayCondition(0, 2000),
}

// 统计别写 3 次 filter，一次遍历搞定
const summary = computed(() => {
  let tiles = 0, terrain = 0, ellipsoid = 0
  for (const p of points.value) {
    if (p.source === 'tiles') tiles++
    else if (p.source === 'terrain') terrain++
    else if (p.source === 'ellipsoid') ellipsoid++
  }
  return { tiles, terrain, ellipsoid }
})`,
  },
  {
    title: '要数值 vs 只要贴合：怎么选',
    desc: '两者算的是同一套表面，按业务需要选，也可以混用',
    code: `/*
 * 只要视觉贴合、点位不多（一两千个以内）：
 *   heightReference = CLAMP_TO_GROUND / CLAMP_TO_TERRAIN / CLAMP_TO_3D_TILE
 *   → 见「点位贴地(无高程)」页，零代码
 *   代价：每帧都会按当前瓦片重算高度
 *
 * 要拿数值（表格、导出、传接口、入库）：
 *   tileset.getHeight() + sampleTerrainMostDetailed()
 *   + 绝对高度 + HeightReference.NONE
 *   → 就是本页，数值可以拿去用，但瓦片更新后要自己重算
 *
 * 旧写法 scene.clampToHeightMostDetailed / sampleHeightMostDetailed：
 *   走 GPU 深度缓冲，要求点位在画面里、相机停稳，
 *   否则会返回 -6344843 这种离谱值，现在没理由再用
 */`,
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          业务要拿到具体高程时用这里：倾斜摄影走 <code>getHeight</code>、地形走 <code>sampleTerrainMostDetailed</code>，点位按算出的绝对高度渲染；默认 12 个点位、地形与倾斜摄影都开，数量可切到 5000 看分片取值进度与耗时。只求视觉贴合请去「点位贴地(无高程)」。
        </span>
      </div>
      <CesiumViewer class="map" :home="HOME">
        <ElevationPanel />
      </CesiumViewer>
    </section>

    <CodePanel class="code-pane" :blocks="blocks" title="关键代码" :default-open="[0]" />
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
