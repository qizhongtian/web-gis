<script setup lang="ts">
import { ref } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumTileset } from '@/composables/useCesiumTileset'
import { defaultMeshTilesetUrl } from '@/utils/gis/cesiumConfig'

const { loading, error, loaded, visible, wireframe, properties, tileset, load, remove, zoomTo, setVisible, setWireframe } =
  useCesiumTileset()

/** 默认用「常见问题解决」里的香港倾斜摄影地址，可以直接换成本地 tileset.json */
const url = ref(defaultMeshTilesetUrl)
const sse = ref(16)

function doLoad() {
  if (!url.value.trim()) return
  void load(url.value.trim())
}

function onSse(value: number | number[]) {
  const next = Number(Array.isArray(value) ? value[0] : value)
  sse.value = next
  if (tileset.value) tileset.value.maximumScreenSpaceError = next
}
</script>

<template>
  <CesiumOverlay title="3D Tiles / 倾斜摄影" class="absolute left-3 top-3 z-10" :width="330">
    <el-input v-model="url" size="small" placeholder="tileset.json 地址" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="loading" @click="doLoad">加载</el-button>
      <el-button size="small" plain :disabled="!loaded" @click="zoomTo">定位</el-button>
      <el-button size="small" plain :disabled="!loaded" @click="remove">移除</el-button>
    </div>

    <div class="row">
      <span>显示</span>
      <el-switch :model-value="visible" size="small" :disabled="!loaded" @update:model-value="(v) => setVisible(!!v)" />
    </div>
    <div class="row">
      <span>线框（调试 LOD）</span>
      <el-switch
        :model-value="wireframe"
        size="small"
        :disabled="!loaded"
        @update:model-value="(v) => setWireframe(!!v)"
      />
    </div>

    <div class="slider-row">
      <span>屏幕误差</span>
      <el-slider :model-value="sse" :min="8" :max="64" :step="4" size="small" @update:model-value="onSse" />
      <b>{{ sse }}</b>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="properties.length" class="props">
      <div class="props-title">点击构件属性（{{ properties.length }}）</div>
      <div v-for="item in properties" :key="item.name" class="prop-row">
        <span>{{ item.name }}</span>
        <b>{{ item.value }}</b>
      </div>
    </div>
    <p v-else class="hint">点击模型可拾取构件属性；倾斜摄影的 b3dm 带批次表（batch table）才能逐构件取属性。</p>

    <p class="hint">
      默认地址是 FAQ 里使用的香港倾斜模型（<b>defaultMeshTilesetUrl</b>）。屏幕误差越大越省显存、瓦片越糊。
    </p>
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
  grid-template-columns: 60px 1fr 26px;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
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
.hint b {
  color: #6b7280;
}
.error {
  color: #ef4444;
  word-break: break-all;
}
</style>
