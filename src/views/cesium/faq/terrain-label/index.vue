<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import TerrainLabelPanel from './TerrainLabelPanel.vue'

/** 默认视角：港岛北岸中环，斜视能把平地与半山都带进来 */
const HOME: [number, number, number] = [114.1605, 22.2865, 4200]

const blocks: CodeBlock[] = [
  {
    title: '先说结论：贴地的文字不能是 Label',
    desc: 'Label / Billboard 永远朝向屏幕，做不出「铺在地上」的感觉',
    code: `// 这两种都是「竖在空中的牌子」，绕轨道旋转时文字始终正对你
label: { text: p.name, heightReference: C.HeightReference.CLAMP_TO_GROUND }
billboard: { image: icon, heightReference: C.HeightReference.CLAMP_TO_GROUND }

// 它们只解决了「高度贴地」，没有解决「朝向贴地」
// 要文字像贴纸一样铺在地表 → 必须把文字变成「地面上的纹理」

// 方案对比
//   Label + CLAMP_TO_GROUND  贴地，但永远竖着朝屏幕  ✗
//   billboard 旋转到地面      只能绕 Z 轴转，仍是广告牌  ✗
//   多边形 + 纹理            真正铺在地形上，随坡面起伏  ✓`,
  },
  {
    title: '第一步：把「图标 + 文字」画进 Canvas',
    desc: 'Canvas 就是纹理源，画完直接交给 ImageMaterialProperty',
    code: `function makeTexture(name, color) {
  const cv = document.createElement('canvas')
  cv.width = 420        // 长宽比必须和贴地矩形完全一致，否则文字会被拉变形
  cv.height = 202

  const ctx = cv.getContext('2d')
  // 不要白色底板：只描一圈白边，光栅化后就是文字外的一层 halo
  ctx.font = 'bold 60px "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 12
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeText(name, 210, 62)   // 文字在上
  ctx.fillStyle = color
  ctx.fillText(name, 210, 62)

  // 图标在下：图钉压在文字下方，整张贴纸像一枚地面标牌
  drawPin(ctx, 210, 142, 36, color)

  return cv   // HTMLCanvasElement 直接就能当纹理
}`,
  },
  {
    title: '第二步：贴地多边形 + 图像材质',
    desc: '关键是「不写 height」：Cesium 才会走贴地图元，把纹理投影到地形表面',
    code: `viewer.entities.add({
  polygon: {
    // 以点位为中心的经纬度矩形，上北下南 → 文字方向固定，不跟相机转
    hierarchy: C.Cartesian3.fromDegreesArray([
      lon - dLon, lat - dLat,
      lon + dLon, lat - dLat,
      lon + dLon, lat + dLat,
      lon - dLon, lat + dLat,
    ]),

    // Canvas 画出来的贴纸：透明背景 + 白底 + 图标 + 文字
    material: new C.ImageMaterialProperty({
      image: makeTexture(p.name, p.color),
      transparent: true,
    }),

    // 不写 height / extrudedHeight → GroundPrimitive 贴地
    // TERRAIN 只贴地形；BOTH 还能贴到倾斜摄影表面
    classificationType: C.ClassificationType.TERRAIN,
    zIndex: 20,
  },
})

// 注意：
// 1. 贴地图元是「投影」，不是 3D 模型；陡坡上文字会沿坡面拉伸，这是预期效果
// 2. 倾斜摄影默认会盖住贴地标注（地面图元在瓦片下面）
//    想让标注贴到倾斜摄影表面，把 classificationType 改成 BOTH`,
  },
  {
    title: '第三步：尺寸用「米」，相机移动时别重建几何',
    desc: '贴纸是铺在地上的实物，拉近自然变大；每改一次 hierarchy 都要重新分类，看起来就是一闪一闪',
    code: `// 贴纸尺寸 = 米制常量（滑杆可调），和相机高度无关
// 定「宽度」再按长宽比推高度，切换排版模式时视觉宽度才一致
const worldH = (1080 * sizeScale) / ratio   // 米

// 拉远 / 拉近：只有相机在动，几何一动不动 → 屏幕上自然缩放
camera.changed.addEventListener(onCameraChanged)   // 里面只改 entity.show

// 反例：在 camera.changed 里重设 hierarchy
// 贴地图元每次重建都要重新做地形分类 + 重新上传纹理，
// 高频触发时就是肉眼可见的闪烁
function refreshSize() {
  if (Math.abs(next - last) / last < 0.1) return
  for (const s of stickers) s.entity.polygon.hierarchy = rectFor(...)  // ✗ 会闪
}

// 只有用户拖「贴纸大小」滑杆时才改几何
function applySize() {
  for (const s of stickers) {
    s.entity.polygon.hierarchy = new C.PolygonHierarchy(rectFor(s.point, worldH, s.ratio))
  }
}`,
  },
  {
    title: '第四步：远近分级 + 屏幕包围盒去重',
    desc: '远的只留重点，近的按屏幕占位避让：既不会满屏，也不会压在一起、来回闪',
    code: `// 1. 距离分级：相机越高，只保留级别越小的点
const maxLevel = camH < 3600 ? 3 : camH < 12000 ? 2 : camH < 20000 ? 1 : 0
if (p.level > maxLevel) continue
if (C.Cartesian3.distance(camera.positionWC, world) > maxDist) continue

// 2. 投影到屏幕造包围盒；出视口的直接丢
const win = C.SceneTransforms.worldToWindowCoordinates(scene, world)
if (win.x < 0 || win.x > w || win.y < 0 || win.y > h) continue
const pxH = (worldH * Math.abs(Math.sin(camera.pitch))) / mpp

// 3. 迟滞 + 就近占位：
//    已显示的只要重叠 ≤ 25% 就继续显示，新来的必须重叠 < 3% 才允许出现
placed.push(panelRect())           // 面板也占位
for (const c of shown) if (overlap(c) <= 0.25) occupy(c)
for (const c of fresh) if (overlap(c) <= 0.03) occupy(c)

// 4. 只写变化的实体：不要「先全部 show=false 再逐个打开」，
//    那样每帧都整批闪一次，滚轮缩放时会看到一片眨眼睛
for (const s of stickers) {
  const want = nextShown.has(s.point.id)
  if (s.entity.show !== want) s.entity.show = want
}`,
  },
  {
    title: '完整方案（可直接复制给 AI）',
    desc: '把这段丢给 AI，就能在别的 Cesium 工程里复刻同样的效果',
    code: `【需求】
点位只有经纬度；每个点要有一个图标 + 一行文字标注。
要求：像地图地名一样「铺在地表」，不能竖立朝屏幕；
拉近显示、拉远隐藏；多点位时不能互相叠压；地形起伏时文字跟随坡面。

【实现：Canvas 纹理 + 贴地多边形】
1. 每个点画一张 Canvas：文字在上、图标在下，透明背景，不加白色底板
   文字用白色描边（halo）保证在地图上读得清
   画布长宽比必须与贴地矩形一致，否则文字变形
2. 实体用 polygon，不写 height / extrudedHeight
   → Cesium 自动创建 GroundPrimitive，把纹理投影到地形表面
   → material 用 ImageMaterialProperty(image: canvas, transparent: true)
3. 多边形顶点由经纬度算出：以点为中心，按 dLat / dLon 展开成矩形
   （按经纬度轴对齐 → 上北下南，旋转相机文字方向不变）
4. 尺寸用米制常量（如 520 米，滑杆可调），不要跟着相机高度重算：
   拉远拉近时几何不动，屏幕上自然缩放；
   在 camera.changed 里重设 hierarchy 会不断重新分类贴地图元，看起来就是一闪一闪
5. 显隐：
   a. 相机高度分级：越高只留 level 越小的点
   b. 相机到点距离 > 阈值 → 隐藏
   c. 投影出视口的直接丢（否则「可见数」会算多）
   d. 屏幕包围盒去重 + 迟滞：已显示的允许重叠 25%，新来的要求 < 3%
   e. 面板矩形也算占位；只写有变化的 entity.show，不整批开关
   全部通过 entity.show 控制，不重建几何
6. 贴地目标：classificationType = TERRAIN 只贴地形；
   BOTH 会连倾斜摄影表面一起贴（但瓦片会遮住地面图元）

【坑】
- Billboard / Label 是屏幕朝向的，贴地只是高度贴地，视觉上仍然竖着
- 贴地图元在倾斜摄影下面：瓦片一加载就把标注盖住，需要 BOTH 或关瓦片
- 陡坡上文字会被拉长：贴地投影的必然结果，坡特别陡时缩短贴纸长宽比
- 闪烁通常是两件事：相机移动时重建 hierarchy（重新分类）、
  以及「先全部 show=false 再逐个打开」——改成只写变化项即可
- 白底胶囊虽然稳，但会遮地图；用白描边代替，视觉上更干净`,

  },
]

