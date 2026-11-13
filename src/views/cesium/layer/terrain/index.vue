<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import TerrainPanel from './TerrainPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      地形与高程采样：默认加载全球高程服务（ArcGIS ImageServer，免 Token），也可填自建 quantized-mesh 地址；
      开启后可做地形夸张、点击采样或批量导入 GeoJSON 点位，使用 <b>sampleTerrainMostDetailed</b> 获取最精细层级的地面高程。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 120000]">
      <TerrainPanel />
    </CesiumViewer>
  </div>
</template>
