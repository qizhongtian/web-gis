<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import ConvertPanel from './ConvertPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      香港 1980 方格网坐标转换：WGS84 经纬度与 HK80（EPSG:2326）东/北坐标互转，支持地图点选拾取经纬度。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 60000]" :status-bar="false">
      <ConvertPanel />
    </CesiumViewer>
  </div>
</template>
