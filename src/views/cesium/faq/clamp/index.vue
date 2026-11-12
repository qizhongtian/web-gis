<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import CodePanel, { type CodeBlock } from '@/components/CodePanel.vue'
import ClampPanel from './ClampPanel.vue'

/** 默认视角：香港全景 */
const HOME: [number, number, number] = [114.1694, 22.3193, 38000]

const blocks: CodeBlock[] = [
  {
    title: '一把梭：heightReference 自动贴地',
    desc: '高度写 0，剩下的交给 Cesium；注意瓦片必须 enableCollision',
    code: `// 点位只有经纬度 → 高度直接写 0
const position = C.Cartesian3.fromDegrees(p.lon, p.lat, 0)

viewer.entities.add({
  id: p.id,
  position,
  billboard: {
    image: '/image/map-pin-02.png',
    width: 34,
    height: 44,
    // 图标针尖（底部）落在点位上
    verticalOrigin: C.VerticalOrigin.BOTTOM,
    // 关键：让 Cesium 自己算高度
    heightReference: C.HeightReference.CLAMP_TO_GROUND,
  },
})

// 枚举对照：
//   CLAMP_TO_GROUND    地形和 3D Tiles 取最高的那个（倾斜优先、地形兜底）
//   CLAMP_TO_TERRAIN   只认地形
//   CLAMP_TO_3D_TILE   只认 3D Tiles，范围外贴不到
//   NONE               不贴，用 position 里的绝对高度

// 坑：3D Tiles 必须开碰撞，否则取不到它的高度
tileset.enableCollision = true`,
  },
  {
    title: '开关切换：只改 heightReference 就能重贴',
    desc: '不用移除实体、不用重建，下一帧 Cesium 自己重算',
    code: `// 按当前开关组合算出该用哪个枚举
const heightRef = computed(() => {
  if (tilesOn.value && terrainOn.value) return 'CLAMP_TO_GROUND'
  if (tilesOn.value) return 'CLAMP_TO_3D_TILE'
  if (terrainOn.value) return 'CLAMP_TO_TERRAIN'
  return 'NONE'
})

// 开关一变，把新枚举写到每个实体上
watch(heightRef, () => {
  const refValue = C.HeightReference[heightRef.value]
  for (const p of points) {
    const e = viewer.entities.getById(p.id)
    e.billboard.heightReference = refValue
    if (e.label) e.label.heightReference = refValue // label 是独立图元，也要设
  }
})`,
  },
  {
    title: '数据源：地址加载倾斜摄影 / 地形',
    desc: '地址走输入框，改完回车重载；开关只控制加载与卸载',
    code: `// 倾斜摄影
const ts = await C.Cesium3DTileset.fromUrl(url, {
  maximumScreenSpaceError: 16,
})
ts.enableCollision = true
viewer.scene.primitives.add(ts)

// 地形（quantized-mesh）
viewer.terrainProvider = await C.CesiumTerrainProvider.fromUrl(url, {
  requestVertexNormals: true,
})

// 卸载：地形换回椭球
viewer.terrainProvider = new C.EllipsoidTerrainProvider()`,
  },
  {
    title: '点位渲染：billboard + label 都要贴',
    desc: 'label 单独设 heightReference，否则针贴地、文字飘在空中',
    code: `viewer.entities.add({
  position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0),
  billboard: {
    image: PIN_IMAGE,
    verticalOrigin: C.VerticalOrigin.BOTTOM,
    heightReference: refValue,
  },
  label: {
    text: p.name,
    verticalOrigin: C.VerticalOrigin.BOTTOM,
    pixelOffset: new C.Cartesian2(0, -46), // 文字挪到图标上方
    heightReference: refValue,             // 这一行不能漏
  },
})`,
  },
  {
    title: '点位上千：自动降级为预计算高度',
    desc: '> 1000 点不再逐帧 clamp：算一次高度写进 position，渲染零成本',
    code: `// 策略分界：heightReference 是逐实体、逐帧 clamp，点越多越贵
const AUTO_CLAMP_LIMIT = 1000
const strategy = computed(() =>
  points.value.length <= AUTO_CLAMP_LIMIT ? 'AUTO' : 'PRECOMPUTED',
)

// 渲染：AUTO 高度写 0 交给 heightReference；PRECOMPUTED 写算好的绝对高度
const height = strategy.value === 'PRECOMPUTED'
  ? heights.get(p.id) ?? 0
  : 0
const position = C.Cartesian3.fromDegrees(p.lon, p.lat, height)
const refValue = C.HeightReference[
  strategy.value === 'PRECOMPUTED' ? 'NONE' : heightRef.value
]

// 取值：倾斜摄影 getHeight 优先，地形整片批量采样兜底
const h = tileset.getHeight(
  C.Cartographic.fromDegrees(p.lon, p.lat),
  viewer.scene,
)
const sampled = await C.sampleTerrainMostDetailed(
  viewer.terrainProvider,
  cartos, // 整片 Cartographic[]，一次批量
)
// 每 200 点一片，片间让出一帧：分片期间页面不冻结
await new Promise((r) => requestAnimationFrame(() => r()))

// 重算时机：切档位 / 开关地形与倾斜摄影 / 瓦片细化后点「重新取值」
// 不要绑 camera.changed —— 那等于每帧重算，优化白做`,
  },
  {
    title: '点位多了：每帧代价 + label 距离控制',
    desc: '实测 5000 点自动贴地 9 FPS、单帧 16.5s；换预计算后 60 FPS',
    code: `// heightReference 每个 billboard / label 每帧都会 scene.getHeight 一次
// 实测（5000 点，倾斜摄影）：
//   自动贴地        → 平均 9 FPS，单帧最长 16.5s
//   绝对高度 + NONE → 60 FPS
// 所以：1000 点以内用贴地；上千自动降级为先算高度（见上一块）

// label 的显隐看视角距离，不看点位数量：
// distanceDisplayCondition 交给 Cesium 每帧按「相机到点位」的距离裁剪
label: {
  text: p.name,
  heightReference: C.HeightReference.CLAMP_TO_GROUND,
  distanceDisplayCondition: new C.DistanceDisplayCondition(0, 2000),
}

// 换数量档位时清空重建，别一个个改
viewer.entities.removeAll()
syncEntities()

// 点位分散：按 18 个区域锚点轮转撒点 + 簇内抖动
// （全堆在一处看不出贴地效果，也测不出分散点位的开销）
const anchor = SPREAD_ANCHORS[i % SPREAD_ANCHORS.length]
lon = anchor.lon + (rand() - 0.5) * 0.009
lat = anchor.lat + (rand() - 0.5) * 0.009`,
  },
  {
    title: '实现方案总结（可直接复制给 AI）',
    desc: '把这段整段丢给 AI，就能按同一套方案改造现有工程',
    code: `【需求】
点位只有经纬度、没有高程。要求：倾斜摄影与地形可任意开关切换时，
点位始终贴在当前可见表面上；支持 12 ~ 5000 个点位。

【策略分界（最关键）】
≤ 1000 点 → A. heightReference 自动贴
            逐实体、逐帧 clamp，代码最省，瓦片变化自动跟随
> 1000 点 → B. 预计算高度 + HeightReference.NONE
            渲染零成本，代价是一次取值 + 手动重算
切换档位跨过 1000 时自动切换策略，不要两套逻辑混用。

【A. heightReference（少量点）】
1. position 高度写 0：C.Cartesian3.fromDegrees(lon, lat, 0)
2. billboard 和 label 都要设 heightReference（label 是独立图元，漏了会飘在空中）
3. 按开关组合选枚举：
     倾斜 + 地形 → CLAMP_TO_GROUND
     仅倾斜      → CLAMP_TO_3D_TILE
     仅地形      → CLAMP_TO_TERRAIN
     都没有      → NONE
4. 切换开关时只改 entity.billboard/label.heightReference，
   下一帧 Cesium 自动重算，不要移除重建 entity
5. tileset 必须 enableCollision = true，否则 CLAMP_TO_3D_TILE /
   CLAMP_TO_GROUND 取不到 3D Tiles 高度（实测全部返回 undefined）
6. 平移相机、瓦片加载完成都无需手动刷新，heightReference 每帧自动跟随

【B. 预计算高度（大量点）】
1. 倾斜：tileset.getHeight(Cartographic.fromDegrees(lon, lat), scene)
2. 地形：C.sampleTerrainMostDetailed(terrainProvider, cartos) 整片批量采样
3. 优先级：倾斜有值用倾斜，否则地形，都没有写 0
4. 渲染：绝对高度写进 position + heightReference = NONE
5. 每 200 点一片，片间 await requestAnimationFrame(() => {}) 让出主线程
6. 重算时机：切档位 / 开关数据源 / 瓦片细化后手动「重新取值」；
   不要绑 camera.changed —— 那等于每帧重算，优化白做
7. getHeight 取的是当前已加载瓦片的高度：拉远后是粗层结果，
   重新取值才会变细，属预期行为（这也是它比 heightReference 便宜的原因）

【量级对照】
≤1000    heightReference      小点数 60 FPS；5000 点实测 9 FPS
>1000    预计算 + NONE         60 FPS，换一次取值耗时
>1 万    BillboardCollection 批量 + 预计算（绕开 Entity 的逐帧开销）
>10 万   切片成 3D Tiles / 服务端出图，前端只加载可见瓦片

【不要用】
scene.clampToHeightMostDetailed / scene.sampleHeightMostDetailed：
走 GPU 深度缓冲，要求点位在画面内、相机停稳，会返回 -6344843 这类离谱值。

【其他注意】
- label 显隐按视角距离：distanceDisplayCondition 0~2000 m，与点位数无关
- 切换数量用 viewer.entities.removeAll() 重建，不要逐点改属性
- 点位要分散：按区域锚点轮转撒点，堆一处看不出贴合效果
- 需要导出 / 传接口的高程数值，走「点位高度取值」页（同一套预计算）`,
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          点位只有经纬度、没有高程：1000 点以内用 <code>heightReference</code> 逐帧自动贴，超过 1000 点自动降级为「预计算高度 + <code>NONE</code>」，每帧不再 clamp；默认 12 个点位、地形与倾斜摄影都开，文字标注只在相机距离 2 km 内显示。
        </span>
      </div>
      <CesiumViewer class="map" :home="HOME">
        <ClampPanel />
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
