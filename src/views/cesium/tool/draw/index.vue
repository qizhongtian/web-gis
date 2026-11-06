<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import DrawPanel from './DrawPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      交互绘制：点 / 线 / 面 / 矩形 / 圆，双击或右键结束；结果实时导出为 <b>GeoJSON</b>（坐标含高程），可复制或下载。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 60000]" :status-bar="false">
      <DrawPanel />
    </CesiumViewer>
  </div>
</template>
