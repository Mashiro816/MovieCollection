/**
 * 所有 TMDB 请求都从这个文件发出。
 * 浏览器不直接访问 TMDB，而是请求自己网站的 /api/tmdb，由服务端带上 key 转发（见 server/tmdb-proxy.js）。
 * 所以 key 不会出现在前端代码和浏览器的网络请求里。
 */
import { KEYWORD_TO_TAG } from './constants'
import type { CollectionInfo, MovieDetails, MovieLite } from './types'

const API = '/api/tmdb'
// 海报图片不需要 key，直接从 TMDB 的图片服务器加载
const IMG = import.meta.env.VITE_TMDB_IMG || 'https://image.tmdb.org/t/p'

export const posterUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG}/${size}${path}` : null
export const backdropUrl = (path: string | null, size: 'w780' | 'w1280' = 'w780') =>
  path ? `${IMG}/${size}${path}` : null

export class TmdbError extends Error {}

const ERRORS: Record<string, string> = {
  missing_key: '服务端还没有配置 TMDB key：本地在 .env.local 里填写 TMDB_KEY 后重启，线上在 Vercel 的环境变量里添加',
  invalid_key: 'TMDB key 无效，请检查环境变量 TMDB_KEY',
  upstream_unreachable: '服务端连不上 TMDB，稍后再试',
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ path, ...params })
  let res: Response
  try {
    res = await fetch(`${API}?${query}`)
  } catch {
    throw new TmdbError('网络连接失败，请检查网络')
  }
  if (res.ok) return res.json() as Promise<T>

  const code = await res
    .json()
    .then((body: { error?: string }) => body.error ?? '')
    .catch(() => '')
  if (ERRORS[code]) throw new TmdbError(ERRORS[code])
  if (res.status === 404 && !code) throw new TmdbError('找不到 /api/tmdb：当前的托管环境没有运行服务端函数')
  throw new TmdbError(`获取电影数据失败（${res.status}）`)
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
