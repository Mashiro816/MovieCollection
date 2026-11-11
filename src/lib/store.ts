import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { today } from './constants'
import type { CollectionInfo, Entry, MovieDetails, MovieLite, Status } from './types'

/** 片单数据：保存在浏览器 localStorage；登录后由 sync.ts 同步到 Supabase */
interface LogState {
  entries: Record<number, Entry>
  collections: Record<number, CollectionInfo>
  add: (movie: MovieLite, status: Status) => void
  patch: (id: number, changes: Partial<Entry>) => void
  enrich: (details: MovieDetails) => void
  remove: (id: number) => void
  /** 合并来自云端或导入文件的记录，同一部电影保留 updatedAt 较新的一份 */
  merge: (incoming: Entry[]) => void
  setCollection: (info: CollectionInfo) => void
}

const now = () => new Date().toISOString()

/** 本地有改动时通知同步模块（避免 store 和 sync 互相引用） */
const listeners = new Set<(id: number) => void>()
export const onLocalChange = (fn: (id: number) => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const changed = (id: number) => listeners.forEach((fn) => fn(id))

export const useLog = create<LogState>()(
  persist(
    (set, get) => ({
      entries: {},
      collections: {},

      add: (movie, status) => {
        const prev = get().entries[movie.id]
        const base: Entry =
          prev && !prev.deleted
            ? prev
            : {
                ...movie,
                runtime: null,
                collection: null,
                tags: [],
                status,
                tier: null,
                scare: 0,
                watchedAt: null,
                note: '',
                context: { company: null, place: null },
                addedAt: now(),
                updatedAt: now(),
              }
        const entry: Entry = {
          ...base,
          status,
          watchedAt: status === 'watched' ? (base.watchedAt ?? today()) : base.watchedAt,
          deleted: false,
          updatedAt: now(),
        }
        set((s) => ({ entries: { ...s.entries, [movie.id]: entry } }))
        changed(movie.id)
      },

      patch: (id, changes) => {
        const prev = get().entries[id]
        if (!prev) return
        set((s) => ({ entries: { ...s.entries, [id]: { ...prev, ...changes, updatedAt: now() } } }))
        changed(id)
      },

      // 用 TMDB 详情补全片长、系列、标签。每部电影只补全一次，之后手动改的标签不会被覆盖
      enrich: (d) => {
        const prev = get().entries[d.id]
        if (!prev || prev.deleted || prev.enriched) return
        get().patch(d.id, {
          runtime: d.runtime,
          collection: d.collection,
          tags: prev.tags.length ? prev.tags : d.tags,
          overview: prev.overview || d.overview,
          backdropPath: prev.backdropPath ?? d.backdropPath,
          enriched: true,
        })
      },

      remove: (id) => get().patch(id, { deleted: true }),

      merge: (incoming) =>
        set((s) => {
          const entries = { ...s.entries }
          for (const e of incoming) {
            const local = entries[e.id]
            if (!local || e.updatedAt > local.updatedAt) entries[e.id] = e
          }
          return { entries }
        }),

      setCollection: (info) => set((s) => ({ collections: { ...s.collections, [info.id]: info } })),
    }),
    {
      name: 'midnight-log-v1',
      version: 2,
      // 旧版本曾把 TMDB key 存在浏览器里，升级时删掉
      migrate: (persisted) => {
        const state = { ...(persisted as Record<string, unknown>) }
        delete state.tmdbKey
        return state as unknown as LogState
      },
    },
  ),
)

/** 未删除的全部记录 */
export function useEntries(): Entry[] {
  const entries = useLog((s) => s.entries)
  return useMemo(() => Object.values(entries).filter((e) => !e.deleted), [entries])
}

export function useEntry(id: number | undefined): Entry | null {
  const e = useLog((s) => (id == null ? undefined : s.entries[id]))
  return e && !e.deleted ? e : null
}

/* ---------- 界面状态（不保存） ---------- */

export type View = 'library' | 'tiers' | 'series' | 'stats' | 'settings'
export type LibraryView = 'grid' | 'ring'

const VIEW_KEY = 'midnight-log-view'
function readView(): LibraryView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'ring' ? 'ring' : 'grid'
  } catch {
    return 'grid'
  }
}

interface UiState {
  view: View
  libraryTab: Status
  /** 片单的展示方式：海报墙或环形展台。记在浏览器里，下次打开还是上次选的 */
  libraryView: LibraryView
  detail: MovieLite | null
  searchOpen: boolean
  tonightOpen: boolean
  go: (view: View) => void
  setLibraryTab: (tab: Status) => void
  setLibraryView: (view: LibraryView) => void
  openDetail: (movie: MovieLite | null) => void
  setSearchOpen: (open: boolean) => void
  setTonightOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  view: 'library',
  libraryTab: 'watched',
  libraryView: readView(),
  detail: null,
  searchOpen: false,
  tonightOpen: false,
  go: (view) => {
    window.scrollTo(0, 0) // 换页面时回到顶部
    set({ view, detail: null })
  },
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  setLibraryView: (libraryView) => {
    try {
      localStorage.setItem(VIEW_KEY, libraryView)
    } catch {
      /* 存不了就只在本次打开期间生效 */
    }
    set({ libraryView })
  },
  openDetail: (detail) => set({ detail }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setTonightOpen: (tonightOpen) => set({ tonightOpen }),
}))
