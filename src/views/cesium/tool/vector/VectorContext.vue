<script setup lang="ts">
import { provide } from 'vue'
import { useCesiumVectorLayers, VECTOR_LAYERS_KEY } from '@/composables/useCesiumVectorLayers'
import UploadPanel from './UploadPanel.vue'
import LayerListPanel from './LayerListPanel.vue'

/**
 * 在 <CesiumViewer> 插槽内创建矢量图层状态，
 * 让左侧上传面板与右侧图层列表共享同一份数据。
 */
const store = useCesiumVectorLayers()
provide(VECTOR_LAYERS_KEY, store)
</script>

<template>
  <UploadPanel />
  <LayerListPanel />
</template>
