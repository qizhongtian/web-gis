<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import WeatherPanel from './WeatherPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      天气特效：粒子贴图全部由 <b>canvas 运行时生成</b>，粒子系统在 <b>scene.preUpdate</b> 中跟随相机；关闭或卸载时移除图元并还原雾/光照参数。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 90000]" :status-bar="false">
      <WeatherPanel />
    </CesiumViewer>
  </div>
</template>
