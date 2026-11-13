<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import CodePanel, { type CodeBlock } from '@/components/CodePanel.vue'
import { DEFAULT_IMAGERY_MAX_LEVEL, DEFAULT_IMAGERY_URL } from '@/utils/gis/cesiumConfig'
import PointScalePanel from './PointScalePanel.vue'

/** 默认视角：全港，2 万米高度看到的点会明显缩小 */
const HOME: [number, number, number] = [114.17, 22.33, 9000]

const blocks: CodeBlock[] = [
  {
    title: '核心：scaleByDistance + NearFarScalar，近大远小',
    desc: '一行属性搞定「拉远变小、拉近变大」，Cesium 在渲染时按相机距离逐点算，不需要监听相机',
    code: `const nfs = new C.NearFarScalar(
  300,    // near：相机距离 300 m 以内
  2.2,    // nearValue：scale 固定 2.2（已经到上限，不会无限放大）
  12000,  // far：相机距离 12000 m 以外
  0.25,   // farValue：scale 固定 0.25（已经到下限，不会缩成 0）
)

const bb = collection.add({
  position,
  image: '/image/map-pin-02.png',
  width: 30,
  height: 38,
  verticalOrigin: C.VerticalOrigin.BOTTOM,
  scaleByDistance: nfs,   // ← 就这一行
})

// 渲染时 Cesium 自己算：distance <= near → nearValue
//                      distance >= far  → farValue
//                      中间按距离线性插值
// 所以两端天然有上下限，不需要自己 clamp`,
  },
  {
    title: '大量点用 BillboardCollection，不要用 Entity',
    desc: 'Entity 是「数据模型」，每个点一套 Property + 每帧求值；10 万点要的是「渲染批次」',
    code: `// ❌ Entity：每个点有 position/billboard/label 一堆 Property，
//          每帧 DataSourceDisplay 逐实体求值，1 万点就开始掉帧
viewer.entities.add({ position, billboard: {...} })

// ✅ BillboardCollection：一条批处理，位置直接进 GPU buffer
const collection = viewer.scene.primitives.add(new C.BillboardCollection())

// 换数量时优先 removeAll 再 add，不要 destroy 整个 collection（省一次上下文重建）
collection.removeAll()
for (let i = 0; i < positions.length; i++) {
  collection.add({ position: positions[i], image: images[i], ... })
}

// 位置提前算好缓存：只在「换数量 / 换种子」时重算，
// 改样式参数时不要重新 fromDegrees`,
  },
  {
    title: '贴图复用：图越少，批次越少',
    desc: 'billboard 按 texture 分组绘制，24 张不同图片意味着最多 24 个批次；同图才是理想批次',
    code: `// 页面里 1 / 4 / 8 / 24 张可切，就是用来对比这个开销的
const IMAGES = [0, ...Array.from({ length: 23 }, (_, i) => i + 2)]
  .map((n) => \`/image/map-pin-\${String(n).padStart(2, '0')}.png\`)

// 按贴图分组，同图相邻：渲染时同 texture 的 billboard 连成一批
const imageUrl = IMAGES[i % IMAGES.length]

// 更极致的做法：把所有图标合成一张雪碧图（atlas），
// 用 imageSubRegion 指定 UV 区域，这样不管多少种图标都只有一个 texture`,
  },
  {
    title: '参数热更新：只改属性，不重建 collection',
    desc: 'near/far/scale 改动时遍历一遍设属性（5 万点约 10~20 ms），比 removeAll + 重新 add 便宜得多',
    code: `// 传同一个实例即可：Billboard 的 setter 内部会 NearFarScalar.clone 一份，
// 所以不用担心 5 万个 billboard 共享一个对象被改乱；
// 但反过来说，每次热更新仍会产生 N 次 clone，拖动滑块要节流到一帧一次
let nfs = new C.NearFarScalar(near, nearScale, far, farScale)

function applyScale() {
  nfs = new C.NearFarScalar(near, nearScale, far, farScale)
  const n = collection.length
  for (let i = 0; i < n; i++) {
    collection.get(i).scaleByDistance = nfs
  }
  viewer.scene.requestRender()   // 非连续渲染时手动请求一帧
}

// 滑块 input 事件远多于帧：合并到一次 rAF，避免一帧跑好几遍 5 万次循环
let rafId = 0
function scheduleScale() {
  if (rafId) return
  rafId = requestAnimationFrame(() => { rafId = 0; applyScale() })
}

// 只有「换数量 / 换贴图张数 / 改基准宽度」才重建
function rebuild() {
  collection.removeAll()
  for (...) collection.add({ ... })
}`,
  },
  {
    title: 'label 要单独一个 LabelCollection，文字必须复用',
    desc: 'billboard 是纯 GPU 批处理，label 要排字形 + 上图集，成本在 CPU；文字复用 + 距离剔除是 5000 条还不卡的关键',
    code: `// 和 billboard 同一批 position，但另开一个集合：换字号 / 换距离只重建 label
const labels = viewer.scene.primitives.add(new C.LabelCollection())

// ❌ 5000 个不同文字 = 5000 套字形，图集一路膨胀，首帧卡几秒
labels.add({ text: \`点位 \${i} 号\` })

// ✅ 文字从词池里循环拼，字形种类只有十几个，图集很小
labels.add({
  position: positions[i],          // 和图钉完全同一个 Cartesian3
  text: \`\${NAMES[i % 12]}-\${Math.floor(i / 12) + 1}\`,
  font: '600 12px "Microsoft YaHei", sans-serif',
  fillColor: C.Color.fromCssColorString('#ffffff'),
  outlineColor: C.Color.fromCssColorString('#0f172a'),
  outlineWidth: 2,
  style: C.LabelStyle.FILL_AND_OUTLINE,
  verticalOrigin: C.VerticalOrigin.BOTTOM,   // 文字底边落在偏移点上 → 整条文字在图钉上方
  pixelOffset: new C.Cartesian2(0, -41),     // 偏移 = 图标高度 + 2px（负 y 向上）
  pixelOffsetScaleByDistance: nfs,           // 关键：偏移也按距离缩放，否则拉近后文字压到图钉上
  // 远处不画：省 CPU 也避免文字糊成一片
  distanceDisplayCondition: new C.DistanceDisplayCondition(0, 20000),
  // 想让它跟图标一起缩放，就加同一条 scaleByDistance；不加=固定像素
  scaleByDistance: nfs,
  disableDepthTestDistance: depth,
})

// 挂载/换字号时只重建 label，图钉 collection 不动
labels.removeAll()`,
  },
  {
    title: '性能兜底：分辨率 / 深度测试 / 别监听相机',
    desc: '点位数不动也能明显提速；反过来，随手开 label 会把预算瞬间吃光',
    code: `// 1) 先降分辨率再谈点位数：像素少了，片元开销线性下降
viewer.resolutionScale = 0.85   // 1.0 为原生，0.8~0.9 肉眼看不出，FPS 能涨 20%+

// 2) disableDepthTestDistance = Infinity 会关掉深度测试：
//    点永远画在最上层，贴椭球面的点不会和地表 z-fighting，但会「穿透」楼体
billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
label.disableDepthTestDistance = Number.POSITIVE_INFINITY

// 3) 不要监听 camera.changed 手动改每个点的大小！
//    那等于每帧遍历全量点 + 触发 collection 重建，scaleByDistance 全在 Cesium 内部算

// 4) label 别开 showBackground（每条都要多画一个背景矩形），用描边就够`,
  },
  {
    title: 'FPS 自测：用 postRender 数帧，不要用 setInterval 猜',
    desc: '页面左上角实时 FPS 就是这么来的；切点位数 / 贴图张数 / 开 label 时可以直接看数字',
    code: `let frames = 0
let lastAt = performance.now()

viewer.scene.postRender.addEventListener(() => {
  frames++
  const now = performance.now()
  const dt = now - lastAt
  if (dt >= 500) {
    fps = Math.round((frames * 1000) / dt)   // 每 0.5 s 刷新一次
    frames = 0
    lastAt = now
  }
})

// 注意：postRender 每次渲染都执行，里面只能做计数，
// 不要读 DOM、不要 setState 触发 Vue 重渲染（0.5 s 一次没问题）`,
  },
  {
    title: '量级对照：5000 点 + label 的预算怎么分',
    desc: '同一台机器实测（集显笔记本、1080p），本页配置：8 张贴图、12 组文字复用',
    code: `图标（BillboardCollection）+ 距离缩放
  1 千点    60 FPS
  2 千点    60 FPS
  3 千点    55~60 FPS
  5 千点    50~60 FPS（切 24 张贴图再降 5~8 FPS）

再加 label（LabelCollection，12 组文字复用）
  +1 千条   -0~2 FPS
  +2 千条   -2~5 FPS
  +5 千条   -5~10 FPS（开「随距离缩放」略贵一点）
  文字若各不相同 → 首帧多 1~3 s 建字形图集，这是最常见的坑

Entity + billboard + label
  5 千点    已经明显掉帧（每帧逐实体求值）

优化优先级（性价比从高到低）
  1. 用 BillboardCollection / LabelCollection 替掉 Entity
  2. label 文字复用 + distanceDisplayCondition 剔远
  3. 减少贴图张数 / 合图集
  4. resolutionScale 0.8~0.9
  5. 按距离/视锥剔除（distanceDisplayCondition、show）
  6. 再往上：切片成 3D Tiles 或服务端出图，前端只加载可见瓦片

## 一句话结论
「近大远小」不是每帧算的，是一条 scaleByDistance 交给渲染管线；
label 想要不卡，就三件事：单独一个集合、文字复用、按距离剔远。`,
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          图标用 <code>BillboardCollection</code>、文字用 <code>LabelCollection</code> 批量绘制，<code>scaleByDistance = NearFarScalar</code> 让图标拉远变小、拉近变大（两端自带上下限）。右侧可调 near / far / scale / 基准尺寸 / 点位数（最多 5000）/ 贴图张数 / label 字号与最远距离，改完立即生效；「固定像素」模式用来对比「不缩放」的拥挤感。
        </span>
      </div>
      <CesiumViewer
        class="map"
        :home="HOME"
        :imagery-url="DEFAULT_IMAGERY_URL"
        :imagery-max-level="DEFAULT_IMAGERY_MAX_LEVEL"
      >
        <PointScalePanel />
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
