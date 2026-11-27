<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import CesiumViewer from '@/components/CesiumViewer.vue'
import { DEFAULT_IMAGERY_URL, HK_POINT_CLAMP_HOME } from '@/utils/gis/cesiumConfig'

import HKTrafficPanel, { type LayerToggles } from './HKTrafficPanel.vue'
import HKTrafficGlobe from './HKTrafficGlobe.vue'
import type { PickedEntityInfo } from './types'
import type { WeatherWarning } from './feed'

// ── 状态 ──────────────────────────────────────────────────────────────────
const layerState = reactive<LayerToggles>({
  mtr: true, lightRail: true, centerlines: true, ferryPiers: true, evChargers: true,
  citybus: false, kmb: false, nlb: false, gmb: false, lwb: false, roadPoints: false,
})

const lastUpdated = ref('')
const loading = ref(false)
const ready = ref(false)

const popupVisible = ref(false)
const popupInfo = ref<PickedEntityInfo | null>(null)
const popupPos = reactive({ x: 0, y: 0 })

const weatherWarnings = ref<WeatherWarning[]>([])

const globeRef = ref<InstanceType<typeof HKTrafficGlobe> | null>(null)

// ── 交互 ──────────────────────────────────────────────────────────────────
function refresh() { globeRef.value?.reload() }
function onLayerToggle<K extends keyof LayerToggles>(key: K, value: LayerToggles[K]) { layerState[key] = value }

function onPicked(info: PickedEntityInfo | null, x?: number, y?: number) {
  if (!info) { popupVisible.value = false; popupInfo.value = null; return }
  popupInfo.value = info
  popupPos.x = x ?? 0
  popupPos.y = y ?? 0
  popupVisible.value = true
}

const popupIcon = computed(() => {
  switch (popupInfo.value?.kind) {
    case 'mtr-station': return '🚇'
    case 'mtr-line': return '🛤️'
    case 'light-rail-station':
    case 'light-rail-route': return '🚈'
    case 'centerline': return '🛣️'
    case 'road-point': return '🟦'
    case 'ferry-pier': return '⛴️'
    case 'ev-charger': return '⚡'
    case 'bus-citybus': return '🟧'
    case 'bus-kmb': return '🟥'
    case 'bus-nlb': return '🟪'
    case 'bus-gmb': return '🟩'
    case 'bus-lwb': return '✈️'
    default: return '📍'
  }
})

onBeforeUnmount(() => {})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- Cesium 主舞台（Globe 作为后代组件才能调用 useCesium） -->
    <CesiumViewer
      :home="HK_POINT_CLAMP_HOME"
      :imagery-url="DEFAULT_IMAGERY_URL"
      :imagery-max-level="20"
      status-bar
    >
      <HKTrafficGlobe
        ref="globeRef"
        :layers="layerState"
        @loading="loading = $event"
        @ready="ready = $event"
        @last-updated="lastUpdated = $event"
        @weather-warnings="weatherWarnings = $event"
        @picked="onPicked"
      />
    </CesiumViewer>

    <!-- 左侧控制面板 -->
    <HKTrafficPanel
      :layers="layerState"
      :last-updated="lastUpdated"
      :loading="loading"
      :ready="ready"
      @toggle="onLayerToggle"
      @refresh="refresh"
    />

    <!-- 右上角：天气警告 HUD -->
    <div
      v-if="weatherWarnings.length > 0"
      class="absolute top-3 right-3 z-20 flex flex-col gap-2 max-w-xs"
    >
      <div v-for="w in weatherWarnings" :key="w.code" class="weather-card">
        <span class="w-icon">⚠️</span>
        <div class="w-body">
          <div class="w-title">{{ w.type }}</div>
          <div class="w-desc">{{ w.desc }}</div>
        </div>
      </div>
    </div>

    <!-- 点击弹窗 -->
    <Teleport to="body">
      <div
        v-if="popupVisible && popupInfo"
        class="hk-popup"
        :style="{ left: `${popupPos.x}px`, top: `${popupPos.y}px` }"
        @click.stop
      >
        <div class="popup-header">
          <span class="popup-icon">{{ popupIcon }}</span>
          <div class="popup-title-wrap">
            <div class="popup-title">{{ popupInfo.title }}</div>
            <div v-if="popupInfo.subtitle" class="popup-sub">{{ popupInfo.subtitle }}</div>
          </div>
          <button class="popup-close" @click="popupVisible = false">✕</button>
        </div>
        <div class="popup-body">
          <div v-for="[label, val] in popupInfo.rows" :key="label" class="popup-row">
            <span class="popup-label">{{ label }}</span>
            <span class="popup-val">{{ val }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.hk-popup {
  position: fixed;
  width: 280px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.22);
  font-size: 12px;
  color: #1e293b;
  z-index: 9999;
  pointer-events: auto;
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border-radius: 10px 10px 0 0;
}
.popup-icon { font-size: 18px; }
.popup-title-wrap { flex: 1; min-width: 0; }
.popup-title {
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.popup-sub {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.popup-close {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}
.popup-close:hover { background: #f1f5f9; }

.popup-body { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.popup-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}
.popup-label { color: #94a3b8; flex-shrink: 0; }
.popup-val { color: #1e293b; text-align: right; word-break: break-all; }

.weather-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.95);
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35);
  min-width: 180px;
}
.w-icon { font-size: 16px; flex-shrink: 0; }
.w-body { flex: 1; min-width: 0; }
.w-title { font-weight: 600; font-size: 12px; }
.w-desc { font-size: 11px; opacity: 0.9; margin-top: 2px; line-height: 1.4; }
</style>
