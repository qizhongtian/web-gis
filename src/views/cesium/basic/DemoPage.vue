<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'

/**
 * 基础示例页统一布局：左侧「提示条 + 地图 + 覆盖面板」，右侧「专业解释 / 关键代码 / 注意事项」
 * - panel 插槽渲染在地图内（使用 CesiumOverlay 的悬浮面板）
 * - guide 插槽放 GuidePanel，样式统一由此处约束
 */
withDefaults(
  defineProps<{
    /** 地图上方的一句话说明 */
    hint: string
    /** 初始视角 [经度, 纬度, 高度] */
    home: [number, number, number]
  }>(),
  {},
)
</script>

<template>
  <div class="demo-page">
    <section class="map-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ hint }}</span>
      </div>
      <CesiumViewer class="map" :home="home">
        <slot name="panel" />
      </CesiumViewer>
    </section>

    <slot name="guide" />
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.map-wrap {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.hint {
  display: flex;
  flex: none;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.55;
}
.hint .el-icon {
  flex: none;
  margin-top: 2px;
}
.map {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
:deep(.code-pane) {
  width: 460px;
  flex: none;
}
@media (max-width: 1366px) {
  :deep(.code-pane) {
    width: 380px;
  }
}
</style>
