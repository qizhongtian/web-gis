import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { login, logout, getUserInfo, getMenus } from '@/api/user'
import { buildRoutes, resetRoutes } from '@/router/generator'
import type { MenuItem, UserInfo } from '@/types/global'
import router from '@/router'

/** 用户/权限状态 */
export const useUserStore = defineStore('user', () => {
  const token = useLocalStorage<string>('wg-token', '')
  const userInfo = ref<UserInfo | null>(null)
  const menus = ref<MenuItem[]>([])
  const isRoutesLoaded = ref(false)

  const permissions = computed(() => userInfo.value?.permissions || [])
  const roles = computed(() => userInfo.value?.roles || [])

  async function loginAction(username: string, password: string) {
    const { data } = await login(username, password)
    token.value = data.token
    return data
  }

  /** 拉取用户信息 + 权限菜单，并动态注册路由 */
  async function loadUserRoutes() {
    const [infoRes, menuRes] = await Promise.all([getUserInfo(), getMenus()])
    userInfo.value = infoRes.data
    menus.value = menuRes.data
    const routes = buildRoutes(menuRes.data)
    routes.forEach((r) => router.addRoute('Layout', r))
    isRoutesLoaded.value = true
  }

  async function logoutAction() {
    try {
      await logout()
    } finally {
      resetRoutes()
      token.value = ''
      userInfo.value = null
      menus.value = []
      isRoutesLoaded.value = false
    }
  }

  function hasPermission(perms: string | string[]) {
    const list = Array.isArray(perms) ? perms : [perms]
    return list.some((p) => permissions.value.includes(p))
  }

  return {
    token,
    userInfo,
    menus,
    isRoutesLoaded,
    permissions,
    roles,
    loginAction,
    loadUserRoutes,
    logoutAction,
    hasPermission,
  }
})
