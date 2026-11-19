<script setup lang="ts">
import { provide } from 'vue'
import { ASSET_INSPECT_KEY, useCesiumAssetInspect } from '@/composables/useCesiumAssetInspect'
import InspectUploadPanel from './InspectUploadPanel.vue'
import InspectDetailPanel from './InspectDetailPanel.vue'

/**
 * 页面状态容器：必须放在 <CesiumViewer> 的插槽内，
 * 这样 useCesiumAssetInspect 才能通过 onCesiumReady 拿到 viewer / Cesium。
 */
const store = useCesiumAssetInspect()
provide(ASSET_INSPECT_KEY, store)
</script>

<template>
  <InspectUploadPanel />
  <InspectDetailPanel />
</template>
