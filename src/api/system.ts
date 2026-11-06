import http from './http'

/** 系统管理相关接口（Mock） */
export const getUsers = () => http.get<never, { data: any[] }>('/users')
export const addUser = (data: { username: string; nickname?: string; roles: string[] }) => http.post('/users', data)
export const deleteUser = (id: number) => http.delete(`/users/${id}`)
export const getRoles = () => http.get<never, { data: any[] }>('/roles')
export const addRole = (data: { key: string; name: string; remark?: string }) => http.post('/roles', data)
