<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 扩散多边形：以中心点为原点建立局部 ENU 坐标系，
 * 顶点按 scale 放大后用 CallbackProperty 返回新的 PolygonHierarchy，多层错相位向外扩散
 * 必须放在 <CesiumViewer> 的插槽里，才能通过 provide/inject 拿到 viewer
 */
const CENTER: [number, number] = [114.16, 22.31]

const state = reactive({
  color: '#a78bfa',
  duration: 3.2,
  count: 3,
  maxScale: 2.4,
  shape: 'hexagon' as 'hexagon' | 'rect' | 'triangle',
})

const viewerRef = shallowRef<any>()
const libRef = shallowRef<any>()
let entities: any[] = []

/** 形状的局部米坐标（east, north），半径约 1200m */
function shapePoints(kind: typeof state.shape) {
  if (kind === 'rect') {
    return [
      [-900, -600],
      [900, -600],
      [900, 600],
      [-900, 600],
    ]
  }
  if (kind === 'triangle') {
    const r = 1300
    return Array.from({ length: 3 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 3 - Math.PI / 2
      return [Math.cos(a) * r, Math.sin(a) * r]
    })
  }
  const r = 1200
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
    return [Math.cos(a) * r, Math.sin(a) * r]
  })
}

/** 归一化进度，相位错开 */
function progress(phase: number) {
  return (performance.now() / 1000 / state.duration + phase) % 1
}

function clear() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) {
    entities = []
    return
  }
  entities.forEach((e) => v.entities.remove(e))
  entities = []
}

function build() {
  const v = viewerRef.value
  const C = libRef.value
  if (!v || !C || v.isDestroyed?.()) return
  clear()

  const color = C.Color.fromCssColorString(state.color)
  const center = C.Cartesian3.fromDegrees(CENTER[0], CENTER[1], 1)
  const enu = C.Transforms.eastNorthUpToFixedFrame(center)
  const base = shapePoints(state.shape)

  /** 按比例放大后转成世界坐标，返回闭合多边形顶点 */
  const scaled = (scale: number) => {
    const points = base.map(([east, north]) => {
      const local = new C.Cartesian3(east * scale, north * scale, 0)
      return C.Matrix4.multiplyByPoint(enu, local, new C.Cartesian3())
    })
    return new C.PolygonHierarchy(points)
  }

  // 本体：固定多边形，作为扩散的参照
  entities.push(
    v.entities.add({
      polygon: {
        hierarchy: scaled(1),
        height: 1,
        material: color.withAlpha(0.35),
        outline: true,
        outlineColor: color,
      },
    }),
  )

  // 波纹层：从 0.6 倍扩散到 maxScale，同时淡出
  for (let i = 0; i < state.count; i++) {
    const phase = i / state.count
    const hierarchy = new C.CallbackProperty(() => {
      const t = progress(phase)
      return scaled(0.6 + (state.maxScale - 0.6) * t)
    }, false)
    entities.push(
      v.entities.add({
        polygon: {
          hierarchy,
          height: 1,
          material: new C.ColorMaterialProperty(
            new C.CallbackProperty(() => color.withAlpha((1 - progress(phase)) * 0.45), false),
          ),
        },
      }),
    )
  }
}

onCesiumReady((v, C) => {
  viewerRef.value = v
  libRef.value = C
  build()
  return () => {
    clear()
    viewerRef.value = undefined
    libRef.value = undefined
  }
})
</script>

<template>
  <CesiumOverlay title="扩散多边形参数" class="absolute left-3 top-3 z-10" :width="286">
    <div class="row">
      <span>波纹颜色</span>
      <el-color-picker v-model="state.color" size="small" @change="build" />
    </div>

    <div class="row">
      <span>形状</span>
      <el-radio-group v-model="state.shape" size="small" @change="build">
        <el-radio-button value="hexagon">六边形</el-radio-button>
        <el-radio-button value="rect">矩形</el-radio-button>
        <el-radio-button value="triangle">三角</el-radio-button>
      </el-radio-group>
    </div>

    <div class="slider-row">
      <span>扩散周期</span>
      <el-slider v-model="state.duration" :min="1" :max="8" :step="0.2" size="small" @change="build" />
      <b>{{ state.duration }}s</b>
    </div>

    <div class="slider-row">
      <span>波纹层数</span>
      <el-slider v-model="state.count" :min="1" :max="6" :step="1" size="small" @change="build" />
      <b>{{ state.count }}</b>
    </div>

    <div class="slider-row">
      <span>放大倍数</span>
      <el-slider v-model="state.maxScale" :min="1.2" :max="4" :step="0.1" size="small" @change="build" />
      <b>{{ state.maxScale.toFixed(1) }}x</b>
    </div>

    <p class="tip">hierarchy 每帧重建，顶点在中心点的 ENU 坐标系里按米缩放，避免经纬度缩放带来的形变。</p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.slider-row {
  display: grid;
  grid-template-columns: 62px 1fr 48px;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tip {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  color: #9ca3af;
  font-size: 10px;
  line-height: 1.6;
}
</style>
