<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import FloorPanel from './FloorPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      模型节点分层：读取 glTF 的 <b>sceneGraph</b> 节点树，按节点名显隐楼层 / 构件；支持位置、高度与缩放调整。
      默认加载 Khronos 示例模型，可替换为带楼层命名的建筑模型。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 900]">
      <FloorPanel />
    </CesiumViewer>
  </div>
</template>
