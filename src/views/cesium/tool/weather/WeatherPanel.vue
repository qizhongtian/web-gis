<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumHkScene } from '@/composables/useCesiumHkScene'
import { useCesiumWeather, type WeatherKey } from '@/composables/useCesiumWeather'

const weather = useCesiumWeather()
const { state } = weather

// 与空间量算页一致的默认场景：香港影像 + 地形 + 倾斜摄影 + 倾斜视角
useCesiumHkScene()

const effects: { key: WeatherKey; label: string; desc: string }[] = [
  { key: 'rain', label: '下雨', desc: '雨滴下落 + 风向偏移' },
  { key: 'snow', label: '下雪', desc: '六角雪花 + 漂摆下落' },
  { key: 'fog', label: '雾霾', desc: '雾幕着色器 + scene.fog' },
  { key: 'cloud', label: '云层', desc: '双层 FBM 噪声云' },
  { key: 'lightning', label: '闪电', desc: '随机双闪 + 冷白提亮' },
  { key: 'sand', label: '沙尘', desc: '风场条纹 + 暖色沙幕' },
  { key: 'night', label: '夜景', desc: '冷色映射 + 暗角' },
]

function onIntensity(value: number | number[]) {
  weather.applyIntensity(Number(Array.isArray(value) ? value[0] : value))
}

function onFogDensity(value: number | number[]) {
  weather.applyFogDensity(Number(Array.isArray(value) ? value[0] : value))
}

function onCloudCover(value: number | number[]) {
  weather.applyCloudCover(Number(Array.isArray(value) ? value[0] : value))
}
</script>

<template>
  <CesiumOverlay title="天气与环境" class="absolute left-3 top-3 z-10" :width="268">
    <div class="effect-list">
      <div v-for="e in effects" :key="e.key" class="effect-row">
        <div class="effect-text">
          <span class="name">{{ e.label }}</span>
          <span class="desc">{{ e.desc }}</span>
        </div>
        <el-switch :model-value="state[e.key]" size="small" @update:model-value="(v) => weather.set(e.key, !!v)" />
      </div>
    </div>

    <div class="sliders">
      <div class="slider-row">
        <span>雨雪强度 · 大小/疏密</span>
        <el-slider :model-value="state.intensity" :min="0.2" :max="2" :step="0.1" size="small" @update:model-value="onIntensity" />
      </div>
      <div class="slider-row">
        <span>雾浓度</span>
        <el-slider :model-value="state.fogDensity" :min="0.0002" :max="0.005" :step="0.0002" size="small" @update:model-value="onFogDensity" />
      </div>
      <div class="slider-row">
        <span>云量</span>
        <el-slider :model-value="state.cloudCover" :min="0.05" :max="1" :step="0.05" size="small" @update:model-value="onCloudCover" />
      </div>
    </div>

    <el-button class="mt-1" size="small" plain style="width: 100%" @click="weather.reset()">全部关闭</el-button>
  </CesiumOverlay>
</template>

<style scoped>
.effect-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.effect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.effect-text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.name {
  font-size: 12px;
  color: #1f2328;
}
.desc {
  font-size: 10px;
  color: #9ca3af;
}
.sliders {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.slider-row {
  font-size: 12px;
  color: #6b7280;
}
.slider-row :deep(.el-slider) {
  margin: 0 8px 2px;
}
</style>
