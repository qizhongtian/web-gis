<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumGeoJson, type GeoJsonStyle } from '@/composables/useCesiumGeoJson'
import { assetUrl } from '@/utils/publicUrl'

const DEFAULT_URL = assetUrl('data/geojson/us-states.json')

const geo = useCesiumGeoJson()
const url = ref(DEFAULT_URL)
const fileInput = ref<HTMLInputElement>()

function loadUrl() {
  if (!url.value) return ElMessage.warning('请输入 GeoJSON 地址')
  void geo.load(url.value)
}

function setStyle<K extends keyof GeoJsonStyle>(key: K, value: GeoJsonStyle[K]) {
  void geo.restyle({ [key]: value } as Partial<GeoJsonStyle>)
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const json = JSON.parse(await file.text())
    await geo.load(json, file.name)
  } catch {
    ElMessage.error('文件解析失败，请检查 GeoJSON 格式')
  }
}
</script>

<template>
  <CesiumOverlay title="GeoJSON 加载" class="absolute left-3 top-3 z-10" :width="308">
    <el-input v-model="url" size="small" placeholder="GeoJSON 地址" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="geo.loading.value" @click="loadUrl">加载</el-button>
      <el-button size="small" :disabled="geo.loading.value" @click="fileInput?.click()">本地文件</el-button>
      <el-button size="small" plain :disabled="!geo.count.value" @click="geo.clear()">清空</el-button>
    </div>
    <input ref="fileInput" type="file" accept=".geojson,.json" hidden @change="onUpload" />

    <p v-if="geo.error.value" class="error">{{ geo.error.value }}</p>
    <p v-else class="hint">
      支持点 / 线 / 面，<b>GeoJsonDataSource</b> 自动识别几何类型；左键点击要素读取属性。
    </p>

    <div class="style-block">
      <div class="style-row">
        <span>描边</span>
        <el-color-picker :model-value="geo.style.stroke" size="small" @change="(v) => setStyle('stroke', String(v || '#2563eb'))" />
        <span class="right">线宽 {{ geo.style.strokeWidth }}px</span>
      </div>
      <el-slider :model-value="geo.style.strokeWidth" :min="1" :max="8" :step="1" size="small" @update:model-value="(v) => setStyle('strokeWidth', Number(v))" />

      <div class="style-row">
        <span>填充</span>
        <el-color-picker :model-value="geo.style.fill" size="small" @change="(v) => setStyle('fill', String(v || '#2563eb'))" />
        <span class="right">透明度 {{ Math.round(geo.style.fillAlpha * 100) }}%</span>
      </div>
      <el-slider :model-value="geo.style.fillAlpha" :min="0" :max="1" :step="0.05" size="small" @update:model-value="(v) => setStyle('fillAlpha', Number(v))" />

      <div class="style-row">
        <span>点位大小</span>
        <el-slider class="!mx-2" :model-value="geo.style.pointSize" :min="10" :max="48" :step="2" size="small" @update:model-value="(v) => setStyle('pointSize', Number(v))" />
      </div>
      <div class="style-row">
        <span>贴地</span>
        <el-switch :model-value="geo.style.clamp" size="small" @update:model-value="(v) => setStyle('clamp', !!v)" />
      </div>
    </div>

    <div class="result-head">
      <span>要素属性（{{ geo.count.value }} 个要素）</span>
      <span v-if="geo.selected.value" class="selected">{{ geo.selected.value }}</span>
    </div>

    <div class="prop-list">
      <div v-for="p in geo.properties.value" :key="p.name" class="prop-row">
        <span class="prop-name">{{ p.name }}</span>
        <span class="prop-value">{{ p.value }}</span>
      </div>
      <p v-if="!geo.properties.value.length" class="empty">点击要素查看属性</p>
    </div>
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
.style-block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.style-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-size: 12px;
  color: #6b7280;
}
.style-row .right {
  font-size: 11px;
  color: #9ca3af;
}
.style-row :deep(.el-slider) {
  margin: 0 8px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.selected {
  max-width: 120px;
  overflow: hidden;
  color: #2563eb;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-list {
  margin-top: 4px;
  max-height: 150px;
  overflow: auto;
}
.prop-row {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 11px;
}
.prop-name {
  flex: 0 0 88px;
  overflow: hidden;
  color: #6b7280;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-value {
  flex: 1;
  color: #1f2328;
  word-break: break-all;
}
.empty {
  margin: 8px 0;
  text-align: center;
  font-size: 11px;
  color: #cbd5e1;
}
</style>
