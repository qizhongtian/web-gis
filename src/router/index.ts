import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { startProgress, doneProgress, failProgress } from '@/utils/progress'

export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { hidden: true },
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/index.vue'),
    redirect: '/home',
    children: [], // 动态权限路由由 generator 注入
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/404.vue'),
    meta: { hidden: true },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: staticRoutes,
})

// 页面跳转时顶部显示进度条（首个 beforeEach 注册，先于鉴权守卫执行）
router.beforeEach(() => {
  startProgress()
  return true
})

// 导航结束（含重定向、被取消）都收尾；真正的错误由 onError 走失败态
router.afterEach(() => {
  doneProgress()
})

router.onError(() => failProgress())

export default router
