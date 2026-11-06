<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumBasemap } from '@/composables/useCesiumBasemap'
import { useCesiumTerrainSample, type SampleInput } from '@/composables/useCesiumTerrainSample'
import { formatNumber } from '@/utils/gis/coord'

const { terrain, setTerrain, setExaggeration } = useCesiumBasemap()
const { sampling, error, points, sample, sampleScreen, clear } = useCesiumTerrainSample()

const pickMode = ref(false)
const fileInput = ref<HTMLInputElement>()

/** 示例点集：香港岛 / 九龙 / 新界 */
const PRESET: SampleInput[] = [
  { id: 'P1', lon: 114.1694, lat: 22.2759 },
  { id: 'P2', lon: 114.1694, lat: 22.3193 },
  { id: 'P3', lon: 114.1378, lat: 22.3419 },
  { id: 'P4', lon: 114.0636, lat: 22.4436 },
  { id: 'P5', lon: 114.2401, lat: 22.4476 },
  { id: 'P6', lon: 114.0296, lat: 22.4025 },
]

function toggleTerrain(enabled: boolean) {
  void setTerrain(enabled)
}

function onExaggeration(value: number | number[]) {
  setExaggeration(Number(Array.isArray(value) ? value[0] : value))
}

async function run(list: SampleInput[]) {
  if (!terrain.value.enabled) {
    ElMessage.warning('请先开启地形服务，再采样高程')
    return
  }
  await sample(list)
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const json = JSON.parse(await file.text())
    const list: SampleInput[] = []
    const features = json.type === 'FeatureCollection' ? json.features : [json]
    features.forEach((f: any, i: number) => {
      if (f?.geometry?.type !== 'Point') return
      const [lon, lat] = f.geometry.coordinates
      list.push({ id: f.properties?.id ?? f.properties?.name ?? i + 1, lon: Number(lon), lat: Number(lat) })
    })
    if (!list.length) {
      ElMessage.warning('未在文件中找到 Point 类型的要素')
      return
    }
    await run(list)
  } catch {
    ElMessage.error('文件解析失败，请检查 GeoJSON 格式')
  }
}

function download() {
  if (!points.value.length) return
  const blob = new Blob([JSON.stringify(points.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `terrain-samples-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function clearAll() {
  clear()
  pickMode.value = false
}

onCesiumReady((viewer, C) => {
  const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: any) => {
    if (!pickMode.value) return
    void sampleScreen(movement.position)
  }, C.ScreenSpaceEventType.LEFT_CLICK)
  return () => handler.destroy()
})
</script>

<template>
  <CesiumOverlay title="地形与高程采样" class="absolute left-3 top-3 z-10" :width="320">
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
    <el-slider :model-value="terrain.exaggeration" :min="1" :max="5" :step="0.1" size="small" @update:model-value="onExaggeration" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="sampling" @click="run(PRESET)">示例点集</el-button>
      <el-button size="small" :disabled="sampling" @click="fileInput?.click()">导入 GeoJSON</el-button>
      <el-button size="small" plain :disabled="!points.length" @click="download">导出</el-button>
      <el-button size="small" plain :disabled="!points.length" @click="clearAll">清空</el-button>
    </div>
    <input ref="fileInput" type="file" accept=".geojson,.json" hidden @change="onUpload" />

    <div class="flex items-center justify-between pick-row">
      <span class="field-label !mb-0">点击地图采样</span>
      <el-switch v-model="pickMode" size="small" :disabled="!terrain.enabled" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else class="hint">
      采样使用 <b>sampleTerrainMostDetailed</b>；请先开启地形服务。地址留空时使用 Cesium 世界地形（.env 配置
      VITE_CESIUM_TOKEN），也可填写自建 quantized-mesh 地形地址。
    </p>

    <div class="result-head">
      <span>采样结果（{{ points.length }}）</span>
      <span v-if="sampling" class="sampling">采样中…</span>
    </div>

    <div class="table">
      <div class="tr head">
        <span>ID</span>
        <span>经纬度</span>
        <span>高程</span>
        <span>HK80</span>
      </div>
      <div v-for="p in points" :key="`${p.id}-${p.lon}`" class="tr">
        <span>{{ p.id }}</span>
        <span>{{ formatNumber(p.lon, 4) }}, {{ formatNumber(p.lat, 4) }}</span>
        <span class="height">{{ p.height.toFixed(2) }} m</span>
        <span>{{ Math.round(p.hk80E) }}, {{ Math.round(p.hk80N) }}</span>
      </div>
      <p v-if="!points.length" class="empty">暂无数据</p>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.field-label {
  color: #6b7280;
  font-size: 12px;
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
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.pick-row {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
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
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.sampling {
  color: #2563eb;
}
.table {
  margin-top: 6px;
  max-height: 190px;
  overflow: auto;
  font-size: 11px;
}
.tr {
  display: grid;
  grid-template-columns: 34px 1fr 62px 92px;
  gap: 4px;
  padding: 4px 0;
  border-bottom: 1px solid #f1f5f9;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}
.tr.head {
  position: sticky;
  top: 0;
  background: #fff;
  color: #9ca3af;
}
.height {
  color: #2563eb;
}
.empty {
  margin: 10px 0;
  color: #cbd5e1;
  text-align: center;
  font-size: 11px;
}
</style>
