<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesium } from '@/composables/useCesium'
import { useCesiumModel, type ModelOptions } from '@/composables/useCesiumModel'

const DEFAULT_URL = '/data/models/Duck.glb'

const viewer = useCesium()
const model = useCesiumModel()
const url = ref(DEFAULT_URL)

function load() {
  if (!url.value) return ElMessage.warning('请输入 glTF / GLB 地址')
  model.load(url.value)
}

function setOpt<K extends keyof ModelOptions>(key: K, value: number | boolean) {
  model.update({ [key]: value } as Partial<ModelOptions>)
}

function zoom() {
  const v = viewer.value
  if (v) v.flyTo(v.entities, { duration: 1 })
}

onCesiumReady(() => {
  model.load(DEFAULT_URL)
})
</script>

<template>
  <CesiumOverlay title="glTF / GLB 模型" class="absolute left-3 top-3 z-10" :width="300">
    <el-input v-model="url" size="small" placeholder="模型地址 (.glb / .gltf)" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="model.loading.value" @click="load">加载</el-button>
      <el-button size="small" :disabled="!model.loaded.value" @click="zoom">定位</el-button>
      <el-button size="small" plain :disabled="!model.loaded.value" @click="model.remove()">移除</el-button>
    </div>

    <p v-if="model.error.value" class="error">{{ model.error.value }}</p>

    <div class="grid">
      <span>经度</span>
      <el-input-number :model-value="model.options.lon" :precision="5" :step="0.001" size="small" controls-position="right" @change="(v) => setOpt('lon', Number(v))" />
      <span>纬度</span>
      <el-input-number :model-value="model.options.lat" :precision="5" :step="0.001" size="small" controls-position="right" @change="(v) => setOpt('lat', Number(v))" />
      <span>高度</span>
      <el-input-number :model-value="model.options.height" :step="10" size="small" controls-position="right" @change="(v) => setOpt('height', Number(v))" />
    </div>

    <div class="sliders">
      <div class="slider-row">
        <span>朝向</span>
        <el-slider :model-value="model.options.heading" :min="0" :max="360" :step="1" size="small" @update:model-value="(v) => setOpt('heading', Number(v))" />
        <b>{{ Math.round(model.options.heading) }}°</b>
      </div>
      <div class="slider-row">
        <span>俯仰</span>
        <el-slider :model-value="model.options.pitch" :min="-90" :max="90" :step="1" size="small" @update:model-value="(v) => setOpt('pitch', Number(v))" />
        <b>{{ Math.round(model.options.pitch) }}°</b>
      </div>
      <div class="slider-row">
        <span>翻滚</span>
        <el-slider :model-value="model.options.roll" :min="-180" :max="180" :step="1" size="small" @update:model-value="(v) => setOpt('roll', Number(v))" />
        <b>{{ Math.round(model.options.roll) }}°</b>
      </div>
      <div class="slider-row">
        <span>缩放</span>
        <el-slider :model-value="model.options.scale" :min="0.2" :max="5" :step="0.1" size="small" @update:model-value="(v) => setOpt('scale', Number(v))" />
        <b>×{{ model.options.scale.toFixed(1) }}</b>
      </div>
      <div class="slider-row">
        <span>最小像素</span>
        <el-slider :model-value="model.options.minimumPixelSize" :min="0" :max="256" :step="8" size="small" @update:model-value="(v) => setOpt('minimumPixelSize', Number(v))" />
        <b>{{ model.options.minimumPixelSize }}</b>
      </div>
    </div>

    <div class="switch-row">
      <span>轮廓高亮</span>
      <el-switch :model-value="model.options.silhouette" size="small" @update:model-value="(v) => setOpt('silhouette', !!v)" />
    </div>

    <p class="hint">
      使用 <b>Entity.model</b> 承载：位置与 <b>headingPitchRollQuaternion</b> 朝向均由响应式参数驱动，卸载时随实体一并移除。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.grid {
  display: grid;
  grid-template-columns: 36px 1fr;
  align-items: center;
  gap: 6px 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.grid :deep(.el-input-number) {
  width: 100%;
}
.sliders {
  margin-top: 8px;
}
.slider-row {
  display: grid;
  grid-template-columns: 52px 1fr 44px;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.slider-row b {
  color: #2563eb;
  font-weight: 500;
  font-size: 11px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.hint,
.error {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.5;
}
.hint {
  color: #9ca3af;
}
.hint b {
  color: #6b7280;
}
.error {
  color: #ef4444;
}
</style>
