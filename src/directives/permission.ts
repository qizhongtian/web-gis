import type { Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/store/user'

/**
 * 按钮权限指令：v-permission="'sys:user:add'" 或 v-permission="['a', 'b']"
 * 无权限时移除元素
 */
export const permission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const userStore = useUserStore()
    const value = binding.value
    if (!value) return
    if (!userStore.hasPermission(value)) {
      el.parentNode?.removeChild(el)
    }
  },
}

export default permission
