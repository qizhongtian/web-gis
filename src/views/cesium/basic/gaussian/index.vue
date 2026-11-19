<script setup lang="ts">
import DemoPage from '../DemoPage.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import GaussianPanel from './GaussianPanel.vue'

const HOME: [number, number, number] = [114.1605, 22.2865, 12000]

const intro: string[] = [
  '高斯泼溅（3D Gaussian Splatting，3DGS）用一组「带朝向的椭球」表示场景，而不是三角网：每个高斯包含中心位置 μ、协方差 Σ（由旋转 R 与缩放 S 组成，决定椭球形状和朝向）、不透明度 α，以及球谐系数（SH，用来表达随视角变化的颜色）。渲染时把每个高斯投影成屏幕上的 2D splat，按深度排序做 alpha 混合，因此能从任意角度实时看到接近照片的真实感。',
  '它是可微渲染：从多视角照片或视频出发，通过梯度下降同时优化高斯参数，训练通常几十分钟；相比 NeRF，3DGS 是显式表示，渲染快、可编辑、可直接导出，代价是数据体积大、显存占用高。相比倾斜摄影/摄影测量，3DGS 对反光、透明、毛发、枝叶这类「重建不出几何」的物体表现更好，但没有真正的水密表面，也没有楼层/构件语义，不能直接做量测和单体化交互。',
  'Web 端的落地方式已经收敛：训练产物是 `.ply` / `.splat`，用 SuperSplat、Niantic SPZ 等工具压缩成 `.spz`，再由 3D Tiles 1.1 的 glTF 内容承载（`KHR_gaussian_splatting` + `KHR_gaussian_splatting_compression_spz_2`）。CesiumJS 从 1.135 起正式使用这套扩展，1.130.1 的旧草案扩展 `KHR_spz_gaussian_splats_compression` 已被移除，旧数据需要重新切瓦片。本项目已升级到 Cesium 1.140，`Cesium3DTileset.fromUrl` 会自动识别并渲染，页面默认加载一份公开示例数据。',
  '性能上要看高斯数量：百万级高斯在桌面端尚可，移动端要谨慎；大场景必须分块 + LOD（按包围盒切块、远处用低分辨率块），并限制同时可见的块数，否则显存和排序开销都会爆。',
]

const blocks: CodeBlock[] = [
  {
    title: '先做版本检测',
    desc: '1.135 起改用 KHR_gaussian_splatting / SPZ2，版本过低会直接报扩展不支持',
    code: `// 高斯泼溅要求 CesiumJS >= 1.135
const [major, minor] = Cesium.VERSION.split('.').map(Number)
const supported = major > 1 || (major === 1 && minor >= 135)

if (!supported) {
  console.warn(\`当前 Cesium \${Cesium.VERSION} 不支持高斯泼溅，请升级到 1.135+\`)
  return
}

// 说明：高斯泼溅没有独立的 content type 常量。
// 3D Tiles 的 content 是 .glb，由 glTF 扩展声明：
//   KHR_gaussian_splatting
//   KHR_gaussian_splatting_compression_spz_2
// 因此只需判断版本，识别与解码交给 Cesium3DTileset.fromUrl。`,
  },
  {
    title: '加载高斯泼溅瓦片',
    desc: 'content 为 .glb（内含 KHR_gaussian_splatting），其余用法与普通 3D Tiles 一致',
    code: `// 1.135+：Cesium 内部按 glTF 扩展解析并渲染 splat
const splat = await Cesium.Cesium3DTileset.fromUrl(
  'https://your-host/splat/tileset.json',
  {
    maximumScreenSpaceError: 16, // 越小越清晰，LOD 切换更晚
    skipLevelOfDetail: true,
    preferLeaves: true,
    maximumMemoryUsage: 1024, // 高斯很吃显存，按设备调小
  },
)

viewer.scene.primitives.add(splat)

// 飞到数据范围
viewer.camera.flyToBoundingSphere(splat.boundingSphere, {
  duration: 1.5,
  offset: new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(30),
    Cesium.Math.toRadians(-20),
    splat.boundingSphere.radius * 2.5,
  ),
})`,
  },
  {
    title: '数据生产链路',
    desc: '训练 → 压缩 → 分块 → 3D Tiles，四步缺一不可',
    code: `# 1) 视频/照片 → 位姿（COLMAP）→ 3DGS 训练（如 gsplat / 官方实现）
#    产物：point_cloud.ply（含 xyz、scale、rot、opacity、SH）

# 2) 压缩：SPZ 把浮点参数编码成紧凑二进制，体积可降到 1/10 左右
#    工具：SuperSplat（浏览器内导出 .spz / .splat）

# 3) 大场景分块：按空间切块，每块单独训练或裁剪
#    推荐按 50~100 米网格切分，块之间保留重叠避免裂缝

# 4) 组织成 3D Tiles 1.1：tileset.json + 每块 content 为 .glb
#    glTF 内声明 KHR_gaussian_splatting（可叠加 SPZ2 压缩）
#    把 tileset.json 与 glb 放同域目录（或配置 CORS），再用上面的代码加载`,
  },
  {
    title: '显存控制与移除',
    desc: '高斯数量直接决定显存，隐藏不等于释放，切换场景要把 tileset 从 primitives 里移除',
    code: `// 只隐藏：仍在显存里，适合临时对比
splat.show = false

// 真正释放：从 primitives 移除，交由 Cesium 回收
viewer.scene.primitives.remove(splat)

// 观察显存：Cesium 内置性能面板
viewer.scene.debugShowFramesPerSecond = true
viewer.scene.postProcessStages.fxaa.enabled = true // 边缘更稳，代价很小`,
  },
]

