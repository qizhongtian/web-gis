<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import WeatherPanel from './WeatherPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      天气特效：全部由
      <b>GLSL 片段着色器</b>
      实现，经
      <code>useCesiumPostStage</code>
      封装为后处理材质挂到 <b>scene.postProcessStages</b>；时间、强度、雾浓度等参数以每帧求值函数注入 uniform，关闭或卸载时移除阶段并还原雾参数。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :status-bar="false">
      <WeatherPanel />
    </CesiumViewer>
  </div>
</template>
