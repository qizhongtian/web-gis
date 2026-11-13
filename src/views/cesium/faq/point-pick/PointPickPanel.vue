<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { assetUrl } from '@/utils/publicUrl'

/**
 * 常见问题：BillboardCollection / LabelCollection 建好之后，
 * 点击某个点时只改这一条的属性（换图标 / 换颜色），不重建集合。
 *
 * 关键点：
 *   1) add 时把下标塞进 id，pick 回来直接知道是第几个，不用另维护索引表
 *   2) 场景里有 3D Tiles 时 scene.pick 常被建筑挡住，用 drillPick 只认自己的点
 *   3) 换 image 走纹理图集，改 color 只更新顶点颜色；两者开销不同
 *   4) setter 内部只把该条标脏，下一帧只重建它自己的顶点
 */

type PickMode = 'image' | 'tint'

/** public/image 下的图钉（跳过不存在的 map-pin-01） */
const IMAGE_URLS = [0, ...Array.from({ length: 23 }, (_, i) => i + 2)].map(
  (n) => assetUrl(`image/map-pin-${String(n).padStart(2, '0')}.png`),
)
/** 选中时换的贴图：固定用最后一张，和「只改 color」形成对照 */
const SELECT_IMAGE = IMAGE_URLS[IMAGE_URLS.length - 1]

const NAME_POOL = ['维港', '中环', '尖沙咀', '铜锣湾', '旺角', '深水埗', '观塘', '沙田']

const COUNT = 320
const ICON_SIZE = 32

const pickMode = ref<PickMode>('image')
const selected = ref(-1)
const selectedName = computed(() => (selected.value >= 0 ? texts[selected.value] : ''))

let viewer: any = null
let C: any = null
let collection: any = null
let labels: any = null
let positions: any[] = []
let texts: string[] = []
let baseImages: string[] = []
let labelFill: any = null
let labelOutline: any = null
let selectFill: any = null
let selectTint: any = null
let clickHandler: any = null

/* ---------------- 随机点位（确定性，每次进来位置一样） ---------------- */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildPositions(n: number) {
  const rnd = mulberry32(20261112)
  const list: any[] = []
  for (let i = 0; i < n; i++) {
    // 港岛 + 九龙一带撒点
    const lon = 114.11 + rnd() * 0.16
    const lat = 22.26 + rnd() * 0.14
    list.push(C.Cartesian3.fromDegrees(lon, lat, 0))
  }
  return list
}

function buildTexts(n: number) {
  return Array.from({ length: n }, (_, i) => `${NAME_POOL[i % NAME_POOL.length]}-${i + 1}`)
}

