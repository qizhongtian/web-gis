<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import PointsPanel from './PointsPanel.vue'

/** 默认视角：香港上空，能看到整片随机点位 */
const HOME: [number, number, number] = [114.1694, 22.3193, 42000]

const blocks: CodeBlock[] = [
  {
    title: '聚合能力挂在 DataSource 上，不是 Viewer',
    desc: 'CustomDataSource 带 clustering，整源移除即可把点位和聚合一起清掉',
    code: `const ds = new C.CustomDataSource('demo-points')
viewer.dataSources.add(ds)

const clustering = ds.clustering
clustering.enabled = style.cluster          // 聚合总开关
clustering.pixelRange = style.clusterRange  // 屏幕像素半径：小于它才合并
clustering.minimumClusterSize = 2           // 少于 2 个不聚合

// 点位全部塞进这个源
points.value.forEach((p) => addEntity(p))`,
  },
  {
    title: 'clusterEvent：自定义聚合气泡',
    desc: '监听只注册一次，靠 clustering.enabled 开关，避免回调叠加',
    code: `if (!clusterListener) {
  clusterListener = (entities, cluster) => {
    const n = entities.length
    let badge = badgeCache.get(n)
    if (!badge) {
      badge = makeClusterBadge(n)   // canvas 画的 dataURL
      badgeCache.set(n, badge)
    }

    cluster.billboard.show = true
    cluster.billboard.image = badge.url
    cluster.billboard.width = badge.size
    cluster.billboard.height = badge.size
    cluster.billboard.verticalOrigin = C.VerticalOrigin.CENTER
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
    cluster.label.show = false      // 数字已经画在气泡里了
  }
  clustering.clusterEvent.addEventListener(clusterListener)
}`,
  },
  {
    title: 'canvas 画气泡：2 倍分辨率 + 数量分档',
    desc: '按最终显示像素排版，再乘 dpr 绘制，缩小后文字依然清晰',
    code: `export function makeClusterBadge(n) {
  const size = Math.round(56 + Math.min(22, Math.log2(n) * 4.5)) // 58~78px
  const dpr = 2
  const S = size * dpr
  const c = S / 2
  const R = c * 0.78               // 球体，外圈留给光晕

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const [c1, c2] = tierColors(n)   // 蓝 → 琥珀 → 橙 → 红

  // 光晕 → 渐变球 → 左上高光 → 白边双环 → 计数 → 小字
  ctx.font = '700 ' + Math.round(size * 0.44 * dpr) + 'px MiSans, sans-serif'
  ctx.fillText(String(n), c, c - R * 0.22)

  return { url: canvas.toDataURL('image/png'), size }
}`,
  },
  {
    title: '标注：黄字黑描边 + 距离条件',
    desc: 'pixelOffset 贴在图标顶端上方；远看自动隐藏，避免糊成一片',
    code: `label: {
  text: p.name,
  fillColor: C.Color.fromCssColorString('#ffd400'),
  outlineColor: C.Color.BLACK,
  outlineWidth: 3,
  style: C.LabelStyle.FILL_AND_OUTLINE,
  verticalOrigin: C.VerticalOrigin.BOTTOM,
  pixelOffset: new C.Cartesian2(0, -h - 4),  // h 是图标高度
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
  // 12km 内才显示名字
  distanceDisplayCondition: new C.DistanceDisplayCondition(0, 12000),
}`,
  },
  {
    title: '改样式 = 整源重建，卸载要连监听一起收',
    desc: '聚合成员关系依赖实体集合，只改单点会和聚合结果不同步',
    code: `function setStyle(patch) {
  Object.assign(style, patch)
  rebuild()       // removeAll 后按新样式重新 add
  applyCluster()  // 重新套聚合参数
}

// 卸载：先解绑 clusterEvent，再整源移除
return () => {
  source.clustering.clusterEvent.removeEventListener(clusterListener)
  clusterListener = null
  if (!v.isDestroyed?.()) v.dataSources.remove(source, true)
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'clusterEvent 触发非常频繁',
    body: '缩放、平移、惯性滑行，甚至相机静止时聚合也会重算，回调里的 `entities.map()` + 重画 canvas 会直接掉帧。气泡图必须按数量缓存（`badgeCache`），并且要设上限（超过 400 条清空），否则长时间浏览会一路涨内存。',
  },
  {
    title: '监听只能注册一次',
    body: '`applyCluster()` 会被生成、改样式反复调用，`addEventListener` 必须用 `if (!clusterListener)` 守门。否则同一事件叠加多份回调，`cluster.billboard` 被重复赋值，症状是气泡闪烁或样式回到默认。开关聚合只改 `clustering.enabled`，不要增删监听。',
  },
  {
    title: '自定义监听会让默认样式失效',
    body: '一旦注册 `clusterEvent`，聚合体的 `billboard / label / point` 都是空的：`show`、`image`、`verticalOrigin` 全要自己设。漏掉 `cluster.label.show = false`，就会出现「自制气泡 + 原生计数标签」两层文字。',
  },
  {
    title: '改任何样式都建议整源重建',
    body: '聚合成员关系依赖实体集合，只改单个实体的 `image` 会和已聚合的结果不同步。这里 `setStyle` 统一走 `removeAll()` + 全量 `add`，牺牲一点性能换一致性；点位上万时再改成局部更新 + `clustering.enabled` 短暂关闭。',
  },
  {
    title: 'disableDepthTestDistance 有副作用',
    body: '`Number.POSITIVE_INFINITY` 让图标、标签永远盖在地形和建筑之上，视觉上不会「钻地」，但会破坏前后遮挡、失去深度感。只给需要始终可见的标注开，不要全局设置。',
  },
  {
    title: 'label 一定要加距离条件',
    body: '几百个 label 远看会糊成一整片墙。`DistanceDisplayCondition(0, 12000)` 让名字只在 12km 内出现；这是 GPU 端剔除，比在 JS 里逐帧算相机距离省得多。',
  },
]
</script>

<template>
  <div class="cluster-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          点位图层：随机生成监测点，每个点从 <code>/image/map-pin-*.png</code> 里随机挑一张图钉，名称以
          <b>黄字黑描边</b>贴在图标上方（拉近到 12 km 内才显示）；聚合由 <b>EntityCluster</b> 合并，气泡按数量分档配色
          （蓝 → 琥珀 → 橙 → 红）并随数量放大。
        </span>
      </div>

      <CesiumViewer class="map" :home="HOME">
        <PointsPanel />
      </CesiumViewer>
    </section>

    <GuidePanel
      class="code-pane"
      title="点位与聚合"
      :blocks="blocks"
      blocks-title="关键代码"
      guide-label="关键代码"
      :notes="notes"
      notes-tip="聚合的坑集中在「事件触发频率」和「自定义样式覆盖默认样式」两处，按顺序排查即可。"
    />
  </div>
</template>

<style scoped>
.cluster-page {
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
.hint b {
  font-weight: 600;
}
.hint code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.1);
  font-size: 11px;
}
.hint .el-icon {
  flex: none;
  margin-top: 2px;
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
