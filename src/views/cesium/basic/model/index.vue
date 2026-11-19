<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import ModelPanel from './ModelPanel.vue'

const HOME: [number, number, number] = [114.1694, 22.3193, 2000]

const intro: string[] = [
  'glTF 2.0 常被叫做「3D 的 JPEG」：一个 JSON 描述场景结构（nodes、meshes、materials、animations、skins），`.bin` 存顶点与索引，纹理单独成文件；`.glb` 则把 JSON、BIN 和纹理打包进一个二进制容器（magic + chunk0 JSON + chunk1 BIN），单文件、请求少，线上优先用 GLB。材质是 PBR 的 metallic-roughness 模型，几何可用 Draco 压缩，纹理可用 KTX2，还支持骨骼蒙皮与关键帧动画。',
  '坐标系是模型接入最容易错的地方：glTF 约定 Y 轴向上、右手系、单位米；Cesium 的世界坐标是 ECEF（地心直角坐标），不能把模型坐标直接当地心坐标。正确做法是通过 ENU 局部坐标系（`Transforms.eastNorthUpToFixedFrame`）或实体的 `orientation` 把模型摆到地球表面，`heading` 的 0 度是正北、顺时针为正。',
  'Cesium 有两条加载路径：`Entity.model`（声明式，位置/朝向/缩放都是实体属性，适合少量、需要交互与贴地的模型）和 `Model.fromGltfAsync`（Primitive，性能好、能直接操作节点与动画，适合大量模型或需要实例化/精细控制）。3D Tiles 里的 glTF 内容则由瓦片调度，不需要自己建实体。',
  '常见问题集中在四件事：模型埋在地下（高度没给或没开地形）、比例不对（源数据单位是厘米）、朝向不对（没设 heading 或基准轴不同）、模型太小/太大（用 `minimumPixelSize` 兜底，超大模型注意相机近远裁剪面）。',
]

const blocks: CodeBlock[] = [
  {
    title: 'Entity 方式：位置 + 朝向 + 缩放',
    desc: '最常用的方式，实体属性变化会直接反映到渲染，卸载时随实体一起移除',
    code: `const position = Cesium.Cartesian3.fromDegrees(114.1694, 22.3193, 0)

const entity = viewer.entities.add({
  position,
  // 朝向：heading 正北为 0、顺时针；pitch/roll 单位弧度
  orientation: Cesium.Transforms.headingPitchRollQuaternion(
    position,
    new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(45), // heading
      Cesium.Math.toRadians(0),  // pitch
      Cesium.Math.toRadians(0),  // roll
    ),
  ),
  model: {
    uri: '/data/models/Duck.glb',
    scale: 1,
    minimumPixelSize: 64,        // 远处也至少 64px，避免消失
    shadows: Cesium.ShadowMode.ENABLED,
    silhouetteColor: Cesium.Color.ORANGE,
    silhouetteSize: 2,
  },
})`,
  },
  {
    title: 'Primitive 方式：Model.fromGltfAsync + ENU 矩阵',
    desc: '大量模型或需要直接操作节点/动画时用，性能比 Entity 好',
    code: `// 1) 建 ENU 局部坐标系：原点在目标经纬度
const origin = Cesium.Cartesian3.fromDegrees(114.1694, 22.3193, 0)
const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin)

const model = await Cesium.Model.fromGltfAsync({
  url: '/data/models/Duck.glb',
  modelMatrix: Cesium.Matrix4.multiplyByUniformScale(enu, 1, new Cesium.Matrix4),
  minimumPixelSize: 64,
  shadows: Cesium.ShadowMode.ENABLED,
})

viewer.scene.primitives.add(model)

// 模型就绪后再操作节点/动画，避免读到未加载的 sceneGraph
await model.readyPromise
console.log('节点数', model.sceneGraph._runtimeNodes.length)`,
  },
  {
    title: '播放模型内置动画',
    desc: 'Milk Truck 这类带动画的 GLB，用 activeAnimations 控制播放',
    code: `const model = await Cesium.Model.fromGltfAsync({
  url: '/data/models/CesiumMilkTruck.glb',
  modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(114.1694, 22.3193, 0),
  ),
})
viewer.scene.primitives.add(model)

await model.readyPromise
// 循环播放全部动画
model.activeAnimations.addAll({
  loop: Cesium.ModelAnimationLoop.REPEAT,
  speedup: 1,
})`,
  },
  {
    title: '轮廓高亮与点击拾取',
    desc: '模型拾取返回 primitive（Model）与 detail.node，可据此做构件级交互',
    code: `const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position)
  if (!picked?.primitive) return

  // 高亮整个模型
  picked.primitive.silhouetteColor = Cesium.Color.ORANGE
  picked.primitive.silhouetteSize = 2

  // 细节：Cesium 1.105 起 pick 结果带 detail.node（运行时节点）
  const node = picked.detail?.node
  const index = picked.primitive.sceneGraph._runtimeNodes.indexOf(node)
  console.log('点到了节点', index)
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)`,
  },
]

const notes: NoteItem[] = [
  {
    title: '优先用 GLB 单文件',
    body: '`.gltf` + 外部 `.bin` + 贴图会产生多个请求，任一资源跨域或路径错都会导致模型不显示；GLB 把资源打进一个文件，部署最省心。若必须用外部资源，确保与页面同域或服务端带 CORS 头。',
  },
  {
    title: 'scale 与源数据单位',
    body: 'glTF 单位是米，但很多建模软件导出时是厘米，表现为模型放大 100 倍。先用 `scale` 校正，或让建模端按米导出；不要用相机距离「掩盖」比例错误。',
  },
  {
    title: 'minimumPixelSize 是保底，不是修复',
    body: '模型太小看不见时，`minimumPixelSize` 能保证它至少占多少像素，但会破坏真实远近关系。正确做法是先确认单位与 scale，再用它做远处可见性兜底。',
  },
  {
    title: '大量模型不要用 Entity',
    body: 'Entity 每个都带一套属性系统，上千个模型会明显掉帧；这种场景用 `Model.fromGltfAsync` + `ModelInstanceCollection`/3D Tiles，或直接离线转成 3D Tiles 做 LOD。',
  },
  {
    title: '贴地要靠高度参考，不是高度 0',
    body: '`height: 0` 表示椭球面高度 0，山地会悬空或埋地。要使模型贴地形，把实体 `heightReference` 设为 `CLAMP_TO_GROUND`（需要先开启地形），或采样地形高程后再设置 `height`。',
  },
]
</script>

<template>
  <DemoPage
    hint="模型加载：默认加载本地 Duck.glb，可切换 Milk Truck、调整经纬度/高度/朝向/缩放与最小像素，观察 glTF 在地球上的摆放方式。"
    :home="HOME"
  >
    <template #panel>
      <ModelPanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="模型（glTF / GLB）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="模型的坑集中在单位、坐标系、资源路径和数量级，下面按排查顺序说明。"
      />
    </template>
  </DemoPage>
</template>
