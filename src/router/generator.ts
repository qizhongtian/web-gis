import { defineComponent, h } from 'vue'
import { RouterView, type RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types/global'
import router from './index'

/** 分组节点：不渲染页面，仅透传子路由 */
const PassThrough = defineComponent({
  name: 'RoutePassThrough',
  render: () => h(RouterView),
})

// 懒加载全部视图（配合 Vite 代码分割）
const viewModules = import.meta.glob('../views/**/*.vue')

/**
 * 需要 keep-alive 缓存的页面：同步导入拿到真实组件对象（带 name），
 * Layout 里的 <keep-alive :include> 靠组件名匹配；懒加载的异步包装没有 name 无法命中。
 * 新增缓存页时，在这里补一条 glob 模式，并给页面加 defineOptions({ name: 'XXX' })，
 * 再把 name 写入 src/layout/index.vue 的 cachedViews。
 */
const cachedModules = import.meta.glob('../views/cesium/tool/vector/index.vue', {
  eager: true,
})

/** 解析页面组件：缓存页取同步导入的组件，其余保持懒加载 */
function resolveView(component: string) {
  const key = `../views/${component}`
  const cached = cachedModules[key] as { default: any } | undefined
  if (cached) return cached.default
  return viewModules[key] || PassThrough
}

export function buildRoutes(menus: MenuItem[]): RouteRecordRaw[] {
  return menus
    .filter((m) => m.path)
    .map((m) => menuToRoute(m))
    .filter(Boolean) as RouteRecordRaw[]
}

function menuToRoute(menu: MenuItem): RouteRecordRaw {
  const children = (menu.children || []).filter((c) => c.path).map((c) => menuToRoute(c))
  const isLeafPage = !!menu.component
  const meta = { title: menu.key, icon: menu.icon, roles: menu.roles }
  if (isLeafPage) {
    return {
      path: menu.path,
      name: pathToName(menu.path),
      component: resolveView(menu.component),
      meta,
    }
  }
  return {
    path: menu.path,
    name: pathToName(menu.path),
    component: PassThrough,
    redirect: children.length ? children[0].path : undefined,
    meta,
    children,
  }
}

export function pathToName(path: string) {
  return (
    path
      .split('/')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('') || 'Root'
  )
}

/** 退出登录时移除动态路由（保留 Layout/Login/404 静态路由） */
export function resetRoutes() {
  router
    .getRoutes()
    .filter((r) => r.name !== 'Layout' && r.name !== 'Login' && r.name !== 'NotFound')
    .forEach((r) => {
      if (r.name) router.removeRoute(r.name)
    })
}
