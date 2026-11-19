<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesium, useCesiumLib } from '@/composables/useCesium'
import { useCesiumBasemap } from '@/composables/useCesiumBasemap'
import { defaultTerrainServiceUrl } from '@/utils/gis/cesiumConfig'

const viewer = useCesium()
const Cesium = useCesiumLib()
const { terrain, setTerrain, setExaggeration } = useCesiumBasemap()

/** 默认地址与「常见问题解决」里的地形示例保持一致：香港全球高程（ArcGIS，免 Token） */
const url = ref(defaultTerrainServiceUrl)
const sampling = ref(false)
const sampledHeight = ref<number | null>(null)
const depthTest = ref(false)

const providerName = computed(() => {
  if (!terrain.value.enabled) return 'EllipsoidTerrainProvider（光滑椭球）'
  return /arcgis|elevation3d|ImageServer/i.test(terrain.value.url || '')
    ? 'ArcGISTiledElevationTerrainProvider'
    : 'CesiumTerrainProvider（quantized-mesh）'
})

async function toggle(enabled: boolean) {
  await setTerrain(enabled, url.value.trim())
}

function apply() {
  if (!url.value.trim()) return ElMessage.warning('请填写地形服务地址')
  void setTerrain(true, url.value.trim())
}

function onExaggeration(value: number | number[]) {
  setExaggeration(Number(Array.isArray(value) ? value[0] : value))
}

function toggleDepthTest(value: boolean) {
  depthTest.value = value
  const v = viewer.value
  if (v && !v.isDestroyed?.()) v.scene.globe.depthTestAgainstTerrain = value
}

async function sampleCenter() {
  const v = viewer.value
  const C = Cesium.value
  if (!v || !C) return
  if (!terrain.value.enabled) return ElMessage.warning('请先开启地形服务，再采样高程')

  sampling.value = true
  try {
    // 相机所在位置的经纬度就是屏幕中心的落点，用它演示「按需取地形高程」
    const carto = v.camera.positionCartographic
    const [result] = await C.sampleTerrainMostDetailed(v.terrainProvider, [new C.Cartographic(carto.longitude, carto.latitude)])
    sampledHeight.value = result.height
  } catch (e: any) {
    ElMessage.error(e?.message || '高程采样失败，请确认地形服务可用')
  } finally {
    sampling.value = false
  }
}
</script>

<template>
  <CesiumOverlay title="地形服务" class="absolute left-3 top-3 z-10" :width="316">
    <div class="row">
      <span class="field-label !mb-0">开启地形</span>
      <el-switch
        :model-value="terrain.enabled"
        size="small"
        :loading="terrain.loading"
        @update:model-value="(v) => toggle(!!v)"
      />
    </div>

    <el-input v-model="url" size="small" class="!mt-2" placeholder="地形地址（留空/默认 = 全球高程）" />
    <div class="actions">
      <el-button size="small" type="primary" :loading="terrain.loading" @click="apply">应用地址</el-button>
      <el-button size="small" plain :disabled="!terrain.enabled" @click="toggle(false)">关闭地形</el-button>
    </div>

    <div class="slider-row">
      <span>垂直夸张</span>
      <el-slider
        :model-value="terrain.exaggeration"
        :min="1"
        :max="5"
        :step="0.1"
        size="small"
        @update:model-value="onExaggeration"
      />
      <b>×{{ terrain.exaggeration.toFixed(1) }}</b>
    </div>

    <div class="row">
      <span class="field-label !mb-0">地形深度检测</span>
      <el-switch :model-value="depthTest" size="small" @update:model-value="(v) => toggleDepthTest(!!v)" />
    </div>

    <div class="actions !mt-2">
      <el-button size="small" :loading="sampling" :disabled="!terrain.enabled" @click="sampleCenter">
        采样屏幕中心高程
      </el-button>
    </div>

    <p v-if="terrain.error" class="error">{{ terrain.error }}</p>

    <div class="info">
      <div class="info-row">
        <span>当前 provider</span>
        <b>{{ providerName }}</b>
      </div>
      <div class="info-row">
        <span>中心高程</span>
        <b>{{ sampledHeight === null ? '—' : `${sampledHeight.toFixed(2)} m` }}</b>
      </div>
    </div>

    <p class="hint">
      开启后地球才会「起伏」：<b>sampleTerrainMostDetailed</b> 按最精细层级取高程，贴地实体也会跟着地形走；
      垂直夸张只影响渲染，不改变真实高程。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: #6b7280;
}
.field-label {
  color: #6b7280;
  font-size: 12px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.slider-row {
  display: grid;
  grid-template-columns: 60px 1fr 40px;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
  color: #9ca3af;
}
.info-row b {
  overflow: hidden;
  color: #2563eb;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
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