const notes: NoteItem[] = [
  {
    title: '版本门槛是 1.135，不是 1.120',
    body: '`KHR_gaussian_splatting` 与 `KHR_gaussian_splatting_compression_spz_2` 从 1.133 引入、1.135 起成为唯一支持；旧的 `KHR_spz_gaussian_splats_compression` 已被删除。用旧工具切出的瓦片需要在 1.135+ 环境重新切分，否则会报扩展不支持。',
  },
  {
    title: '数据必须通过 HTTP 提供',
    body: '与 3D Tiles 一样，`file://` 下 XHR 会被拦截；`tileset.json` 与内容文件（`.glb`，内含 SPZ2 压缩）的相对路径、CORS 头都要正确。若瓦片服务器不支持 Range 请求，大文件首屏会明显变慢。',
  },
  {
    title: '高斯不能当量测与单体化数据',
    body: '3DGS 是粒子化表示，没有水密表面、没有构件语义，拾取只能落到整块内容。量测、坡度、淹没、构件属性请用点云、地形或带 batch table 的 3D Tiles。',
  },
  {
    title: '大场景必须分块 + LOD',
    body: '单个 tileset 塞几千万高斯会直接吃满显存并拖垮排序。实践上按 50~100 米分块、远处用降采样块，并限制 `maximumMemoryUsage`，配合 `skipLevelOfDetail` 控制首屏。',
  },
  {
    title: '与倾斜/地形叠加注意透明排序',
    body: '高斯是半透明混合，和地形、倾斜模型叠加时容易出现前后关系错误；尽量让高斯块不与其他透明对象重叠，或调整渲染顺序、缩小可见范围。',
  },
]
</script>

<template>
  <DemoPage
    hint="高斯泼溅：内置 Cesium 已升级到 1.140，默认填入一份公开示例瓦片，点击「加载」即可查看；也可以替换成自己的 tileset.json。"
    :home="HOME"
  >
    <template #panel>
      <GaussianPanel />
    </template>

    <template #guide>
      <GuidePanel
        class="code-pane"
        title="高斯泼溅（3DGS）"
        :intro="intro"
        :blocks="blocks"
        blocks-title="关键代码"
        guide-label="关键代码"
        :notes="notes"
        notes-tip="高斯泼溅的坑主要在版本、数据链路和显存，下面按接入顺序说明。"
      />
    </template>
  </DemoPage>
</template>
