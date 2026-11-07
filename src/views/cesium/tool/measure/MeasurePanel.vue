<script setup lang="ts">
import { computed } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { type MeasureMode, useCesiumMeasure } from '@/composables/useCesiumMeasure'
import { useCesiumHkScene } from '@/composables/useCesiumHkScene'
import { formatArea, formatDistance } from '@/utils/gis/coord'

const { state, start, undo, clear } = useCesiumMeasure()

// 默认场景：香港影像 + 地形 + 倾斜摄影 + 香港视角
useCesiumHkScene()

const MODES: { key: MeasureMode, label: string }[] = [
  { key: 'distance', label: '测距' },
  { key: 'area', label: '测面' },
  { key: 'height', label: '测高' },
]

const chips = computed(() => {
  const s = state
  if (s.mode === 'distance') {
    return [
      { label: '总距离', value: formatDistance(s.distance) },
      { label: '分段', value: `${s.segments}` },
      { label: '节点', value: `${s.points}` },
    ]
  }
  if (s.mode === 'area') {
    return [
      { label: '面积', value: formatArea(s.area) },
      { label: '周长', value: formatDistance(s.perimeter) },
      { label: '节点', value: `${s.points}` },
    ]
  }
  if (s.mode === 'height') {
    return [
      { label: '高差', value: `${s.height.toFixed(1)} m` },
      { label: '水平距离', value: formatDistance(s.horizontal) },
      { label: '斜距', value: formatDistance(s.slope) },
      { label: '坡度', value: `${s.angle.toFixed(1)}°` },
    ]
  }
  return []
})
</script>

<template>
  <CesiumOverlay title="空间量算" class="absolute right-3 top-3 z-10" :width="268">
    <div class="row">
      <el-button
        v-for="m in MODES"
        :key="m.key"
        size="small"
        :type="state.mode === m.key ? 'primary' : 'default'"
        @click="start(m.key)"
      >
        {{ m.label }}
      </el-button>
    </div>

    <div class="row mt-2">
      <el-button size="small" plain :disabled="!state.points" @click="undo">撤销</el-button>
      <el-button size="small" plain :disabled="!state.points" @click="clear">清除</el-button>
    </div>

    <p class="tip">
      <template v-if="state.drawing">单击取点，双击结束</template>
      <template v-else-if="state.mode">量算已结束，可拖动圆点微调</template>
      <template v-else>选择模式后在地图上单击取点</template>
    </p>

    <div v-if="chips.length" class="metrics">
      <div v-for="c in chips" :key="c.label" class="metric">
        <span class="k">{{ c.label }}</span>
        <span class="v">{{ c.value }}</span>
      </div>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.row :deep(.el-button) {
  margin-left: 0;
}
.tip {
  margin: 10px 0 0;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.5;
}
.metrics {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px dashed #e6e8eb;
}
.metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
}
.metric:last-child {
  border-bottom: none;
}
.k {
  color: #6b7280;
}
.v {
  color: #1f2328;
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
</style>
