<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import LinePanel from './LinePanel.vue'

const HOME: [number, number, number] = [114.13, 22.33, 16000]

const intro: string[] = [
  '精灵线本质是「沿路径重复的贴图」：`PolylineGeometry` 生成的顶点自带 `st` 坐标，`s` 沿路径 0→1、`t` 跨线宽 0→1，用它去采样一张箭头 / 光点贴图，线就变成了会动的精灵链。',
  '让纹理动起来有两条路：把 `s` 的时间项交给材质 uniform（`czm_frameNumber`），或在 CPU 端每帧改 `dashOffset`。前者完全在 GPU 上完成，几千条线也不掉帧，是特效线的标准做法。',
  '`PolylineGeometry` 的 `width` 是屏幕像素宽度，不受 WebGL 1px 限制；代价是每条线是一个 Primitive，材质、线宽变更要重建几何，适合数量不多但要求视觉效果的特效线。',
]

const blocks: CodeBlock[] = [
  {
    title: '自定义流动材质',
    desc: '用 fabric 写一段片元着色器，沿 st.s 重复采样贴图并按帧推进偏移',
    code: `const material = new Cesium.Material({
  fabric: {
    uniforms: { image, color, density: 14, speed: 0.08 },
    source: \`
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st;
        float offset = fract(czm_frameNumber * speed);
        vec4 tex = texture2D(image, vec2(fract(st.s * density - offset), st.t));
        material.diffuse = color.rgb * tex.rgb;
        material.alpha = tex.a * color.a;
        return material;
      }\`,
  },
  translucent: true,
})`,
  },
  {
    title: '宽线几何 + PolylineMaterialAppearance',
    desc: 'PolylineGeometry 的 width 是像素宽度，可绕开 WebGL 线宽限制',
    code: `viewer.scene.primitives.add(new Cesium.Primitive({
  geometryInstances: new Cesium.GeometryInstance({
    geometry: new Cesium.PolylineGeometry({
      positions,
      width: 14,
      vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
      arcType: Cesium.ArcType.NONE, // 已手动细分，避免再次测地细分
    }),
  }),
  appearance: new Cesium.PolylineMaterialAppearance({
    material,
    translucent: true,
  }),
  asynchronous: false,
}))`,
  },
  {
    title: '精灵贴图（canvas 生成）',
    desc: '现场画一张箭头贴图，省去加载静态资源；白色纹理由 color uniform 染色',
    code: `const canvas = document.createElement('canvas')
canvas.width = canvas.height = 128
const ctx = canvas.getContext('2d')
ctx.strokeStyle = '#fff'
ctx.lineWidth = 12
ctx.shadowBlur = 18
ctx.beginPath()
ctx.moveTo(38, 30); ctx.lineTo(92, 64); ctx.lineTo(38, 98)
ctx.stroke()

const image = canvas.toDataURL('image/png')`,
  },
]

const notes: NoteItem[] = [
  {
    title: 'st 坐标方向别搞反',
    body: '`PolylineGeometry` 的 `st.s` 是沿线方向、`st.t` 是跨线宽方向。若箭头被拉成横条，多半是把 `s/t` 用反了。',
  },
  {
    title: '改材质要重建 Primitive',
    body: '`Primitive` 的几何与材质在创建时确定，改线宽 / 贴图密度只能重建；只有 uniform（颜色、速度）可以就地改 `material.uniforms.xxx`。',
  },
  {
    title: 'arcType 与顶点数',
    body: '手动细分过路径后要设 `arcType: ArcType.NONE`，否则 Cesium 会再按大圆细分一遍，顶点翻倍且弧线形态被改掉。',
  },
  {
    title: '数量大时用 PolylineCollection',
    body: '每条精灵线一个 Primitive，成百上千条时应改用 `PolylineCollection` + 内置材质，或离线做成 3D Tiles。',
  },
]
</script>

<template>
  <DemoPage
    hint="精灵线：PolylineGeometry + 自定义着色器材质，箭头纹理沿路径循环流动；虚线、光带、轨迹都用同一套思路。"
    :home="HOME"
  >
    <template #panel>
      <LinePanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="精灵线（流动纹理线）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="精灵线的坑集中在 st 方向、材质重建与顶点细分，按下面顺序排查。"
      />
    </template>
  </DemoPage>
</template>
