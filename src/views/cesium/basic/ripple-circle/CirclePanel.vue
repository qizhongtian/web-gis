<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 扩散圆：多个同心 Ellipse，半径与透明度由 CallbackProperty 按时间计算
 * 每层相位错开，形成一圈圈向外扩散并逐渐消失的波纹
 * 必须放在 <CesiumViewer> 的插槽里，才能通过 provide/inject 拿到 viewer
 */
const state = reactive({
  color: '#38bdf8',
  radius: 3000,
  duration: 3,
  count: 4,
  showCenter: true,
})

const viewerRef = shallowRef<any>()
const libRef = shallowRef<any>()
let entities: any[] = []

/** 每层波纹的归一化进度 0→1，相位错开 */
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
  const center = C.Cartesian3.fromDegrees(114.06, 22.32, 1)

  for (let i = 0; i < state.count; i++) {
    const phase = i / state.count
    // 半径：0 → radius 线性扩散
    const axis = new C.CallbackProperty(() => Math.max(1, state.radius * progress(phase)), false)

    entities.push(
      v.entities.add({
        position: center,
        ellipse: {
          semiMajorAxis: axis,
          semiMinorAxis: axis,
          height: 1,
          // 透明度：越往外越淡，扩散到边缘时完全消失
          material: new C.ColorMaterialProperty(
            new C.CallbackProperty(() => color.withAlpha((1 - progress(phase)) * 0.75), false),
          ),
        },
      }),
    )
  }

  if (state.showCenter) {
    entities.push(
      v.entities.add({
        position: center,
        point: {
          pixelSize: 10,
          color: C.Color.WHITE,
          outlineColor: color,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
  <CesiumOverlay title="扩散圆参数" class="absolute left-3 top-3 z-10" :width="280">
    <div class="row">
      <span>波纹颜色</span>
      <el-color-picker v-model="state.color" size="small" @change="build" />
    </div>

    <div class="slider-row">
      <span>最大半径</span>
      <el-slider v-model="state.radius" :min="500" :max="8000" :step="100" size="small" @change="build" />
      <b>{{ state.radius }}m</b>
    </div>

    <div class="slider-row">
      <span>扩散周期</span>
      <el-slider v-model="state.duration" :min="1" :max="8" :step="0.5" size="small" @change="build" />
      <b>{{ state.duration }}s</b>
    </div>

    <div class="slider-row">
      <span>波纹层数</span>
      <el-slider v-model="state.count" :min="1" :max="8" :step="1" size="small" @change="build" />
      <b>{{ state.count }}</b>
    </div>

    <div class="row">
      <span>显示中心点</span>
      <el-switch v-model="state.showCenter" size="small" @change="build" />
    </div>

    <p class="tip">实体只创建一次，半径与 alpha 由 CallbackProperty 在渲染帧里计算，不重建几何。</p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
