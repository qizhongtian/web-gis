<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadThree } from '@/utils/gis/threeLoader'

/**
 * Three.js 示例页统一布局：左侧「提示条 + 工具条 + 画布」，右侧「专业解释 / 关键代码 / 注意事项」
 * - 工具条插槽放滑块、按钮等交互控件，避免遮住画布
 * - guide 插槽放 GuidePanel，宽度由这里统一约束
 */
const props = withDefaults(
  defineProps<{
    /** 画布上方的一句话说明 */
    hint: string
    /** DemoBox 的初始化函数，返回清理函数 */
    init: (THREE: any, el: HTMLElement) => void | (() => void) | Promise<void | (() => void)>
    /** 库加载器，默认加载本地 three 包 */
    loader?: () => Promise<any>
  }>(),
  { loader: loadThree },
)
</script>

<template>
  <div class="three-demo">
    <section class="stage-col">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ props.hint }}</span>
      </div>

      <div v-if="$slots.panel" class="toolbar">
        <slot name="panel" />
      </div>

      <DemoBox class="canvas" tech :loader="props.loader" :init="props.init" />
    </section>

    <slot name="guide" />
  </div>
</template>

<style scoped>
.three-demo {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.stage-col {
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
.toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #e6e8eb;
  background: #fbfcfe;
  color: #64748b;
  font-size: 12px;
}
.toolbar :deep(.label) {
  color: #94a3b8;
}
.canvas {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
:deep(.code-pane) {
  width: 440px;
  flex: none;
}
@media (max-width: 1366px) {
  :deep(.code-pane) {
    width: 380px;
  }
}
</style>
