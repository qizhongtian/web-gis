<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import TilesetPanel from './TilesetPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      3D Tiles：<b>Cesium3DTileset.fromUrl</b> 异步加载，支持显示 / 线框调试、按属性表达式过滤；
      左键点击构件读取 <b>Cesium3DTileFeature</b> 属性并高亮。默认示例为本地 <b>glTF 内容 tileset</b>（3D Tiles 1.1）。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 700]" :status-bar="false">
      <TilesetPanel />
    </CesiumViewer>
  </div>
</template>
