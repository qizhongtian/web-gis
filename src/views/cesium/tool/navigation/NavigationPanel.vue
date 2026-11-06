<script setup lang="ts">
import CesiumCompass from '@/components/CesiumCompass.vue'
import CesiumScaleBar from '@/components/CesiumScaleBar.vue'
import CesiumNavControls from '@/components/CesiumNavControls.vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesium, useCesiumLib } from '@/composables/useCesium'
import { useCesiumScene, type SceneModeKey } from '@/composables/useCesiumScene'
import { useCesiumPointer } from '@/composables/useCesiumPointer'
import { formatNumber } from '@/utils/gis/coord'

const viewer = useCesium()
const Cesium = useCesiumLib()
const { mode, underground, morph, toggleUnderground } = useCesiumScene()
const pointer = useCesiumPointer()

const HOME = { lon: 114.1694, lat: 22.3193, height: 180000 }

function zoomIn() {
  const camera = viewer.value?.camera
  if (!camera) return
  camera.zoomIn(camera.positionCartographic.height * 0.4)
}

function zoomOut() {
  const camera = viewer.value?.camera
  if (!camera) return
  camera.zoomOut(camera.positionCartographic.height * 0.6)
}

function resetView() {
  const camera = viewer.value?.camera
  const C = Cesium.value
  if (!camera || !C) return
  camera.flyTo({
    destination: C.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height),
    orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
    duration: 1.2,
  })
}

function onMorph(target: SceneModeKey) {
  morph(target)
}
</script>

<template>
  <CesiumOverlay title="场景控制" class="absolute left-3 top-3 z-10" :width="248">
    <div class="space-y-3">
      <div>
        <div class="field-label">场景模式</div>
        <el-radio-group :model-value="mode" size="small" @update:model-value="(v) => onMorph(v as SceneModeKey)">
          <el-radio-button value="3D">三维</el-radio-button>
          <el-radio-button value="2D">二维</el-radio-button>
          <el-radio-button value="CV">哥伦布</el-radio-button>
        </el-radio-group>
      </div>

      <div class="flex items-center justify-between">
        <span class="field-label !mb-0">地下模式</span>
        <el-switch :model-value="underground" size="small" @update:model-value="() => toggleUnderground()" />
      </div>

      <div class="info-grid">
        <span>经度</span><b>{{ pointer.valid ? formatNumber(pointer.lon) : '-' }}</b>
        <span>纬度</span><b>{{ pointer.valid ? formatNumber(pointer.lat) : '-' }}</b>
        <span>高程</span><b>{{ pointer.valid ? `${formatNumber(pointer.height, 1)} m` : '-' }}</b>
        <span>HK80 E</span><b>{{ pointer.valid ? formatNumber(pointer.hk80E, 2) : '-' }}</b>
        <span>HK80 N</span><b>{{ pointer.valid ? formatNumber(pointer.hk80N, 2) : '-' }}</b>
      </div>
    </div>
  </CesiumOverlay>

  <CesiumCompass class="absolute right-4 top-4 z-10" />
  <CesiumNavControls
    class="absolute right-4 top-[136px] z-10"
    :mode="mode"
    @zoom-in="zoomIn"
    @zoom-out="zoomOut"
    @reset="resetView"
    @morph="onMorph"
  />
  <div class="absolute left-4 bottom-4 z-10">
    <CesiumScaleBar />
  </div>
</template>

<style scoped>
.field-label {
  margin-bottom: 6px;
  color: #6b7280;
  font-size: 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 10px;
  padding-top: 10px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.info-grid b {
  color: #1f2328;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
