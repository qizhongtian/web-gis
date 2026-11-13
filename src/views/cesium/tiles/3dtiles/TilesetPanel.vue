<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumTileset } from '@/composables/useCesiumTileset'
import { useCesiumLib } from '@/composables/useCesium'
import { assetUrl } from '@/utils/publicUrl'

const DEFAULT_URL = assetUrl('data/tiles/duck/tileset.json')

const tileset = useCesiumTileset()
const Cesium = useCesiumLib()

const url = ref(DEFAULT_URL)
const filterKey = ref('name')
const filterValues = ref('')

function load() {
  if (!url.value) return ElMessage.warning('请输入 tileset.json 地址')
  void tileset.load(url.value)
}

function applyFilter() {
  const ts = tileset.tileset.value
  const C = Cesium.value
  if (!ts || !C) return
  const key = filterKey.value.trim()
  const values = filterValues.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!key || !values.length) {
    ts.style = new C.Cesium3DTileStyle({ show: 'true' })
    return
  }
  // 只保留属性值命中列表的构件
  const conditions = values.map((v) => `\${${key}} === '${v.replace(/'/g, "\\'")}'`).join(' || ')
  ts.style = new C.Cesium3DTileStyle({ show: conditions })
}

function resetFilter() {
  const ts = tileset.tileset.value
  const C = Cesium.value
  if (!ts || !C) return
  filterValues.value = ''
  ts.style = new C.Cesium3DTileStyle({ show: 'true' })
}
</script>

<template>
  <CesiumOverlay title="3D Tiles" class="absolute left-3 top-3 z-10" :width="330">
    <el-input v-model="url" size="small" placeholder="tileset.json 地址" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="tileset.loading.value" @click="load">加载</el-button>
      <el-button size="small" :disabled="!tileset.loaded.value" @click="tileset.zoomTo()">定位</el-button>
      <el-button size="small" plain :disabled="!tileset.loaded.value" @click="tileset.remove()">移除</el-button>
    </div>

    <p v-if="tileset.error.value" class="error">{{ tileset.error.value }}</p>
    <p v-else class="hint">
      加载后 <b>左键点击构件</b> 可读取属性表；下方可显隐、线框调试与按属性过滤。
    </p>

    <div class="switches">
      <div class="switch-row">
        <span>显示模型</span>
        <el-switch
          :model-value="tileset.visible.value"
          size="small"
          :disabled="!tileset.loaded.value"
          @update:model-value="(v) => tileset.setVisible(!!v)"
        />
      </div>
      <div class="switch-row">
        <span>线框调试</span>
        <el-switch
          :model-value="tileset.wireframe.value"
          size="small"
          :disabled="!tileset.loaded.value"
          @update:model-value="(v) => tileset.setWireframe(!!v)"
        />
      </div>
    </div>

    <div class="filter">
      <div class="field-label">按属性过滤</div>
      <div class="filter-row">
        <el-input v-model="filterKey" size="small" class="!w-24" placeholder="属性名" />
        <el-input v-model="filterValues" size="small" placeholder="值1, 值2" />
      </div>
      <div class="actions !mt-2">
        <el-button size="small" :disabled="!tileset.loaded.value" @click="applyFilter">应用</el-button>
        <el-button size="small" plain :disabled="!tileset.loaded.value" @click="resetFilter">重置</el-button>
      </div>
    </div>

    <div class="prop-head">构件属性（{{ tileset.properties.value.length }}）</div>
    <div class="prop-list">
      <div v-for="p in tileset.properties.value" :key="p.name" class="prop-row">
        <span class="prop-name">{{ p.name }}</span>
        <span class="prop-value">{{ p.value }}</span>
      </div>
      <p v-if="!tileset.properties.value.length" class="empty">点击构件查看属性</p>
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
.switches {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: #6b7280;
}
.filter {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.field-label {
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 12px;
}
.filter-row {
  display: flex;
  gap: 6px;
}
.prop-head {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.prop-list {
  margin-top: 4px;
  max-height: 180px;
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
  flex: 0 0 84px;
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
