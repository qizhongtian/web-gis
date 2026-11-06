<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import NavigationPanel from './NavigationPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      导航控件：自绘 SVG 指北针（点击回正北）、动态比例尺、缩放/复位/二三维切换，全部基于 <b>camera.changed</b> 事件驱动。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 180000]" :status-bar="false">
      <NavigationPanel />
    </CesiumViewer>
  </div>
</template>
