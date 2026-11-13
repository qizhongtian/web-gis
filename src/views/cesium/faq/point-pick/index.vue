<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GuidePanel from '@/components/GuidePanel.vue'
import type { NoteItem } from '@/components/GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import { DEFAULT_IMAGERY_MAX_LEVEL, DEFAULT_IMAGERY_URL } from '@/utils/gis/cesiumConfig'
import PointPickPanel from './PointPickPanel.vue'

const HOME: [number, number, number] = [114.17, 22.32, 7000]

const blocks: CodeBlock[] = [
  {
    title: 'add 时把下标塞进 id，pick 回来就知道是第几个',
    desc: '比"遍历集合按位置反查"快得多，也不用额外维护一张索引表',
    code: `// BillboardCollection / LabelCollection 都支持 id
// id 带个标记对象：场景里可能有别的 primitive，靠标记认出自己的点
const bb = collection.add({
  position,
  image: '/image/map-pin-02.png',
  id: { pick: i },
  verticalOrigin: C.VerticalOrigin.BOTTOM,
})

// label 用同一个下标：点到文字也能定位到点
labels.add({ position, text, id: { pick: i }, ... })`,
  },
  {
    title: '点击：drillPick 只认自己的集合',
    desc: 'scene.pick 只返回最上面那一个，场景里有 3D Tiles 时经常先命中建筑',
    code: `const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas)

handler.setInputAction((m) => {
  // pick：只取最前一层 → 建筑盖住图钉时拿到的是 Tileset
  // drillPick：按深度把所有层都取出来，再挑自己的
  const results = viewer.scene.drillPick(m.position, 8)
  const hit = results.find((r) => r.id && typeof r.id.pick === 'number')

  if (!hit) {
    clearSelection()   // 点空白：取消选中
    return
  }
  // 再点同一条 = 取消
  hit.id.pick === selected ? clearSelection() : selectOne(hit.id.pick)
}, C.ScreenSpaceEventType.LEFT_CLICK)

// 卸载时务必 destroy，否则 canvas 上的 handler 泄漏
onBeforeUnmount(() => handler.destroy())`,
  },
  {
    title: '选中：只改这一条的属性，两种改法',
    desc: '换 image 走纹理图集，改 color 只更新顶点颜色；都由 setter 把该条标脏',
    code: `function selectOne(i) {
  const bb = collection.get(i)   // 直接拿实例，不用 removeAll

  if (mode === 'image') {
    // 换贴图：新图要进 textureAtlas，换的图多了会触发图集扩容
    bb.image = '/image/map-pin-24.png'
  } else {
    // 只改 color：纯顶点颜色更新，最便宜；白底贴图 tint 出来才准
    bb.color = C.Color.fromCssColorString('#ef4444')
  }

  bb.scale = 1.3   // 和 scaleByDistance 相乘，不影响近大远小

  // label 只换颜色，别改 text（改 text 要重新排字形）
  labels.get(i).fillColor = C.Color.fromCssColorString('#fde047')

  viewer.scene.requestRender()   // 非连续渲染时手动请求一帧
}`,
  },
  {
    title: '取消选中要还原，大量高亮别逐条改',
    desc: '换图模式下 image 已被改掉，原始贴图要自己缓存；几千条同时高亮用双集合更划算',
    code: `// 建集合时把原始贴图存一份
baseImages[i] = url

function resetOne(i) {
  const bb = collection.get(i)
  bb.image = baseImages[i]      // 还原原始贴图
  bb.color = C.Color.WHITE      // tint 清掉
  bb.scale = 1
  labels.get(i).fillColor = labelFill
}

// 改 1 条是 O(1)；改 5000 条就是 5000 次 dirty，和重建差不多。
// 大量点同时高亮，更彻底的做法是：
//   常态 / 选中态各建一个 collection，靠 show 切换，
//   一次 setter 换整套，不用逐条改。`,
  },
]

const notes: NoteItem[] = [
  {
    title: '用 drillPick，不用 pick',
    body: '`scene.pick` 只返回最上层对象，被别的模型挡住时拿到的是"挡路的那个"；`scene.drillPick(position)` 返回按深度排好的列表，再按 id 里的标记过滤出自己的集合。',
  },
  {
    title: '下标塞进 id，别遍历反查',
    body: '`id: { type: "point", index: i }`，pick 回来直接 `collection.get(index)`，O(1)；按位置反查要遍历几千条，点击都会有延迟感。',
  },
  {
    title: '选中只改这一条的属性',
    body: '`collection.get(i).image / color / scale` 这类 setter 只把这一条标脏；但一次改 5000 条就是 5000 次 dirty，耗时和重建集合差不多。',
  },
  {
    title: '取消选中要还原',
    body: '换贴图模式下原图已经被覆盖，必须建集合时缓存 `baseImages[i]`；否则取消选中后图钉回不去，只能整组重建。',
  },
  {
    title: '事件处理器记得销毁',
    body: '`ScreenSpaceEventHandler` 不 `destroy()` 的话，离开页面后点击地球还在响应，控制台也会报空引用。',
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>
          <code>BillboardCollection</code> / <code>LabelCollection</code> 建好之后，仍然可以逐条改属性：
          点图钉 →<code>collection.get(i)</code> → 改 <code>image</code> / <code>color</code> /
          <code>scale</code>，setter 只把这一条标脏。左上角可切换「换贴图 / 只改 color」对比两种改法的区别。
        </span>
      </div>
      <CesiumViewer
        class="map"
        :home="HOME"
        :imagery-url="DEFAULT_IMAGERY_URL"
        :imagery-max-level="DEFAULT_IMAGERY_MAX_LEVEL"
      >
        <PointPickPanel />
      </CesiumViewer>
    </section>

    <GuidePanel
      class="code-pane"
      title="实现要点"
      :blocks="blocks"
      blocks-title="关键代码"
      guide-label="关键代码"
      :notes="notes"
      notes-tip="以下是拾取与逐条改属性最容易踩的几处，按「先点中、再改对、再收尾」的顺序整理。"
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
