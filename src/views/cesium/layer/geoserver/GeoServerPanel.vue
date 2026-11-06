<script setup lang="ts">
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumGeoServer } from '@/composables/useCesiumGeoServer'

const { state, layers, loadWms, loadWfs, remove, clear } = useCesiumGeoServer()
</script>

<template>
  <CesiumOverlay title="GeoServer 服务图层" class="absolute left-3 top-3 z-10" :width="330">
    <div class="field-label">WMS 地址</div>
    <el-input v-model="state.wmsUrl" size="small" placeholder="https://host/geoserver/wms" />

    <div class="field-label !mt-2">WFS 地址</div>
    <el-input v-model="state.wfsUrl" size="small" placeholder="https://host/geoserver/wfs" />

    <div class="field-label !mt-2">图层名</div>
    <el-input v-model="state.layerName" size="small" placeholder="工作区:图层，如 topp:states" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="state.loading" @click="loadWms()">加载 WMS</el-button>
      <el-button size="small" type="primary" plain :loading="state.loading" @click="loadWfs()">加载 WFS</el-button>
      <el-button size="small" plain :disabled="!layers.length" @click="clear()">清空</el-button>
    </div>

    <p v-if="state.error" class="error">{{ state.error }}</p>
    <p v-else class="hint">
      WMS 以影像形式叠加（<b>WebMapServiceImageryProvider</b>），WFS 拉取 GeoJSON 后交给 <b>GeoJsonDataSource</b> 渲染。
      示例使用公开的 GeoServer 演示服务，可替换为内网地址。
    </p>

    <div class="layer-head">已加载图层（{{ layers.length }}）</div>
    <div v-for="l in layers" :key="l.id" class="layer-row">
      <el-tag size="small" :type="l.type === 'wms' ? 'primary' : 'success'" effect="plain">{{ l.type.toUpperCase() }}</el-tag>
      <span class="layer-name">{{ l.label }}</span>
      <el-button size="small" text type="danger" @click="remove(l.id)">移除</el-button>
    </div>
    <p v-if="!layers.length" class="empty">暂无图层</p>
  </CesiumOverlay>
</template>

<style scoped>
.field-label {
  margin-bottom: 4px;
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
.layer-head {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.layer-name {
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  color: #1f2328;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  margin: 10px 0 0;
  text-align: center;
  font-size: 11px;
  color: #cbd5e1;
}
</style>
