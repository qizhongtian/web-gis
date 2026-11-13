<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import PointsPanel from './PointsPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      点位图层：随机生成监测点，每个点从 <code>/image/map-pin-*.png</code> 里随机挑一张图钉，名称以
      <b>黄字黑描边</b>贴在图标上方（拉近到 12 km 内才显示）；聚合由 <b>EntityCluster</b> 合并，气泡按数量分档配色
      （蓝 → 琥珀 → 橙 → 红）并随数量放大。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 42000]">
      <PointsPanel />
    </CesiumViewer>
  </div>
</template>
