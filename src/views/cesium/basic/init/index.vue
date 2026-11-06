<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import SceneToolbar from './SceneToolbar.vue'
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      Cesium 基础：<b>CesiumViewer</b> 统一加载 / 销毁 Viewer，子孙组件通过 <b>useCesium()</b> 获取实例，底部状态栏展示相机坐标与姿态
    </p>
    <CesiumViewer class="flex-1 min-h-0" :home="[116.407, 39.904, 2_000_000]">
      <SceneToolbar />
    </CesiumViewer>
  </div>
</template>
