import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/** 应用全局状态：语言、侧边栏、移动端抽屉 */
export const useAppStore = defineStore('app', () => {
  const locale = useLocalStorage<'zh-CN' | 'en'>('wg-locale', 'zh-CN')
  const sidebarCollapsed = useLocalStorage('wg-sidebar-collapsed', false)

  /** 是否为小屏（由 Layout 通过 useMediaQuery 同步） */
  const isMobile = ref(false)
  /** 小屏下的抽屉菜单 */
  const drawerVisible = ref(false)

  function toggleSidebar() {
    if (isMobile.value) drawerVisible.value = !drawerVisible.value
    else sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function closeDrawer() {
    drawerVisible.value = false
  }

  return { locale, sidebarCollapsed, isMobile, drawerVisible, toggleSidebar, closeDrawer }
})
