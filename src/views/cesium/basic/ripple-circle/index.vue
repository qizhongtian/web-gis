<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import CirclePanel from './CirclePanel.vue'

const HOME: [number, number, number] = [114.045, 22.333, 9000]

const intro: string[] = [
  '扩散圆的几何体始终是同一个 `EllipseGraphics`：把 `semiMajorAxis` / `semiMinorAxis` 换成 `CallbackProperty`，每帧按时间算半径，圆自己就长大了，不需要每帧重建实体。',
  '同一套机制管透明度：`material` 用一个返回 `Color.withAlpha()` 的 `CallbackProperty`，让圆在扩散到最大时淡出，视觉上就是一圈圈波纹。',
  '多层波纹只要复制同一份实体、把时间相位错开 `i / count`，一组错相的圆叠加起来就是常见的雷达 / 水波扩散效果。',
]

const blocks: CodeBlock[] = [
  {
    title: '半径与透明度用 CallbackProperty 驱动',
    desc: '实体只创建一次，动画在渲染帧里计算',
    code: `const time = () => (performance.now() / 1000 / duration + phase) % 1

viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(114.06, 22.32, 1),
  ellipse: {
    semiMajorAxis: new Cesium.CallbackProperty(() => radius * time(), false),
    semiMinorAxis: new Cesium.CallbackProperty(() => radius * time(), false),
    height: 1,
    material: new Cesium.ColorMaterialProperty(
      new Cesium.CallbackProperty(() => color.withAlpha((1 - time()) * 0.75), false),
    ),
  },
})`,
  },
  {
    title: '多层错相位波纹',
    desc: '同一套逻辑复制 N 份，相位错开即形成连续扩散',
    code: `for (let i = 0; i < count; i++) {
  const phase = i / count
  addRipple(phase) // 内部同上，只是时间加 phase
}`,
  },
  {
    title: '中心标记',
    desc: '点实体加 disableDepthTestDistance，避免被地表或模型遮挡',
    code: `viewer.entities.add({
  position: center,
  point: {
    pixelSize: 10,
    color: Cesium.Color.WHITE,
    outlineColor: color,
    outlineWidth: 3,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
})`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'CallbackProperty 的 isConstant 要传 false',
    body: '第二个参数为 `false` 表示属性随时间变化，Cesium 才会每帧求值；传 `true` 会被当成常量缓存，动画直接停住。',
  },
  {
    title: '高度别用 0',
    body: '`height: 0` 与椭球面共面会出现闪烁（z-fighting），抬 1 米即可；真正贴地形则要用 `clampToGround` 或 `classificationType`。',
  },
  {
    title: '时间基准别用 JulianDate 差值',
    body: '用 `performance.now()` 或 `viewer.clock.currentTime` 都可以，但要保证 `duration` 为 0 时不做除法，否则会出现 `Infinity` 半径导致渲染异常。',
  },
  {
    title: '数量与性能',
    body: '每个 CallbackProperty 每帧都要进 JS 求值，几十个波纹没问题；上百个时改成单个自定义材质 / 着色器做 GPU 动画。',
  },
]
</script>

<template>
  <DemoPage
    hint="扩散圆：Ellipse 的半径与透明度交给 CallbackProperty 逐帧计算，多层错相位叠加出向外扩散的波纹。"
    :home="HOME"
  >
    <template #panel>
      <CirclePanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="扩散圆（波纹动画）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="波纹类动画的问题基本出在属性刷新与高度共面上，按下面排查。"
      />
    </template>
  </DemoPage>
</template>
