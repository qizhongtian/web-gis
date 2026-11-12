<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import CodePanel, { type CodeBlock } from '@/components/CodePanel.vue'
import { DEFAULT_IMAGERY_MAX_LEVEL, DEFAULT_IMAGERY_URL } from '@/utils/gis/cesiumConfig'
import PopupPanel from './PopupPanel.vue'

/** 默认视角：维多利亚港两岸 */
const HOME: [number, number, number] = [114.1685, 22.2905, 4200]

const blocks: CodeBlock[] = [
  {
    title: '核心：世界坐标 → 屏幕坐标，每帧更新',
    desc: '锚点存世界坐标，位置每帧现算；只绑 camera.changed 会在缩放、惯性滑行时漏更新',
    code: `// 1. 点击时把锚点存成世界坐标（pickPosition 取点击处的真实位置）
let anchorWorld = null

handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  if (!picked?.id) return closePopup()

  anchorWorld = viewer.scene.pickPositionSupported
    ? viewer.scene.pickPosition(movement.position)
    : C.Cartesian3.fromDegrees(f.lon, f.lat, 0)

  openPopup(f)
}, C.ScreenSpaceEventType.LEFT_CLICK)

// 2. 每帧投影：postRender 覆盖平移 / 缩放 / 惯性滑行 / 瓦片加载引起的所有变化
const scratch = new C.Cartesian2()
viewer.scene.postRender.addEventListener(() => {
  if (!anchorWorld || !popupVisible) return

  const win = C.SceneTransforms.wgs84ToWindowCoordinates(
    viewer.scene, anchorWorld, scratch,
  )
  if (!win) return hide()          // 背面 / 算不出来

  // canvas 相对容器的偏移要补上，否则弹窗整体错位
  const rect = viewer.scene.canvas.getBoundingClientRect()
  place(win.x + rect.left, win.y + rect.top)
})`,
  },
  {
    title: '边缘避让：上翻下 + 左右 clamp',
    desc: '先判上方是否放得下，放不下翻到下方；再夹住左右，保证弹窗完整可见',
    code: `const MARGIN = 12   // 弹窗与视口边界的最小距离
const GAP = 10      // 锚点与弹窗之间的空隙（含箭头）

function place(ax, ay) {
  const { width: W, height: H } = popupRect   // 量好的弹窗尺寸
  const vw = canvas.clientWidth
  const vh = canvas.clientHeight

  // 上方够放就放上方，不够翻到下方 —— 这是“尽量显示全”的关键一步
  const side = ay - GAP - H >= MARGIN ? 'top' : 'bottom'
  const rawLeft = ax - W / 2
  const rawTop = side === 'top' ? ay - GAP - H : ay + GAP

  // 左右 / 上下都夹一遍：弹窗比视口还高时也不至于整块跑出去
  const left = clamp(rawLeft, MARGIN, Math.max(MARGIN, vw - W - MARGIN))
  const top = clamp(rawTop, MARGIN, Math.max(MARGIN, vh - H - MARGIN))

  style.left = left + 'px'
  style.top = top + 'px'
  arrow.style.left = clamp(ax - left, 12, W - 12) + 'px'
  arrow.classList.toggle('bottom', side === 'bottom')
}`,
  },
  {
    title: '箭头单独夹紧，别让它跑出弹窗',
    desc: '弹窗被 clamp 之后，箭头相对弹窗的 x 必须再夹一次，否则贴边时箭头会消失',
    code: `/* 弹窗宽 280，锚点贴着屏幕右边时：
   left 被夹到 vw - 280 - 12
   锚点相对弹窗的 x 已经超过 280 → 箭头跑到弹窗外面 */

// 正确做法：箭头位置单独 clamp 到 [12, W - 12]
const arrowX = clamp(ax - left, 12, W - 12)

// 视觉上箭头会偏离锚点一点，但弹窗始终完整可见，这是必要取舍`,
  },
  {
    title: '尺寸：量一次，之后靠 ResizeObserver',
    desc: '每帧读 offsetHeight 会强制同步布局，拖动时直接掉帧；内容变了让 Observer 通知你',
    code: `let boxW = 0
let boxH = 0

function measure() {
  const el = popupEl.value
  if (!el) return
  boxW = el.offsetWidth    // 只在这里读一次
  boxH = el.offsetHeight
}

// 内容切换（短/长/超长）、换宽度、字体加载完 —— 都会变尺寸
const ro = new ResizeObserver(() => {
  measure()
  place(anchorX, anchorY)   // 尺寸变了立刻重排一次
})
ro.observe(popupEl.value)

// 弹窗比视口还高时：max-height + 内部滚动，而不是让它溢出屏幕
// .popup { display:flex; flex-direction:column; max-height: calc(100% - 24px) }
// .popup-body { flex:1; min-height:0; overflow:auto }`,
  },
  {
    title: '该藏就藏：背面、出视口',
    desc: '不隐藏就会出现贴着屏幕边不动的“幽灵弹窗”，用户以为它还在看某个要素',
    code: `// 1) 出视口：锚点屏幕坐标不在画布内
const vw = canvas.clientWidth
const vh = canvas.clientHeight
inView = ax >= 0 && ax <= vw && ay >= 0 && ay <= vh

// 2) 背面：地球挡住时 wgs84ToWindowCoordinates 仍可能返回坐标，
//    要用 EllipsoidalOccluder 判断锚点是否被地球遮挡
const occluder = new C.EllipsoidalOccluder(
  C.Ellipsoid.WGS84,
  viewer.scene.camera.positionWC,
)
if (!occluder.isPointVisible(anchorWorld)) inView = false

// 3) 点空白处 / ESC 关闭
if (!picked?.id) closePopup()`,
  },
  {
    title: '点 / 线 / 面都要能点中',
    desc: '线宽 3px、面要贴地，命中区域很窄；给 line/polygon 加宽或补一条透明辅助线',
    code: `// 点：billboard 本身就能命中
viewer.entities.add({ id: 'PT-1', position, billboard: {...} })

// 线：clampToGround 贴地，宽度给 5px，太细点不准
viewer.entities.add({
  id: 'LN-1',
  polyline: {
    positions: C.Cartesian3.fromDegreesArray(flat),
    width: 5,
    clampToGround: true,
    material: C.Color.fromCssColorString('#0ea5e9'),
  },
})

// 面：贴地多边形的 outline 不可靠，描边单独用一条 polyline 画
viewer.entities.add({
  id: 'PG-1',
  polygon: {
    hierarchy: C.Cartesian3.fromDegreesArray(flat),
    material: color.withAlpha(0.45),
  },
})
viewer.entities.add({
  id: 'PG-1-outline',                       // 拾取后要把 -outline 去掉再找要素
  polyline: { positions: ring, width: 3, clampToGround: true, material: color },
})`,
  },
  {
    title: '为什么不用 Cesium 自带 InfoBox',
    desc: 'InfoBox 是固定方位的 HTML 面板，不跟锚点、不翻面、不贴边；要做“跟随 + 避让”只能自己画',
    code: `// Cesium 默认 InfoBox：
//   - 位置固定在右上角（.cesium-infoBox），与要素屏幕位置无关
//   - 只能显示 selectedEntity 的信息，样式受 widget CSS 约束
//   - 没有翻面 / clamp 逻辑，要素贴边时完全不知道该往哪儿躲
// 所以「跟随视口 + 边缘避让」必须自己写一个绝对定位的 DOM，
// 按上面的 place() 算左上角。Cesium 只负责给坐标，摆位是前端的活。`,
  },
  {
    title: '实现方案总结（可直接复制给 AI）',
    desc: '一句话版本：世界坐标每帧投影 + 上下翻转 + 双向 clamp + 尺寸缓存 + 不可见就隐藏',
    code: `【需求】
Cesium 里点击点 / 线 / 面弹出信息窗，窗口跟随场景视口移动；
锚点靠近视口边缘时自动调整位置，尽量把内容显示全。

【实现步骤】
1. 点击：scene.pick 拿要素，scene.pickPosition 拿世界坐标（失败则用要素中心）
2. 每帧：scene.postRender → SceneTransforms.wgs84ToWindowCoordinates
         得到 canvas 坐标，加上 canvas.getBoundingClientRect 偏移
3. 尺寸：弹窗 DOM 量一次 offsetWidth/offsetHeight，用 ResizeObserver 监听变化；
         不要每帧读，会强制同步布局
4. 定位：
     side = (ay - GAP - H >= MARGIN) ? 'top' : 'bottom'   // 上翻下
     left = clamp(ax - W/2, MARGIN, vw - W - MARGIN)      // 左右夹
     top  = clamp(rawTop,  MARGIN, vh - H - MARGIN)       // 上下兜底
     arrowX = clamp(ax - left, 12, W - 12)                // 箭头单独夹
5. 隐藏：锚点出视口 / 被地球遮挡（EllipsoidalOccluder）/ 点击空白
6. 内容过高：max-height + body 内部滚动，而不是让弹窗溢出
7. 清理：postRender 移除、ScreenSpaceEventHandler.destroy()、ResizeObserver.disconnect()

【不要做】
- 只绑 camera.changed：缩放、惯性滑行、瓦片细化时会漏更新
- 每帧读 offsetHeight：拖动时布局抖动 / 掉帧
- 用 Cesium InfoBox 硬改 CSS：它是固定方位面板，没有跟随与避让逻辑
- 弹窗出视口还留着：用户会误以为它还在描述某个要素`,
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          点击地图上的 <b>点 / 线 / 面</b>：弹窗跟随锚点移动，靠近上边缘自动翻到下方，左右贴边时 clamp 顶住、箭头单独夹紧；切到「不处理」可对比溢出效果，超长内容则改为内部滚动。
        </span>
      </div>
      <CesiumViewer
        class="map"
        :home="HOME"
        :imagery-url="DEFAULT_IMAGERY_URL"
        :imagery-max-level="DEFAULT_IMAGERY_MAX_LEVEL"
      >
        <PopupPanel />
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
.hint b {
  font-weight: 600;
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
