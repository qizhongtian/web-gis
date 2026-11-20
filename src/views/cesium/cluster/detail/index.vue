<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import ClusterDetailPanel from './ClusterDetailPanel.vue'

/** 默认视角：香港上空 */
const HOME: [number, number, number] = [114.1694, 22.3193, 42000]

const blocks: CodeBlock[] = [
  {
    title: 'clusterEvent 是聚合成员的唯一来源',
    desc: '聚合实体不在 dataSource.entities 里，只能从回调的 entities 参数拿到成员',
    code: `clustering.clusterEvent.addEventListener((entities, cluster) => {
  // entities 就是被合并进来的原始实体
  const members = entities
    .map((e) => entityPoint.get(e))   // 实体 → 业务数据
    .filter(Boolean)

  // 聚合气泡的 billboard.id 默认是空的，挂一个 token 上去
  const token = {
    members,
    position: C.Cartesian3.clone(cluster.billboard.position),
  }
  clusterTokens.add(token)
  billboardTokens.set(cluster.billboard, token)

  cluster.billboard.id = token
  cluster.point.id = token
  cluster.label.id = token    // 三个 primitive 都挂，pick 到哪个都能认
})`,
  },
  {
    title: '拾取链：token → primitive → Entity',
    desc: '先认自定义 token，再兜底 primitive，最后按单点实体反查',
    code: `const picked = viewer.scene.pick(movement.position)
if (!C.defined(picked) || !picked.id) return closePopup()

const token =
  (clusterTokens.has(picked.id) ? picked.id : null) ??
  billboardTokens.get(picked.primitive) ??   // 只给 primitive 时兜底
  billboardTokens.get(picked.id)
if (token) return openPopup('cluster', token.members, token.position)

// 单点：先兼容新旧版本的 id，再用 WeakMap 反查
function resolveEntity(id) {
  if (typeof id === 'string') return ds.entities.getById(id)      // 老版本
  if (typeof id === 'object' && typeof id.id === 'string') return id // 新版本
  return null
}
const p = entityPoint.get(resolveEntity(picked.id))`,
  },
  {
    title: 'postRender 每帧投屏 + 遮挡剔除',
    desc: '锚点存世界坐标，位置每帧现算；地球背面要单独判可见性',
    code: `viewer.scene.postRender.addEventListener(() => {
  const win = C.SceneTransforms.worldToWindowCoordinates(scene, anchor, scratch)
  if (!win) return hide()

  // 球背面的点一样算得出屏幕坐标，必须单独判可见
  occluder.cameraPosition = scene.camera.positionWC
  if (!occluder.isPointVisible(anchor)) return hide()

  // win 是 canvas 内坐标，弹窗相对容器定位，要补容器偏移
  const rect = canvas.getBoundingClientRect()
  const host = viewer.container.getBoundingClientRect()
  place(win.x + rect.left - host.left, win.y + rect.top - host.top)
})`,
  },
  {
    title: '边缘避让：上翻下 + 四边 clamp',
    desc: '上方放得下就放上方，否则翻到下方；左右上下都夹进视口',
    code: `function placeAt(ax, ay, vw, vh) {
  const canAbove = ay - GAP - boxH >= MARGIN
  const rawTop = canAbove ? ay - GAP - boxH : ay + GAP

  popupTop.value = clamp(rawTop, MARGIN, Math.max(MARGIN, vh - boxH - MARGIN))
  popupLeft.value = clamp(ax - boxW / 2, MARGIN, Math.max(MARGIN, vw - boxW - MARGIN))
}

// 尺寸用 ResizeObserver 测，隐藏时只能 visibility:hidden
// display:none 量不到宽高，弹窗会永远定位在左上角`,
  },
  {
    title: '清理：顺序和判空都不能省',
    desc: '先停逐帧，再收输入，最后整源移除；Viewer 销毁后不能再操作',
    code: `return () => {
  offPostRender?.()          // 1. 停掉 postRender 逐帧回调
  offPostRender = null
  handler?.destroy?.()       // 2. 收掉 ScreenSpaceEventHandler
  ro?.disconnect()           // 3. 断开 ResizeObserver

  if (!v.isDestroyed?.()) v.dataSources.remove(source, true)

  clusterListenerAdded = false
  clusterTokens = new WeakSet()
  billboardTokens = new WeakMap()
  entityPoint = new WeakMap()
  closePopup()
}`,
  },
]

