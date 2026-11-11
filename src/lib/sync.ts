/**
 * 云同步（可选）。没配置 Supabase 时这个文件什么都不做，数据只存在本机。
 *
 * 规则很简单：每部电影一行，谁的 updatedAt 新就用谁的（后改的覆盖先改的）。
 * 删除是"软删除"（deleted: true），这样删除也能同步到其他设备。
 */
import { createClient, type Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { onLocalChange, useLog } from './store'
import type { Entry } from './types'

const url: string = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const cloudEnabled = Boolean(supabase)

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'

interface SyncState {
  session: Session | null
  status: SyncStatus
  error: string
  lastSyncedAt: string | null
}

export const useSync = create<SyncState>()(() => ({
  session: null,
  status: 'idle',
  error: '',
  lastSyncedAt: null,
}))

const dirty = new Set<number>()
let flushTimer: ReturnType<typeof setTimeout> | undefined

const toRow = (e: Entry) => ({ tmdb_id: e.id, data: e, updated_at: e.updatedAt })

async function push(entries: Entry[]) {
  if (!supabase || entries.length === 0) return
  const { error } = await supabase.from('entries').upsert(entries.map(toRow), { onConflict: 'user_id,tmdb_id' })
  if (error) throw error
}

/** 完整同步：拉取云端全部记录，与本地合并，再把本地较新的推上去 */
export async function syncAll() {
  if (!supabase || !useSync.getState().session) return
  useSync.setState({ status: 'syncing', error: '' })
  try {
    // Supabase 一次最多返回 1000 行，分页取完
    const remote: Entry[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('entries')
        .select('data')
        .order('tmdb_id')
        .range(from, from + 999)
      if (error) throw error
      remote.push(...(data ?? []).map((r) => r.data as Entry))
      if (!data || data.length < 1000) break
    }
    const remoteById = new Map(remote.map((e) => [e.id, e]))

    useLog.getState().merge(remote)

    const local = Object.values(useLog.getState().entries)
    const newer = local.filter((e) => {
      const r = remoteById.get(e.id)
      return !r || e.updatedAt > r.updatedAt
    })
    await push(newer)
    dirty.clear()
    useSync.setState({ status: 'ok', lastSyncedAt: new Date().toISOString() })
  } catch (err) {
    useSync.setState({ status: 'error', error: err instanceof Error ? err.message : '同步失败' })
  }
}

/** 只推送刚改过的几条，改动后延迟 1.2 秒合并发送 */
async function flush() {
  if (!supabase || !useSync.getState().session || dirty.size === 0) return
  const ids = [...dirty]
  dirty.clear()
  const all = useLog.getState().entries
  try {
    await push(ids.map((id) => all[id]).filter(Boolean))
    useSync.setState({ status: 'ok', error: '', lastSyncedAt: new Date().toISOString() })
  } catch (err) {
    ids.forEach((id) => dirty.add(id)) // 失败的留到下次完整同步
    useSync.setState({ status: 'error', error: err instanceof Error ? err.message : '同步失败' })
  }
}

/** 应用启动时调用一次 */
export function initSync() {
  if (!supabase) return

  supabase.auth.onAuthStateChange((_event, session) => {
    const wasSignedIn = Boolean(useSync.getState().session)
    useSync.setState({ session })
    if (session && !wasSignedIn) void syncAll()
  })

  onLocalChange((id) => {
    dirty.add(id)
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => void flush(), 1200)
  })

  // 切回这个页面时拉一次，拿到另一台设备上的改动
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncAll()
  })
}

export async function signIn(email: string, password: string) {
  if (!supabase) return '未配置云同步'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error?.message ?? ''
}

export async function signUp(email: string, password: string) {
  if (!supabase) return '未配置云同步'
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return error.message
  // Supabase 默认要求邮箱验证：此时没有 session，需要先去邮箱点确认链接
  return data.session ? '' : '注册成功。请到邮箱点击确认链接，然后回来登录'
}

export async function signOut() {
  await supabase?.auth.signOut()
  useSync.setState({ status: 'idle', lastSyncedAt: null })
}
