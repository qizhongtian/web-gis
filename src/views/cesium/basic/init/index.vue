<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import SceneToolbar from './SceneToolbar.vue'
import { getDefaultWidgetOptions } from '@/utils/gis/cesiumInit'

/**
 * Viewer 的控件要把 Cesium 命名空间（底图 view model、地理编码服务）带进去，
 * 而此时库里还没加载完，所以用函数形式延迟构造。
 */
const viewerOptions = (Cesium: any) => getDefaultWidgetOptions(Cesium)
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      Cesium 基础：<b>CesiumViewer</b> 统一加载 / 销毁 Viewer，子孙组件通过 <b>useCesium()</b> 获取实例；本页把 Cesium
      自带控件全部打开（底图选择 / 地名搜索 / Home / 2D-3D 切换 / 操作帮助 / 时间轴 / 全屏 / 信息框），底部状态栏展示相机坐标与姿态
    </p>
    <CesiumViewer class="flex-1 min-h-0" :home="[116.407, 39.904, 2_000_000]" :options="viewerOptions">
      <SceneToolbar />
    </CesiumViewer>
  </div>
</template>

<style scoped>
/* 时间轴与全屏按钮占住底部，把状态条抬高、右移，避免相互遮挡 */
:deep(.cesium-status) {
  right: 40px !important;
  bottom: 34px !important;
}
</style>
