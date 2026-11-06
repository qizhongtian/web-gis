import http from './http'

export const login = (username: string, password: string) =>
  http.post<never, { code: number; message: string; data: { token: string } }>('/login', { username, password })

export const logout = () => http.post('/logout')

export const getUserInfo = () => http.get<never, { data: import('@/types/global').UserInfo }>('/user/info')

export const getMenus = () => http.get<never, { data: import('@/types/global').MenuItem[] }>('/menus')
