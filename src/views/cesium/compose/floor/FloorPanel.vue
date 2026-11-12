<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumModelNodes } from '@/composables/useCesiumModelNodes'

const DEFAULT_URL = '/data/models/CesiumMilkTruck.glb'

const nodes = useCesiumModelNodes()
const url = ref(DEFAULT_URL)

function load() {
  if (!url.value) return ElMessage.warning('请输入模型地址')
  void nodes.load(url.value)
}

onCesiumReady(() => {
  void nodes.load(DEFAULT_URL)
})
</script>

<template>
  <CesiumOverlay title="模型节点分层" class="absolute left-3 top-3 z-10" :width="300">
    <el-input v-model="url" size="small" placeholder="模型地址 (.glb)" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="nodes.loading.value" @click="load">加载</el-button>
      <el-button size="small" :disabled="!nodes.loaded.value" @click="nodes.zoom()">定位</el-button>
      <el-button size="small" plain :disabled="!nodes.loaded.value" @click="nodes.remove()">移除</el-button>
    </div>

    <p v-if="nodes.error.value" class="error">{{ nodes.error.value }}</p>
    <p v-else-if="!nodes.nodes.value.length" class="hint">
      加载完成后自动读取 <b>sceneGraph</b> 节点树；建筑类模型可通过节点名控制楼层显隐。
    </p>

    <div class="grid">
      <span>经度</span>
      <el-input-number :model-value="nodes.options.lon" :precision="5" :step="0.001" size="small" controls-position="right" @change="(v) => nodes.update({ lon: Number(v) })" />
      <span>纬度</span>
      <el-input-number :model-value="nodes.options.lat" :precision="5" :step="0.001" size="small" controls-position="right" @change="(v) => nodes.update({ lat: Number(v) })" />
      <span>高度</span>
      <el-input-number :model-value="nodes.options.height" :step="10" size="small" controls-position="right" @change="(v) => nodes.update({ height: Number(v) })" />
      <span>缩放</span>
      <el-input-number :model-value="nodes.options.scale" :min="0.1" :step="0.1" size="small" controls-position="right" @change="(v) => nodes.update({ scale: Number(v) })" />
    </div>

    <div class="node-head">
      <span>节点（{{ nodes.nodes.value.length }}）</span>
      <div class="flex gap-1">
        <el-button size="small" text type="primary" :disabled="!nodes.nodes.value.length" @click="nodes.showAll(true)">全显</el-button>
        <el-button size="small" text type="primary" :disabled="!nodes.nodes.value.length" @click="nodes.showAll(false)">全隐</el-button>
      </div>
    </div>

    <div class="node-list">
      <div v-for="n in nodes.nodes.value" :key="n.id" class="node-row">
        <span class="node-name" :title="n.name">{{ n.name }}</span>
        <el-switch :model-value="n.show" size="small" @update:model-value="(v) => nodes.setNodeShow(n.id, !!v)" />
      </div>
      <p v-if="!nodes.nodes.value.length" class="empty">暂无节点</p>
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
.grid {
  display: grid;
  grid-template-columns: 36px 1fr;
  align-items: center;
  gap: 6px 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.grid :deep(.el-input-number) {
  width: 100%;
}
.node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.node-list {
  margin-top: 4px;
  max-height: 170px;
  overflow: auto;
}
.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #f1f5f9;
}
.node-name {
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  color: #1f2328;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  margin: 8px 0;
  text-align: center;
  font-size: 11px;
  color: #cbd5e1;
}
</style>
