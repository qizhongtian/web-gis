<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import FencePanel from './FencePanel.vue'

const HOME: [number, number, number] = [114.06, 22.29, 2600]

const intro: string[] = [
  '电子围栏用 `WallGraphics` 表达：`positions` 是围栏的底面轮廓，`minimumHeights` / `maximumHeights` 决定墙体从地面拉到多高，每个顶点都可以给不同高度，天然支持起伏地形。',
  '墙体材质用 `ImageMaterialProperty` 贴一张「底部透明、顶部不透明」的竖向渐变，再乘上 `color` 染色，就有了中间空、顶部亮的半透明围栏；`repeat` 横向重复细条纹可以做出栅格感。',
  '动画不重建墙体，只让 `color` 走 `CallbackProperty` 呼吸；切换成告警态时换红色并把闪烁频率调快，是安防场景最常见的交互。',
]

const blocks: CodeBlock[] = [
  {
    title: '墙体：轮廓 + 上下高度',
    desc: 'positions 为底面闭合环，maximumHeights 控制高度',
    code: `viewer.entities.add({
  wall: {
    positions: Cesium.Cartesian3.fromDegreesArray([
      114.0515, 22.2748, 114.0685, 22.2748,
      114.0685, 22.2852, 114.0515, 22.2852, 114.0515, 22.2748,
    ]),
    maximumHeights: new Array(5).fill(90),
    minimumHeights: new Array(5).fill(0),
    material: new Cesium.ImageMaterialProperty({
      image: gradientTexture,
      transparent: true,
      repeat: new Cesium.Cartesian2(22, 1),
      color: new Cesium.CallbackProperty(() => color.withAlpha(alpha), false),
    }),
  },
})`,
  },
  {
    title: '顶部发光边线',
    desc: 'PolylineGlowMaterial 做亮边，颜色随呼吸变化',
    code: `viewer.entities.add({
  polyline: {
    positions: topRing,
    width: 3,
    material: new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.3,
      color: new Cesium.CallbackProperty(() => color.withAlpha(pulse), false),
    }),
  },
})`,
  },
  {
    title: '地面虚线范围',
    desc: '贴地虚线标出围栏投影，不参与高度计算',
    code: `viewer.entities.add({
  polyline: {
    positions: ring,
    width: 2,
    clampToGround: true,
    material: new Cesium.PolylineDashMaterialProperty({
      color: color.withAlpha(0.9),
      dashLength: 18,
    }),
  },
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'positions 必须闭合',
    body: '墙是沿折线拉起来的，首尾不重合时围栏会缺一条边；把第一个点再追加到末尾即可。',
  },
  {
    title: '高度数组要和顶点数对齐',
    body: '`maximumHeights` / `minimumHeights` 的长度必须等于 `positions` 长度，少一个会整面墙不渲染（控制台通常没有明显报错，很难查）。',
  },
  {
    title: '墙体不贴地形',
    body: '墙底高度是绝对高程，开了地形时会出现悬空或穿地；需要贴地时按地形采样每个顶点的底面高度。',
  },
  {
    title: '半透明墙的排序',
    body: '多层半透明面叠加容易出现前后遮挡错乱，尽量用一层墙 + 顶部亮线表达，不要堆很多层半透明墙体。',
  },
]
</script>

<template>
  <DemoPage
    hint="电子围栏：WallGraphics 拉伸半透明墙体，顶部发光线 + 地面虚线勾出范围，支持呼吸与告警态切换。"
    :home="HOME"
  >
    <template #panel>
      <FencePanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="电子围栏（WallGraphics）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="围栏不显示、缺边、悬空，基本都落在闭合、高度数组与地形三条上。"
      />
    </template>
  </DemoPage>
</template>
