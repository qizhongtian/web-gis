<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumTrackPlayback } from '@/composables/useCesiumTrackPlayback'
import { formatDistance } from '@/utils/gis/coord'

const track = useCesiumTrackPlayback()

onCesiumReady(() => {
  track.load()
})

function onSeek(value: number | number[]) {
  track.seek(Number(Array.isArray(value) ? value[0] : value))
}
</script>

<template>
  <CesiumOverlay title="轨迹回放" class="absolute left-3 top-3 z-10" :width="288">
    <div class="info">
      <div><span>轨迹长度</span><b>{{ formatDistance(track.distance.value) }}</b></div>
      <div><span>时间轴</span><b>{{ track.duration.value }} s</b></div>
      <div><span>轨迹点</span><b>{{ track.pointCount.value }}</b></div>
    </div>

    <div class="controls">
      <el-button size="small" type="primary" @click="track.toggle()">
        {{ track.playing.value ? '暂停' : '播放' }}
      </el-button>
      <el-button size="small" plain @click="track.restart()">重新播放</el-button>
    </div>

    <div class="slider-row">
      <span>进度</span>
      <el-slider
        :model-value="track.progress.value"
        :min="0"
        :max="1"
        :step="0.001"
        size="small"
        @update:model-value="onSeek"
      />
      <b>{{ Math.round(track.progress.value * 100) }}%</b>
    </div>

    <div class="slider-row">
      <span>倍速</span>
      <el-slider
        :model-value="track.speed.value"
        :min="1"
        :max="50"
        :step="1"
        size="small"
        @update:model-value="(v) => track.applySpeed(Number(v))"
      />
      <b>×{{ track.speed.value }}</b>
    </div>

    <p class="hint">
      位置使用 <b>SampledPositionProperty</b> 按距离插值，时间轴由 <b>viewer.clock</b> 驱动，
      尾部光带由 <b>path.trailTime</b> 自动生成。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.info div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.info b {
  color: #1f2328;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.controls {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.controls :deep(.el-button) {
  margin-left: 0;
}
.slider-row {
  display: grid;
  grid-template-columns: 30px 1fr 38px;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
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
.hint {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 10px;
  line-height: 1.5;
  color: #9ca3af;
}
.hint b {
  color: #6b7280;
}
</style>
