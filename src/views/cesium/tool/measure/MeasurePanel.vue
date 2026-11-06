<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumMeasure, type MeasureMode } from '@/composables/useCesiumMeasure'
import { formatArea, formatDistance } from '@/utils/gis/coord'

const { state, start, clear } = useCesiumMeasure()

const modes: { key: MeasureMode; label: string }[] = [
  { key: 'distance', label: '距离' },
  { key: 'area', label: '面积' },
  { key: 'height', label: '高度' },
]

function pick(mode: MeasureMode) {
  if (state.mode === mode) return
  start(mode)
}
</script>

<template>
  <CesiumOverlay title="量算工具" class="absolute left-3 top-3 z-10" :width="256">
    <div class="flex items-center gap-2">
      <el-button
        v-for="m in modes"
        :key="m.key"
        v-permission="'gis:measure'"
        size="small"
        :type="state.mode === m.key ? 'primary' : 'default'"
        @click="pick(m.key)"
      >
        {{ m.label }}
      </el-button>
      <el-button size="small" plain @click="clear">清除</el-button>
    </div>

    <p class="tip">{{ state.mode ? '左键加点，双击或右键结束' : '选择一种量算方式开始' }}</p>

    <div v-if="state.mode === 'distance' || state.distance > 0" class="result">
      <span>总距离</span>
      <b>{{ formatDistance(state.distance) }}</b>
    </div>
    <div v-if="state.mode === 'area' || state.area > 0" class="result">
      <span>面积</span>
      <b>{{ formatArea(state.area) }}</b>
    </div>
    <div v-if="state.perimeter > 0" class="result">
      <span>周长</span>
      <b>{{ formatDistance(state.perimeter) }}</b>
    </div>
    <template v-if="state.mode === 'height' || state.height > 0">
      <div class="result"><span>高差</span><b>{{ state.height.toFixed(1) }} m</b></div>
      <div class="result"><span>水平距离</span><b>{{ formatDistance(state.horizontal) }}</b></div>
      <div class="result"><span>斜距</span><b>{{ formatDistance(state.slope) }}</b></div>
      <div class="result"><span>坡度角</span><b>{{ state.angle.toFixed(1) }}°</b></div>
    </template>

    <div v-if="state.points" class="points">拾取点：{{ state.points }}</div>
  </CesiumOverlay>
</template>

<style scoped>
.tip {
  margin: 10px 0 6px;
  color: #9ca3af;
  font-size: 12px;
}
.result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  border-top: 1px dashed #eef1f5;
  font-size: 12px;
  color: #6b7280;
}
.result b {
  color: #2563eb;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.points {
  margin-top: 8px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
