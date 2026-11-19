<script setup lang="ts">
import { ref } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumModel } from '@/composables/useCesiumModel'
import { assetUrl } from '@/utils/publicUrl'

const { options, loading, error, loaded, load, remove, update } = useCesiumModel()

const url = ref(assetUrl('data/models/Duck.glb'))

const presets = [
  { label: 'Duck', url: assetUrl('data/models/Duck.glb') },
  { label: 'Milk Truck', url: assetUrl('data/models/CesiumMilkTruck.glb') },
]

function doLoad() {
  if (!url.value.trim()) return
  void load(url.value.trim())
}

function usePreset(presetUrl: string) {
  url.value = presetUrl
  void load(presetUrl)
}

function onNumber(key: 'lon' | 'lat' | 'height' | 'heading' | 'pitch' | 'roll' | 'scale' | 'minimumPixelSize', value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return
  update({ [key]: value } as any)
}
</script>

<template>
  <CesiumOverlay title="模型加载（glTF / GLB）" class="absolute left-3 top-3 z-10" :width="330">
    <el-input v-model="url" size="small" placeholder="glTF / GLB 地址" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="loading" @click="doLoad">加载</el-button>
      <el-button size="small" plain :disabled="!loaded" @click="remove">移除</el-button>
    </div>

    <div class="presets">
      <span>示例</span>
      <button v-for="item in presets" :key="item.label" type="button" class="preset" @click="usePreset(item.url)">
        {{ item.label }}
      </button>
    </div>

    <div class="grid">
      <label><span>经度</span><el-input-number v-model="options.lon" size="small" :controls="false" :precision="4" @change="(v) => onNumber('lon', v as number)" /></label>
      <label><span>纬度</span><el-input-number v-model="options.lat" size="small" :controls="false" :precision="4" @change="(v) => onNumber('lat', v as number)" /></label>
      <label><span>高度 m</span><el-input-number v-model="options.height" size="small" :controls="false" @change="(v) => onNumber('height', v as number)" /></label>
      <label><span>缩放</span><el-input-number v-model="options.scale" size="small" :step="0.1" :min="0.01" @change="(v) => onNumber('scale', v as number)" /></label>
      <label><span>朝向 °</span><el-input-number v-model="options.heading" size="small" :step="15" @change="(v) => onNumber('heading', v as number)" /></label>
      <label><span>俯仰 °</span><el-input-number v-model="options.pitch" size="small" :step="15" @change="(v) => onNumber('pitch', v as number)" /></label>
    </div>

    <div class="row">
      <span>最小像素</span>
      <el-slider
        :model-value="options.minimumPixelSize"
        :min="0"
        :max="128"
        :step="8"
        size="small"
        @update:model-value="(v) => onNumber('minimumPixelSize', Number(Array.isArray(v) ? v[0] : v))"
      />
      <b>{{ options.minimumPixelSize }}</b>
    </div>

    <div class="row">
      <span>轮廓高亮</span>
      <el-switch
        :model-value="options.silhouette"
        size="small"
        @update:model-value="(v) => update({ silhouette: !!v })"
      />
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p class="hint">
      glTF 使用 Y-up、单位米；放到地球上是 ENU 局部坐标，朝向用 <b>HeadingPitchRoll</b>，不要让模型坐标直接当地心坐标用。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.actions,
.presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.presets span {
  color: #9ca3af;
  font-size: 11px;
}
.preset {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  font-size: 11px;
  cursor: pointer;
}
.preset:hover {
  border-color: #93c5fd;
  color: #2563eb;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  margin-top: 8px;
}
.grid label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}
.grid label span {
  flex: none;
}
.grid :deep(.el-input-number) {
  width: 100%;
}
.row {
  display: grid;
  grid-template-columns: 58px 1fr 30px;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.row :deep(.el-slider) {
  margin: 0;
}
.row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
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
  word-break: break-all;
}
</style>
