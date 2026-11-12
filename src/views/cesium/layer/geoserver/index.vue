<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GeoServerPanel from './GeoServerPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      GeoServer 服务图层：同一份地址配置加载 <b>WMS</b>（影像叠加）或 <b>WFS</b>（矢量要素），
      图层列表可单独移除，卸载时统一清理，不残留服务请求。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[-98, 39, 6000000]">
      <GeoServerPanel />
    </CesiumViewer>
  </div>
</template>
