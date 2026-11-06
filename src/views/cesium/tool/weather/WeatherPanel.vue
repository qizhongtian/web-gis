<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumWeather, type WeatherKey } from '@/composables/useCesiumWeather'

const weather = useCesiumWeather()
const { state } = weather

const effects: { key: WeatherKey; label: string; desc: string }[] = [
  { key: 'rain', label: '下雨', desc: '粒子系统 + 相机跟随' },
  { key: 'snow', label: '下雪', desc: '慢速飘落粒子' },
  { key: 'fog', label: '雾霾', desc: 'scene.fog 密度' },
  { key: 'cloud', label: '云层', desc: '大尺寸云粒子' },
  { key: 'lightning', label: '闪电', desc: '大气亮度闪烁' },
  { key: 'sand', label: '沙尘', desc: '横向风场粒子' },
  { key: 'night', label: '夜景', desc: '地表光照 + 大气压暗' },
]

function onIntensity(value: number | number[]) {
  weather.applyIntensity(Number(Array.isArray(value) ? value[0] : value))
}

function onFogDensity(value: number | number[]) {
  weather.applyFogDensity(Number(Array.isArray(value) ? value[0] : value))
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
        <span>雨雪强度</span>
        <el-slider :model-value="state.intensity" :min="0.2" :max="2" :step="0.1" size="small" @update:model-value="onIntensity" />
      </div>
      <div class="slider-row">
        <span>雾浓度</span>
        <el-slider :model-value="state.fogDensity" :min="0.0002" :max="0.005" :step="0.0002" size="small" @update:model-value="onFogDensity" />
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
