import router from '@/router'
import { useUserStore } from '@/store/user'

const WHITE_LIST = ['/login']

/** 全局路由守卫：鉴权 + 动态路由装载 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  if (WHITE_LIST.includes(to.path)) {
    return userStore.token ? { path: '/home' } : true
  }

  if (!userStore.token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 首次进入或刷新后：加载用户信息并注册动态路由
  if (!userStore.isRoutesLoaded) {
    try {
      await userStore.loadUserRoutes()
      // 重新进入当前目标，确保新注册的路由可被解析
      return { path: to.path, query: to.query, replace: true }
    } catch (e) {
      await userStore.logoutAction()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  return true
})
