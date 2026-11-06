<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { BASEMAPS, useCesiumBasemap } from '@/composables/useCesiumBasemap'

const { current, terrain, applyBasemap, setTerrain, setExaggeration } = useCesiumBasemap()

function toggleTerrain(enabled: boolean) {
  void setTerrain(enabled)
}

function onExaggeration(value: number | number[]) {
  setExaggeration(Number(Array.isArray(value) ? value[0] : value))
}
</script>

<template>
  <CesiumOverlay title="底图与地形" class="absolute left-3 top-3 z-10" :width="272">
    <div class="field-label">影像底图</div>
    <div class="basemap-list">
      <button
        v-for="b in BASEMAPS"
        :key="b.id"
        class="basemap-item"
        :class="{ active: current === b.id }"
        @click="applyBasemap(b.id)"
      >
        <span class="dot" />
        <span class="label">{{ b.label }}</span>
        <span class="check">✓</span>
      </button>
    </div>

    <div class="terrain">
      <div class="flex items-center justify-between">
        <span class="field-label !mb-0">地形服务</span>
        <el-switch
          :model-value="terrain.enabled"
          size="small"
          :loading="terrain.loading"
          @update:model-value="(v) => toggleTerrain(!!v)"
        />
      </div>

      <el-input v-model="terrain.url" size="small" class="!mt-2" placeholder="留空使用世界地形（需 Token）" />

      <div class="exaggeration">
        <span>高程夸张</span>
        <b>×{{ terrain.exaggeration.toFixed(1) }}</b>
      </div>
      <el-slider
        :model-value="terrain.exaggeration"
        :min="1"
        :max="5"
        :step="0.1"
        size="small"
        @update:model-value="onExaggeration"
      />

      <p v-if="terrain.error" class="error">{{ terrain.error }}</p>
      <p class="hint">留空时使用 Cesium 世界地形，需在 .env 配置 VITE_CESIUM_TOKEN；也可填写自建 quantized-mesh 地形地址。</p>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.field-label {
  margin-bottom: 6px;
  color: #6b7280;
  font-size: 12px;
}
.basemap-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.basemap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 12px;
  color: #1f2328;
  cursor: pointer;
  text-align: left;
}
.basemap-item:hover {
  background: #f3f6fb;
}
.basemap-item.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}
.basemap-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
}
.basemap-item.active .dot {
  background: #2563eb;
}
.basemap-item .label {
  flex: 1;
}
.basemap-item .check {
  opacity: 0;
  color: #2563eb;
}
.basemap-item.active .check {
  opacity: 1;
}
.terrain {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e6e8eb;
}
.exaggeration {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.exaggeration b {
  color: #2563eb;
  font-weight: 600;
}
.hint {
  margin: 2px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #9ca3af;
}
.error {
  margin: 6px 0 0;
  font-size: 11px;
  color: #ef4444;
}
</style>
