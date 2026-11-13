<script setup lang="ts">
/**
 * 播放类示例页的通用外壳：顶部提示条 + 播放舞台 + 操作区 + 事件日志 + 右侧说明面板
 *
 * 实时画面/回放已经自带一套，这里抽出来给 FLV.js、HLS.js 两个页面复用，
 * 页面只需要提供 stage（video/容器）与 controls（表单）两个插槽。
 */
import GuidePanel from './GuidePanel.vue'
import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem, PlayLogItem } from './guide-types'

const props = withDefaults(
  defineProps<{
    /** loading 加载中 / ready 可播放 / error 资源不可用 */
    status: 'loading' | 'ready' | 'error'
    /** 右上角状态文案 */
    statusText: string
    /** 错误态展示的详细信息 */
    errorMsg?: string
    /** 事件日志，最新在最上 */
    logs: PlayLogItem[]
    /** 右侧「使用说明」代码块 */
    blocks: CodeBlock[]
    /** 右侧「注意事项」条目 */
    notes: NoteItem[]
    /** 错误态下方的排查建议（纯文本，可用反引号包行内代码） */
    errorTip?: string
  }>(),
  {
    errorMsg: '',
    errorTip: '',
  },
)

const emit = defineEmits<{ retry: []; clear: [] }>()

/** 用反引号切分正文，奇数段渲染成行内代码 */
function splitCode(text: string) {
  return text.split('`')
}
</script>

<template>
  <div class="player-page">
    <section class="stage-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span class="hint-text"><slot name="hint" /></span>
        <span class="status-chip" :class="props.status">
          <i class="dot" />
          {{ props.statusText }}
        </span>
      </div>

      <div class="stage-card">
        <slot name="stage" />

        <div v-if="props.status === 'error'" class="stage-mask">
          <el-icon class="warn-icon"><WarningFilled /></el-icon>
          <p class="mask-title">播放失败</p>
          <p class="mask-desc">{{ props.errorMsg }}</p>
          <p v-if="props.errorTip" class="mask-tip">
            <template v-for="(seg, i) in splitCode(props.errorTip)" :key="i">
              <code v-if="i % 2">{{ seg }}</code>
              <span v-else>{{ seg }}</span>
            </template>
          </p>
          <el-button type="primary" @click="emit('retry')">重新加载</el-button>
        </div>
      </div>

      <div class="ops-card">
        <slot name="controls" />

        <div class="log-row">
          <div class="log-head">
            <span class="label">播放器事件</span>
            <button type="button" class="clear-btn" @click="emit('clear')">清空</button>
          </div>
          <ul class="logs">
            <li v-if="!props.logs.length" class="empty">暂无事件，播放或切换画质后这里会打印回调</li>
            <li v-for="(l, i) in props.logs" :key="i">
              <span class="time">{{ l.time }}</span>
              <span class="type">{{ l.type }}</span>
              <span class="text">{{ l.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <GuidePanel class="side-pane" :blocks="props.blocks" :notes="props.notes" />
  </div>
</template>

<style scoped>
.player-page {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.stage-wrap {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.hint {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.55;
}
.hint-text {
  flex: 1;
  min-width: 0;
}
.status-chip {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
  max-width: 260px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: rgba(255, 255, 255, 0.75);
  color: #475569;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-chip .dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}
.status-chip.ready .dot {
  background: #22c55e;
}
.status-chip.error .dot {
  background: #ef4444;
}
.stage-card {
  position: relative;
  flex: 1;
  min-height: 240px;
  border-radius: 12px;
  overflow: hidden;
  background: #0b1623;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
}
.stage-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  background: rgba(11, 22, 35, 0.94);
  text-align: center;
}
.warn-icon {
  font-size: 30px;
  color: #f59e0b;
}
.mask-title {
  margin: 0;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}
.mask-desc {
  margin: 0;
  max-width: 620px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}
.mask-tip {
  margin: 0 0 6px;
  max-width: 620px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.6;
}
.mask-tip code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}
.ops-card {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
.label {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}
.log-row {
  border-top: 1px dashed #e2e8f0;
  padding-top: 5px;
}
.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.clear-btn {
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
}
.clear-btn:hover {
  color: #2563eb;
  background: #eff6ff;
}
.logs {
  margin: 2px 0 0;
  padding: 0;
  height: 62px;
  overflow: auto;
  list-style: none;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.55;
  color: #475569;
}
.logs li {
  display: flex;
  gap: 8px;
  padding: 1px 0;
}
.logs .empty {
  color: #b6c2d2;
  font-style: italic;
}
.logs .time {
  flex: none;
  color: #cbd5e1;
}
.logs .type {
  flex: none;
  padding: 0 4px;
  height: 15px;
  line-height: 15px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
}
.logs .text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-pane {
  flex: none;
  width: 460px;
}
@media (max-width: 1366px) {
  .side-pane {
    width: 380px;
  }
}
</style>
