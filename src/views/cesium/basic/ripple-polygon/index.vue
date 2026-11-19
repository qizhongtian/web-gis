<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import PolygonPanel from './PolygonPanel.vue'

const HOME: [number, number, number] = [114.145, 22.325, 8000]

const intro: string[] = [
  '多边形扩散不能像圆那样只改一个半径，必须换几何：每帧把顶点按比例放大，重新拼一个 `PolygonHierarchy`，交给 `polygon.hierarchy` 的 `CallbackProperty`。',
  '缩放要在「以中心为原点的局部坐标系」里做，否则直接放大经纬度会在中高纬变形；用 `Transforms.eastNorthUpToFixedFrame` 把米制偏移转回世界坐标即可。',
  '多层错相位叠在一起就是雷达波：内层刚出现、外层正在淡出，视觉上像一圈圈多边形由内向外扩散。',
]

const blocks: CodeBlock[] = [
  {
    title: '局部坐标放大顶点',
    desc: '以中心点建 ENU 坐标系，按米缩放后再转世界坐标',
    code: `const center = Cesium.Cartesian3.fromDegrees(114.16, 22.31, 1)
const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center)

function scaled(base, scale) {
  const points = base.map(([east, north]) => {
    const local = new Cesium.Cartesian3(east * scale, north * scale, 0)
    return Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3())
  })
  return new Cesium.PolygonHierarchy(points)
}`,
  },
  {
    title: 'hierarchy 用 CallbackProperty',
    desc: '每帧返回新的多边形顶点，实现"放大"',
    code: `entity.polygon.hierarchy = new Cesium.CallbackProperty(() => {
  const t = (performance.now() / 1000 / duration + phase) % 1
  return scaled(base, 0.6 + (maxScale - 0.6) * t)
}, false)

entity.polygon.material = new Cesium.ColorMaterialProperty(
  new Cesium.CallbackProperty(() => color.withAlpha((1 - t) * 0.45), false),
)`,
  },
  {
    title: '本体 + 波纹分层',
    desc: '固定多边形做参照，上面叠 N 层扩散波',
    code: `// 本体
viewer.entities.add({
  polygon: { hierarchy: scaled(base, 1), height: 1, material: color.withAlpha(0.35) },
})

// 波纹：相位错开
for (let i = 0; i < count; i++) addRipple(i / count)`,
  },
]

const notes: NoteItem[] = [
  {
    title: '不要在经纬度上直接缩放',
    body: '经纬度等比例放大在不同纬度会被拉扁，用 ENU 局部坐标（米）缩放再转世界坐标，形状才不变形。',
  },
  {
    title: '每帧创建几何有开销',
    body: '`CallbackProperty` 每帧都会 new 一个 `PolygonHierarchy` 和一组 `Cartesian3`，层数多、顶点多时要控制数量，或改在着色器里做。',
  },
  {
    title: 'outline 在部分平台不生效',
    body: '`polygon.outline` 依赖 WebGL 线宽，很多浏览器只画 1px；需要明显的边框时改用贴地 `polyline` 描边。',
  },
  {
    title: '高度与地形',
    body: '多边形抬 1m 避免与底图共面闪烁；如果开了地形，固定高度会被地形切掉，需要按地形采样顶点高度或用 `clampToGround`。',
  },
]
</script>

<template>
  <DemoPage
    hint="扩散多边形：顶点按比例逐帧放大生成新的 PolygonHierarchy，多层错相位叠加出向外扩散的雷达波。"
    :home="HOME"
  >
    <template #panel>
      <PolygonPanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="扩散多边形（雷达波）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="多边形扩散的难点是几何重建与坐标系，按下面排查。"
      />
    </template>
  </DemoPage>
</template>
