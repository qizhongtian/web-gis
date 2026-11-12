<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import TrackPanel from './TrackPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      轨迹回放：沿维多利亚港环线回放车辆轨迹，支持播放 / 暂停 / 重新播放、进度拖动与 1~50 倍速；轨迹可按距离自动分配时间。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.18, 22.28, 32000]">
      <TrackPanel />
    </CesiumViewer>
  </div>
</template>
