import { ref } from 'vue'

/**
 * 全局搜索是「Header 触发器 + 首页入口」共用的单例状态，
 * 所以可见性与预置条件放在模块作用域，而不是组件内部。
 */
const visible = ref(false)
const pending = ref<{ query?: string; category?: string } | null>(null)

/** 打开搜索面板，可预置关键词 / 分类（首页场景化入口使用） */
export function openGlobalSearch(payload?: { query?: string; category?: string }) {
  pending.value = payload ?? null
  visible.value = true
}

export function useGlobalSearch() {
  /** 取走一次性预置条件 */
  function consumePending() {
    const value = pending.value
    pending.value = null
    return value
  }

  return { visible, openGlobalSearch, consumePending }
}
