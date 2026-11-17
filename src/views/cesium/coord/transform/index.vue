<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import ConvertPanel from './ConvertPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      WGS84 经纬度与地心地固坐标（ECEF）双向转换：可手动输入、地图点选拾取、定位到该点，数值与结果均可复制。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[116.391, 39.907, 60000]">
      <ConvertPanel />
    </CesiumViewer>
  </div>
</template>
