/**
 * 所有 TMDB 请求都从这个文件发出。
 * 以后想把 key 藏到服务端，或者换成代理，只需要改这里（或设置 VITE_TMDB_API / VITE_TMDB_IMG）。
 */
import { KEYWORD_TO_TAG } from './constants'
import type { CollectionInfo, MovieDetails, MovieLite } from './types'

const API = import.meta.env.VITE_TMDB_API || 'https://api.themoviedb.org/3'
const IMG = import.meta.env.VITE_TMDB_IMG || 'https://image.tmdb.org/t/p'
// key 只从环境变量读取（本地是 .env.local，线上是托管平台的环境变量），网页里没有填写入口
const KEY: string = (import.meta.env.VITE_TMDB_KEY || '').trim()

export const getKey = () => KEY

export const posterUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG}/${size}${path}` : null
export const backdropUrl = (path: string | null) => (path ? `${IMG}/w780${path}` : null)

export class TmdbError extends Error {}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = getKey()
  if (!key) throw new TmdbError('还没有配置 TMDB key：在 .env.local 里填写 VITE_TMDB_KEY 后重启')
  const url = new URL(API + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  // v4 的 Read Access Token 是 JWT（eyJ 开头），放在请求头；v3 的 key 放在查询参数
  const isToken = key.startsWith('eyJ')
  if (!isToken) url.searchParams.set('api_key', key)

  let res: Response
  try {
    res = await fetch(url, isToken ? { headers: { Authorization: `Bearer ${key}` } } : undefined)
  } catch {
    throw new TmdbError('连不上 TMDB，请检查网络')
  }
  if (res.status === 401) throw new TmdbError('TMDB key 无效，请检查 .env.local 里的 VITE_TMDB_KEY')
  if (!res.ok) throw new TmdbError(`TMDB 返回错误（${res.status}）`)
  return res.json() as Promise<T>
}

interface RawMovie {
  id: number
  title?: string
  original_title?: string
  release_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  genre_ids?: number[]
  genres?: { id: number }[]
}

const toLite = (m: RawMovie): MovieLite => ({
  id: m.id,
  title: m.title || m.original_title || '未知片名',
  originalTitle: m.original_title || '',
  year: (m.release_date || '').slice(0, 4),
  posterPath: m.poster_path ?? null,
  backdropPath: m.backdrop_path ?? null,
  overview: m.overview || '',
  genreIds: m.genre_ids ?? m.genres?.map((g) => g.id) ?? [],
})

export async function searchMovies(query: string): Promise<MovieLite[]> {
  const data = await request<{ results: RawMovie[] }>('/search/movie', {
    query,
    language: 'zh-CN',
    include_adult: 'false',
  })
  return data.results.map(toLite)
}

interface RawDetails extends RawMovie {
  runtime?: number | null
  belongs_to_collection?: { id: number; name: string } | null
  keywords?: { keywords?: { name: string }[] }
  similar?: { results?: RawMovie[] }
}

export async function getMovie(id: number): Promise<MovieDetails> {
  const raw = await request<RawDetails>(`/movie/${id}`, {
    language: 'zh-CN',
    append_to_response: 'keywords,similar',
  })
  const lite = toLite(raw)
  // 冷门片常常没有中文简介，回退到英文
  if (!lite.overview) {
    try {
      const en = await request<RawMovie>(`/movie/${id}`, { language: 'en-US' })
      lite.overview = en.overview || ''
    } catch {
      /* 回退失败就保持空简介 */
    }
  }
  const tags = new Set<string>()
  for (const k of raw.keywords?.keywords ?? []) {
    const tag = KEYWORD_TO_TAG[k.name.toLowerCase()]
    if (tag) tags.add(tag)
  }
  return {
    ...lite,
    runtime: raw.runtime || null,
    collection: raw.belongs_to_collection
      ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name }
      : null,
    tags: [...tags],
    similar: (raw.similar?.results ?? []).slice(0, 12).map(toLite),
  }
}

export async function getCollection(id: number): Promise<CollectionInfo> {
  const raw = await request<{ id: number; name: string; parts: RawMovie[] }>(`/collection/${id}`, {
    language: 'zh-CN',
  })
  const parts = raw.parts
    .filter((p) => p.release_date) // 没有上映日期的多半是未拍完的项目
    .sort((a, b) => (a.release_date! < b.release_date! ? -1 : 1))
    .map(toLite)
  return { id: raw.id, name: raw.name, parts, fetchedAt: new Date().toISOString() }
}

export const doubanSearchUrl = (title: string) =>
  `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}`
export const tmdbUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`
