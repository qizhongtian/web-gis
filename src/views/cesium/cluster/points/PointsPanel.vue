<script setup lang="ts">
import { ref } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumPoints, type PointStyle } from '@/composables/useCesiumPoints'

const points = useCesiumPoints()
const count = ref(300)

function generate() {
  points.generate(count.value)
}

function setStyle<K extends keyof PointStyle>(key: K, value: PointStyle[K]) {
  points.setStyle({ [key]: value } as Partial<PointStyle>)
}

onCesiumReady(() => {
  points.generate(count.value)
})
</script>

<template>
  <CesiumOverlay title="点位与聚合" class="absolute left-3 top-3 z-10" :width="280">
    <div class="row">
      <span class="label">数量</span>
      <el-input-number v-model="count" :min="0" :max="3000" :step="100" size="small" controls-position="right" class="flex-1" />
      <el-button size="small" type="primary" @click="generate">生成</el-button>
      <el-button size="small" plain :disabled="!points.points.value.length" @click="points.generate(0)">清空</el-button>
    </div>

    <div class="row">
      <span class="label">图标</span>
      <el-radio-group :model-value="points.style.icon" size="small" @update:model-value="(v) => setStyle('icon', v as PointStyle['icon'])">
        <el-radio-button value="pin">图钉</el-radio-button>
        <el-radio-button value="circle">圆点</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="label">颜色</span>
      <el-color-picker :model-value="points.style.color" size="small" @change="(v) => setStyle('color', String(v || '#2563eb'))" />
      <span class="value">{{ points.style.color }}</span>
    </div>

    <div class="slider-row">
      <span class="label">大小</span>
      <el-slider :model-value="points.style.size" :min="12" :max="56" :step="2" size="small" @update:model-value="(v) => setStyle('size', Number(v))" />
      <b>{{ points.style.size }}</b>
    </div>

    <div class="row">
      <span class="label">标注</span>
      <el-switch :model-value="points.style.showLabel" size="small" @update:model-value="(v) => setStyle('showLabel', !!v)" />
    </div>

    <div class="row cluster-row">
      <span class="label">聚合</span>
      <el-switch :model-value="points.style.cluster" size="small" @update:model-value="(v) => setStyle('cluster', !!v)" />
    </div>
    <div class="slider-row" :class="{ disabled: !points.style.cluster }">
      <span class="label">聚合半径</span>
      <el-slider
        :model-value="points.style.clusterRange"
        :min="20"
        :max="120"
        :step="4"
        size="small"
        :disabled="!points.style.cluster"
        @update:model-value="(v) => setStyle('clusterRange', Number(v))"
      />
      <b>{{ points.style.clusterRange }}</b>
    </div>

    <p class="hint">
      当前 <b>{{ points.points.value.length }}</b> 个点位，使用 <b>CustomDataSource</b> 承载，聚合由
      <b>EntityCluster</b> 统一开合。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.row.cluster-row {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.label {
  flex: 0 0 44px;
  color: #6b7280;
  font-size: 12px;
}
.value {
  font-size: 11px;
  color: #9ca3af;
}
.slider-row {
  display: grid;
  grid-template-columns: 44px 1fr 30px;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.slider-row.disabled {
  opacity: 0.5;
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
