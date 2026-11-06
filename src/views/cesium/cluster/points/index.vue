<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import PointsPanel from './PointsPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      点位图层：随机生成监测点，图钉 / 圆点两种图标由 <b>canvas 实时绘制</b>；切换聚合后自动使用
      <b>EntityCluster</b> 聚合显示，样式修改后重建实体保证图标一致。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 42000]" :status-bar="false">
      <PointsPanel />
    </CesiumViewer>
  </div>
</template>
