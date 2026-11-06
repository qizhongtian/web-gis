<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import ModelPanel from './ModelPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      模型加载：输入 glTF / GLB 地址即可加载，实时调整位置、<b>朝向（heading / pitch / roll）</b>、缩放与轮廓高亮；
      默认加载 Khronos 官方示例模型。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 1500]" :status-bar="false">
      <ModelPanel />
    </CesiumViewer>
  </div>
</template>
