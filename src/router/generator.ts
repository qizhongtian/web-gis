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
      component: viewModules[`../views/${menu.component}`] || PassThrough,
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
