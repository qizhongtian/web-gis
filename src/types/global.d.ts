/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}

/** Mock 菜单节点 */
export interface MenuItem {
  id: number
  label: string
  labelEn?: string
  /** i18n key，如 menus.home */
  key: string
  icon: string
  path: string
  /** 视图组件路径（相对 src/views），为空表示分组节点 */
  component: string
  roles: string[]
  children: MenuItem[]
}

export interface UserInfo {
  id: number
  username: string
  nickname: string
  roles: string[]
  permissions: string[]
}

export interface ApiResult<T = any> {
  code: number
  message: string
  data: T
}
