<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import MeasurePanel from './MeasurePanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      空间量算：左键连续加点，<b>双击 / 右键</b>结束；距离按段累加，面积用局部 ENU 投影计算，高度模式比较两次拾取的高差。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 120000]" :status-bar="false">
      <MeasurePanel />
    </CesiumViewer>
  </div>
</template>