/* ---------------- 建集合 ---------------- */
function rebuild() {
  if (!viewer || !C) return

  if (!labelFill) {
    labelFill = C.Color.fromCssColorString('#ffffff')
    labelOutline = C.Color.fromCssColorString('#0f172a')
    selectFill = C.Color.fromCssColorString('#fde047')
    selectTint = C.Color.fromCssColorString('#ef4444')
  }

  positions = buildPositions(COUNT)
  texts = buildTexts(COUNT)

  if (!collection) {
    collection = new C.BillboardCollection()
    viewer.scene.primitives.add(collection)
  }
  collection.removeAll()

  const height = Math.round(ICON_SIZE * 1.3)
  baseImages = new Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const url = IMAGE_URLS[i % IMAGE_URLS.length]
    baseImages[i] = url
    collection.add({
      position: positions[i],
      image: url,
      width: ICON_SIZE,
      height,
      // 关键：id 带个标记，pick 时一眼认出是自己的点，还能直接拿到下标
      id: { pick: i },
      // 针尖落在点位上，之后放大缩小底部不动
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
  }

  if (!labels) {
    labels = new C.LabelCollection()
    viewer.scene.primitives.add(labels)
  }
  labels.removeAll()
  for (let i = 0; i < COUNT; i++) {
    labels.add({
      position: positions[i],
      text: texts[i],
      // 和 billboard 用同一个下标：点到文字也能定位到点
      id: { pick: i },
      font: '600 12px "Microsoft YaHei", sans-serif',
      fillColor: labelFill,
      outlineColor: labelOutline,
      outlineWidth: 2,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: C.HorizontalOrigin.CENTER,
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      pixelOffset: new C.Cartesian2(0, -height - 2),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
  }

  // 集合重建后实例全换了，之前的选中态作废
  selected.value = -1
  viewer.scene.requestRender()
}

/* ---------------- 只改被点中的那一条 ---------------- */
function resetOne(i: number) {
  if (!collection || i < 0 || i >= collection.length) return
  const bb = collection.get(i)
  bb.image = baseImages[i]
  bb.color = C.Color.WHITE // setter 内部 clone，传共享常量是安全的
  bb.scale = 1
  if (labels && i < labels.length) labels.get(i).fillColor = labelFill
}

function selectOne(i: number) {
  if (!collection || i < 0 || i >= collection.length) return
  if (selected.value >= 0) resetOne(selected.value)
  selected.value = i

  const bb = collection.get(i)
  // 先退回原始贴图：从「换贴图」切到「只改 color」时不会带着上一张图
  bb.image = baseImages[i]
  if (pickMode.value === 'image') {
    // 换贴图：新图要进 textureAtlas，换得多了会触发图集扩容，比改 color 贵
    bb.image = baseImages[i] === SELECT_IMAGE ? IMAGE_URLS[0] : SELECT_IMAGE
  } else {
    // 只改 color：纯顶点颜色更新，贴图不动（白底图 tint 出来才准）
    bb.color = selectTint
  }
  // 和 scaleByDistance 相乘，不影响别处
  bb.scale = 1.3
  if (labels && i < labels.length) labels.get(i).fillColor = selectFill
  viewer.scene.requestRender()
}

function clearSelection() {
  if (selected.value < 0) return
  resetOne(selected.value)
  selected.value = -1
  viewer.scene.requestRender()
}

function onClick(movement: any) {
  if (!viewer || !C || !collection) return
  // 场景里还有倾斜摄影 3D Tiles：scene.pick 常先命中建筑，
  // 所以用 drillPick 把所有层取出来，只挑自己集合里的那一条
  const results = viewer.scene.drillPick(movement.position, 8)
  const hit = results.find((r: any) => r.id && typeof r.id === 'object' && typeof r.id.pick === 'number')
  if (!hit) {
    clearSelection()
    return
  }
  // 再点一次同一条 = 取消选中
  if (hit.id.pick === selected.value) clearSelection()
  else selectOne(hit.id.pick)
}

// 切换「换贴图 / 只改 color」时，把已选中的点按新模式重画一遍
watch(pickMode, () => {
  if (selected.value >= 0) selectOne(selected.value)
})

function flyHome() {
  if (!viewer || !C) return
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(114.17, 22.32, 7000),
    orientation: { heading: 0, pitch: C.Math.toRadians(-55), roll: 0 },
    duration: 1.2,
  })
}

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  rebuild()

  // 独立 handler：不动 viewer.screenSpaceEventHandler，避免覆盖别的面板的 LEFT_CLICK
  clickHandler = new C.ScreenSpaceEventHandler(v.scene.canvas)
  clickHandler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK)

  return () => {
    clickHandler?.destroy()
    clickHandler = null
    if (v.isDestroyed?.()) return
    if (labels) v.scene.primitives.remove(labels)
    if (collection) v.scene.primitives.remove(collection)
    labels = null
    collection = null
    positions = []
    texts = []
    baseImages = []
    selected.value = -1
    labelFill = null
    labelOutline = null
    selectFill = null
    selectTint = null
    viewer = null
    C = null
  }
})

onBeforeUnmount(() => {
  clickHandler?.destroy()
  clickHandler = null
})
</script>

<template>
  <CesiumOverlay class="point-pick-panel" title="点中某条：只改这一条" :width="300">
    <p class="tip">
      点地图上的图钉选中，再点一次或点空白取消。只改被点中的那条 <code>Billboard</code> /
      <code>Label</code>，不重建集合。
    </p>

    <div class="row">
      <span class="row-label">点击效果</span>
      <el-radio-group v-model="pickMode" size="small" class="ctl">
        <el-radio-button value="image">换贴图</el-radio-button>
        <el-radio-button value="tint">只改 color</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="row-label">选中</span>
      <span class="val">
        <b v-if="selectedName">{{ selectedName }}</b>
        <span v-else class="dim">无</span>
        <em v-if="selected >= 0">#{{ selected }}</em>
      </span>
    </div>

    <div class="btns">
      <el-button size="small" :disabled="selected < 0" @click="clearSelection">取消选中</el-button>
      <el-button size="small" type="primary" plain @click="flyHome">回到初始视角</el-button>
    </div>

    <p class="meta-line">
      换贴图 = 往 textureAtlas 里分配一张图；只改 color = 只更新顶点颜色。
      两者 setter 都只把这一条标脏，下一帧只重建它的顶点，和集合里有多少点无关。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.point-pick-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  max-height: calc(100% - 24px);
}
.tip {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
}
.tip code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.1);
  font-size: 11px;
  color: #2563eb;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.row-label {
  flex: none;
  width: 62px;
  font-size: 12px;
  color: #334155;
}
.ctl {
  flex: 1;
  min-width: 0;
}
.val {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #0f172a;
}
.val em {
  font-style: normal;
  font-size: 11px;
  color: #94a3b8;
}
.dim {
  color: #94a3b8;
}
.btns {
  display: flex;
  gap: 8px;
  margin: 10px 0 6px;
}
.meta-line {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #64748b;
}
</style>
