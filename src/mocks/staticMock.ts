/**
 * 静态托管环境的 Mock（GitHub Pages 没有 Node 进程，Vite 中间件用不了）
 *
 * 用法：在 axios 实例上挂 adapter
 *   if (import.meta.env.VITE_STATIC_MOCK === '1') http.defaults.adapter = staticMockAdapter
 *
 * 与 mock/index.ts 共用 src/mocks/db.ts 的数据，接口路径、返回结构（code/message/data）完全一致。
 */
import { AxiosHeaders } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  filterMenus,
  makeToken,
  mockMenus,
  mockRoles,
  mockUsers,
  publicUser,
  userFromToken,
  type MockUser,
} from './db'

function parseBody(data: unknown): Record<string, any> {
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data as Record<string, any>
}

function reply(config: InternalAxiosRequestConfig, data: any, status = 200): AxiosResponse {
  return { data, status, statusText: 'OK', headers: new AxiosHeaders(), config }
}

const ok = (config: InternalAxiosRequestConfig, data: any = null) =>
  reply(config, { code: 0, message: 'ok', data })

const fail = (config: InternalAxiosRequestConfig, message: string) =>
  reply(config, { code: 1, message, data: null })

/** 抛 401 给响应拦截器：清 token 并跳登录页 */
function unauthorized(config: InternalAxiosRequestConfig): never {
  const error: any = new Error('未登录或登录已过期')
  error.response = reply(config, { code: 1, message: '未登录或登录已过期', data: null }, 401)
  throw error
}

function readToken(config: InternalAxiosRequestConfig): string {
  const headers = config.headers as any
  const raw = headers?.Authorization || headers?.get?.('Authorization') || ''
  return String(raw).replace(/^Bearer\s+/, '')
}

export const staticMockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method || 'get').toUpperCase()
  const url = (config.url || '').split('?')[0].replace(/^\/api/, '')
  const body = parseBody(config.data)

  // ---------- 登录 ----------
  if (method === 'POST' && url === '/login') {
    const user = mockUsers.find(
      (u) => u.username === body.username && u.password === body.password,
    )
    if (!user) return fail(config, '用户名或密码错误')
    return ok(config, { token: makeToken(user.username) })
  }

  // ---------- 以下接口需要鉴权 ----------
  const user: MockUser | null = userFromToken(readToken(config))
  if (!user) unauthorized(config)

  if (url === '/user/info') return ok(config, publicUser(user!))

  if (url === '/menus') {
    const menus = mockMenus
      .map((m) => filterMenus(m, user!.roles))
      .filter((m): m is NonNullable<typeof m> => !!m)
    return ok(config, menus)
  }

  if (url === '/users' && method === 'GET') return ok(config, mockUsers.map(publicUser))

  if (url === '/users' && method === 'POST') {
    if (mockUsers.some((u) => u.username === body.username)) return fail(config, '用户名已存在')
    const id = Math.max(...mockUsers.map((u) => u.id)) + 1
    mockUsers.push({
      id,
      username: body.username,
      password: body.password || '123456',
      nickname: body.nickname || body.username,
      roles: body.roles || ['viewer'],
      permissions: [],
    })
    return ok(config)
  }

  if (url.startsWith('/users/') && method === 'DELETE') {
    const id = Number(url.split('/')[2])
    const index = mockUsers.findIndex((u) => u.id === id)
    if (index > -1) mockUsers.splice(index, 1)
    return ok(config)
  }

  if (url === '/roles' && method === 'GET') return ok(config, mockRoles)

  if (url === '/roles' && method === 'POST') {
    mockRoles.push({
      id: mockRoles.length + 1,
      key: body.key,
      name: body.name,
      remark: body.remark || '',
    })
    return ok(config)
  }

  if (url === '/logout') return ok(config)

  return fail(config, '接口不存在: ' + url)
}

/** 是否启用静态 mock：构建时通过 VITE_STATIC_MOCK=1 打开 */
export const useStaticMock = import.meta.env.VITE_STATIC_MOCK === '1'
