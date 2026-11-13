import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  filterMenus,
  makeToken,
  mockMenus,
  mockRoles,
  mockUsers,
  publicUser,
  userFromToken,
  type MockRole,
  type MockUser,
} from '../src/mocks/db'

/**
 * 轻量 Mock 服务（Vite Dev 中间件，无额外依赖）
 * 数据与浏览器端静态 mock 共用 src/mocks/db.ts
 * 生产环境静态托管时改由 src/mocks/staticMock.ts 接管（VITE_STATIC_MOCK=1）
 */

// 登录态：token -> 用户
const tokens = new Map<string, MockUser>()

function json(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}
const ok = (res: ServerResponse, data: any = null) => json(res, { code: 0, message: 'ok', data })
const fail = (res: ServerResponse, message: string, status = 400) =>
  json(res, { code: 1, message, data: null }, status)

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function currentUser(req: IncomingMessage): MockUser | null {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  return tokens.get(token) || userFromToken(token)
}

// ---------- plugin ----------
export default function mockServerPlugin(): Plugin {
  return {
    name: 'web-gis-mock-server',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        void handle(req as IncomingMessage, res as ServerResponse)
      })
    },
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = (req.url || '').split('?')[0]
  const method = (req.method || 'GET').toUpperCase()

  // 登录
  if (method === 'POST' && url === '/login') {
    const { username, password } = await readBody(req)
    const user = mockUsers.find((u) => u.username === username && u.password === password)
    if (!user) return fail(res, '用户名或密码错误')
    const token = makeToken(user.username)
    tokens.set(token, user)
    return ok(res, { token })
  }

  // 以下接口需要鉴权
  const user = currentUser(req)
  if (!user) return fail(res, '未登录或登录已过期', 401)

  if (url === '/user/info') return ok(res, publicUser(user))

  if (url === '/menus') {
    return ok(res, mockMenus.map((m) => filterMenus(m, user.roles)).filter(Boolean))
  }

  if (url === '/users' && method === 'GET') return ok(res, mockUsers.map(publicUser))

  if (url === '/users' && method === 'POST') {
    const body = await readBody(req)
    if (mockUsers.some((u) => u.username === body.username)) return fail(res, '用户名已存在')
    const id = Math.max(...mockUsers.map((u) => u.id)) + 1
    mockUsers.push({
      id,
      username: body.username,
      password: body.password || '123456',
      nickname: body.nickname || body.username,
      roles: body.roles || ['viewer'],
      permissions: [],
    })
    return ok(res)
  }

  if (url.startsWith('/users/') && method === 'DELETE') {
    const id = Number(url.split('/')[2])
    const index = mockUsers.findIndex((u) => u.id === id)
    if (index > -1) mockUsers.splice(index, 1)
    return ok(res)
  }

  if (url === '/roles' && method === 'GET') return ok(res, mockRoles)

  if (url === '/roles' && method === 'POST') {
    const body = await readBody(req)
    const role: MockRole = {
      id: mockRoles.length + 1,
      key: body.key,
      name: body.name,
      remark: body.remark || '',
    }
    mockRoles.push(role)
    return ok(res)
  }

  if (url === '/logout') {
    tokens.delete((req.headers.authorization || '').replace('Bearer ', ''))
    return ok(res)
  }

  fail(res, '接口不存在: ' + url, 404)
}
