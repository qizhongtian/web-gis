import axios from 'axios'
import type { ApiResult } from '@/types/global'
import { staticMockAdapter, useStaticMock } from '@/mocks/staticMock'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000,
})

// 纯静态托管（GitHub Pages）没有后端进程：挂内置 mock adapter，登录与菜单照常可用
if (useStaticMock) http.defaults.adapter = staticMockAdapter

http.interceptors.request.use((config) => {
  // VueUse useLocalStorage 对字符串原样存储，直接读取即可（兼容带引号的 JSON 格式）
  let token = localStorage.getItem('wg-token') || ''
  if (token.startsWith('"')) {
    try {
      token = JSON.parse(token)
    } catch {
      token = token.replace(/^"|"$/g, '')
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (resp) => {
    const res = resp.data as ApiResult
    if (res.code !== 0) return Promise.reject(new Error(res.message))
    return res as any
  },
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('wg-token')
      if (!location.hash.includes('/login')) {
        location.hash = '#/login'
        location.reload() // 清空内存态，确保守卫重新走登录流程
      }
    }
    return Promise.reject(err)
  },
)

export default http
