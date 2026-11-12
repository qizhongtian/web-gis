<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import MeasurePanel from './MeasurePanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      空间量算：<b>单击</b>取点，<b>双击</b>结束；节点可拖拽微调，测距每段标注距离并可点节点右上角 <b>×</b> 单独删除，测面标注边长与面积，测高标注高差 / 水平距离 / 斜距。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden">
      <MeasurePanel />
    </CesiumViewer>
  </div>
</template>
