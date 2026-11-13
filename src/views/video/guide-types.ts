/** 说明面板里的一条注意事项，正文用反引号包住的部分会渲染成行内代码 */
export type { NoteItem } from '@/components/GuidePanel.vue'

/** 播放页日志行：时间 + 事件名 + 简述 */
export interface PlayLogItem {
  time: string
  type: string
  text: string
}
