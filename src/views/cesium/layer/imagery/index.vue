<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import BasemapPanel from './BasemapPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      影像图层：<b>UrlTemplateImageryProvider</b> 动态切换底图（切换时先移除旧图层，避免图层堆叠），并支持地形服务与高程夸张。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 300000]" :status-bar="false">
      <BasemapPanel />
    </CesiumViewer>
  </div>
</template>
