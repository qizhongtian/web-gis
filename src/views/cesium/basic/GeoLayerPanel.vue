<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'
import { useCesiumGeoJson } from '@/composables/useCesiumGeoJson'
import { assetUrl } from '@/utils/publicUrl'

type Geometry = 'Point' | 'LineString' | 'Polygon'

const props = defineProps<{ geometry: Geometry }>()

const DEFAULTS: Record<Geometry, { url: string; label: string; color: string; fill: string; alpha: number; size: number }> = {
  Point: { url: assetUrl('data/geojson/ProjectPoint.json'), label: '点', color: '#2563eb', fill: '#2563eb', alpha: 0.9, size: 22 },
  LineString: { url: assetUrl('data/geojson/Site_Boundary_line.json'), label: '线', color: '#f97316', fill: '#f97316', alpha: 1, size: 5 },
  Polygon: { url: assetUrl('data/geojson/polygon.json'), label: '面', color: '#16a34a', fill: '#22c55e', alpha: 0.3, size: 2 },
}

const current = computed(() => DEFAULTS[props.geometry])
// 解构出顶层 ref，模板里可直接使用（普通对象内的 ref 不会自动解包）
const { loading, error, count, properties, selected, style, load, restyle, clear } = useCesiumGeoJson()
const url = ref(current.value.url)
const fileInput = ref<HTMLInputElement>()

// 初始样式：按几何类型给一套能看出差别的默认值
Object.assign(style, {
  stroke: current.value.color,
  fill: current.value.fill,
  fillAlpha: current.value.alpha,
  strokeWidth: current.value.size,
  pointSize: current.value.size,
})

onCesiumReady(() => {
  void load(url.value, `${current.value.label}数据`)
})

function doLoad() {
  if (!url.value.trim()) return
  void load(url.value.trim(), `${current.value.label}数据`)
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const json = JSON.parse(await file.text())
    url.value = file.name
    await load(json, file.name)
  } catch (e: any) {
    ElMessage.error(e?.message || '文件解析失败，请确认是 GeoJSON')
  }
}

function onClamp(value: boolean) {
  const patch: any = { clamp: value }
  if (value) patch.extrudedHeight = 0
  void restyle(patch)
}

function onColor(value: string | null) {
  if (value) void restyle({ stroke: value })
}

function onFill(value: string | null) {
  if (value) void restyle({ fill: value })
}

function onFillAlpha(value: number | number[]) {
  void restyle({ fillAlpha: Number(Array.isArray(value) ? value[0] : value) })
}

function onWidth(value: number | number[]) {
  const next = Number(Array.isArray(value) ? value[0] : value)
  void restyle(props.geometry === 'Point' ? { pointSize: next } : { strokeWidth: next })
}

function onExtrude(value: number | number[] | undefined) {
  const next = Number(Array.isArray(value) ? value[0] : (value ?? 0))
  void restyle(next > 0 ? { extrudedHeight: next, clamp: false } : { extrudedHeight: 0 })
}
</script>

<template>
  <CesiumOverlay :title="`GeoJSON ${current.label}图层`" class="absolute left-3 top-3 z-10" :width="326">
    <el-input v-model="url" size="small" :placeholder="`${current.label}数据地址`" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="loading" @click="doLoad">加载</el-button>
      <el-button size="small" plain @click="pickFile">本地文件</el-button>
      <el-button size="small" plain :disabled="count === 0" @click="clear">清空</el-button>
      <input ref="fileInput" type="file" accept=".json,.geojson" class="hidden" @change="onFile" />
    </div>

    <div class="row">
      <span>贴地（跟随地形/模型表面）</span>
      <el-switch :model-value="style.clamp" size="small" @update:model-value="(v) => onClamp(!!v)" />
    </div>

    <div class="row">
      <span>描边颜色</span>
      <el-color-picker :model-value="style.stroke" size="small" @change="onColor" />
    </div>

    <div v-if="geometry !== 'LineString'" class="row">
      <span>{{ geometry === 'Point' ? '点颜色' : '填充颜色' }}</span>
      <el-color-picker :model-value="style.fill" size="small" @change="onFill" />
    </div>

    <div v-if="geometry === 'Polygon'" class="slider-row">
      <span>填充透明度</span>
      <el-slider
        :model-value="style.fillAlpha"
        :min="0.05"
        :max="1"
        :step="0.05"
        size="small"
        @update:model-value="onFillAlpha"
      />
      <b>{{ style.fillAlpha.toFixed(2) }}</b>
    </div>

    <div v-if="geometry !== 'Polygon'" class="slider-row">
      <span>{{ geometry === 'Point' ? '点大小' : '线宽' }}</span>
      <el-slider
        :model-value="geometry === 'Point' ? style.pointSize : style.strokeWidth"
        :min="1"
        :max="geometry === 'Point' ? 48 : 24"
        :step="1"
        size="small"
        @update:model-value="onWidth"
      />
      <b>{{ geometry === 'Point' ? style.pointSize : style.strokeWidth }}</b>
    </div>

    <div v-if="geometry === 'Polygon'" class="slider-row">
      <span>拉伸高度</span>
      <el-slider
        :model-value="style.extrudedHeight"
        :min="0"
        :max="300"
        :step="10"
        size="small"
        @update:model-value="onExtrude"
      />
      <b>{{ style.extrudedHeight }}m</b>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="info">
      <div class="info-row">
        <span>要素数量</span>
        <b>{{ count }}</b>
      </div>
      <div v-if="selected" class="info-row">
        <span>当前要素</span>
        <b>{{ selected }}</b>
      </div>
    </div>

    <div v-if="properties.length" class="props">
      <div class="props-title">点击要素属性（{{ properties.length }}）</div>
      <div v-for="item in properties" :key="item.name" class="prop-row">
        <span>{{ item.name }}</span>
        <b>{{ item.value }}</b>
      </div>
    </div>
    <p v-else class="hint">点击地图上的{{ current.label }}要素，可读取 GeoJSON 的 properties。</p>
  </CesiumOverlay>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.hidden {
  display: none;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.slider-row {
  display: grid;
  grid-template-columns: 66px 1fr 44px;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
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
  padding: 2px 0;
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
.props {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  max-height: 168px;
  overflow: auto;
}
.props-title {
  margin-bottom: 4px;
  color: #374151;
  font-size: 11px;
  font-weight: 600;
}
.prop-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-size: 11px;
  color: #9ca3af;
}
.prop-row b {
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
.error {
  color: #ef4444;
  word-break: break-all;
}
</style>