const notes: NoteItem[] = [
  {
    title: '贴纸不是 3D 物体，是投影到地表的纹理',
    body: '多边形不写 `height` 时 Cesium 会生成 GroundPrimitive，把纹理投影到地形表面。所以平地上文字平铺、山坡上文字沿坡面拉伸，这是由地形决定的，不是给每个字单独摆位置。',
  },
  {
    title: '纹理方向按经纬度固定，旋转相机不会转',
    body: '矩形顶点用 `fromDegreesArray` 按经纬度轴对齐，纹理的「上」永远朝北。相机绕圈、俯仰时文字始终属于地面，不会像 Label 那样正对屏幕——这正是需要的样子。',
  },
  {
    title: '尺寸用「米」，但别在相机移动时重建几何',
    body: '贴纸是铺在地上的实物，用固定米制尺寸更自然：拉近变大、拉远变小。若在 `camera.changed` 里跟着高度重设 `hierarchy`，贴地图元会不断重新做地形分类，滚轮缩放时就会一闪一闪——只在用户拖「贴纸大小」时改几何。',
  },
  {
    title: '倾斜摄影会盖住地面图元',
    body: 'GroundPrimitive 在地形与瓦片之间：倾斜摄影一加载，贴地文字就被建筑挡住。要贴到建筑表面就把 `classificationType` 设为 `BOTH`；只想看地形贴纸就关掉倾斜摄影。',
  },
  {
    title: '多点位必须做屏幕去重',
    body: '距离分级只能控制「显示哪些层」，控制不了「会不会压在一起」。把贴纸投影成屏幕包围盒，近的优先占位；再做迟滞（已显示的允许压 25%、新来的要求 < 3%）和「只写变化项」，否则在阈值边缘会反复开关，看起来就是闪。',
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          把「文字在上、图标在下」画进 Canvas，作为贴地多边形的纹理铺在地表：不加白底、只描白边，平地上平铺、山坡上随地形起伏，旋转俯仰都不会竖起来；拉近自然放大、拉远自然缩小，远了只留重点点位，近处按屏幕包围盒避让且不会闪。
        </span>
      </div>
      <CesiumViewer class="map" :home="HOME">
        <TerrainLabelPanel />
      </CesiumViewer>
    </section>

    <GuidePanel
      class="code-pane"
      title="实现要点"
      :blocks="blocks"
      blocks-title="关键代码"
      guide-label="关键代码"
      :notes="notes"
      notes-tip="以下是「贴地文字」最容易踩的几处，按「纹理怎么画、怎么贴、怎么控数量」的顺序整理。"
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
