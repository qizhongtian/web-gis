<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import GeoJsonPanel from './GeoJsonPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      GeoJSON 加载：支持远程地址与本地文件，点/线/面自动识别；描边、填充、透明度、点位大小与贴地均可实时调整，点击要素查看属性。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[-98, 39, 6000000]">
      <GeoJsonPanel />
    </CesiumViewer>
  </div>
</template>