const notes: NoteItem[] = [
  {
    title: '聚合实体不在 entities 里',
    body: '`EntityCluster` 生成的气泡走内部集合，`ds.entities.getById()` 和遍历都拿不到，成员关系只能从 `clusterEvent(entities, cluster)` 的 `entities` 参数里取。这个回调随视角变化反复触发，token 会不断重建，所以用 `WeakSet / WeakMap` 存，不阻止 GC。',
  },
  {
    title: '不要缓存 cluster 对象本身',
    body: '`cluster` 每次重算都是新对象，它的 `billboard.image`、`label.text` 随时会被重置。需要留到回调之外的数据只有两样：成员数组（自己拷一份）和 `Cartesian3.clone(cluster.billboard.position)` 的坐标。',
  },
  {
    title: 'billboard.id 的类型随版本变',
    body: '老版本 Cesium 的 `billboard.id` 是字符串，新版本直接是 `Entity` 实例。`pick` 之后统一走 `resolveEntity` 做兼容判断，别直接写 `picked.id.id`，否则换版本就整个失效。',
  },
  {
    title: 'worldToWindowCoordinates 不判可见性',
    body: '地球背面的点同样会返回屏幕坐标，只看返回值会让弹窗贴在屏幕边缘变成「幽灵」。要叠一层 `EllipsoidalOccluder.isPointVisible(anchor)`，并且每帧更新 `occluder.cameraPosition`。',
  },
  {
    title: 'canvas 坐标 ≠ 容器坐标',
    body: '`worldToWindowCoordinates` 返回的是 canvas 内部像素坐标，而弹窗是相对 Viewer 容器绝对定位的。必须减掉 `container.getBoundingClientRect()` 的偏移；容器有 padding、边框或缩放时，漏了这步弹窗会整体错位。',
  },
  {
    title: '弹窗是普通 DOM，要挡事件',
    body: '弹窗里必须 `@mousedown.stop` / `@wheel.stop`，否则在弹窗上拖动会连带旋转地球、滚轮会缩放场景。同时对锚点做了 clamp 之后，仍要保证弹窗的 `z-index` 高于左侧控制面板，贴边时才不被裁掉。',
  },
  {
    title: '清理顺序',
    body: '`postRender` → `ScreenSpaceEventHandler.destroy()` → `ResizeObserver.disconnect()` → `dataSources.remove()`。全程判 `viewer.isDestroyed()`，因为 `onCesiumReady` 的 cleanup 在 Viewer 先销毁时也会被调用，少一个都会在切页后继续跑并报错。',
  },
]
</script>

<template>
  <div class="cluster-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          聚合点详情：点聚合气泡本身<b>可点击</b>，点击后在气泡旁弹出信息窗，把被合并进来的点位
          <b>逐条列出来</b>（名称 / 数值 / 经纬度），列表里点任意一行还能直接飞到该点。聚合的成员关系来自
          <b>EntityCluster</b> 的 <code>clusterEvent</code>。
        </span>
      </div>

      <CesiumViewer class="map" :home="HOME">
        <ClusterDetailPanel />
      </CesiumViewer>
    </section>

    <GuidePanel
      class="code-pane"
      title="聚合点详情"
      :blocks="blocks"
      blocks-title="关键代码"
      guide-label="关键代码"
      :notes="notes"
      notes-tip="难点在「怎么知道一个气泡由哪些点合并而成」以及「弹窗如何贴住场景」，下面按实现顺序拆开。"
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
