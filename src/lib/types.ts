export type TierId = 'S' | 'A' | 'B' | 'C' | 'D'
export type Status = 'watched' | 'wishlist'

/** 观影方式，每一项都可以不填 */
export interface WatchContext {
  company: 'solo' | 'friends' | null
  time: 'night' | 'day' | null
  place: 'cinema' | 'home' | null
}

/** 一部电影的基本信息，来自 TMDB。搜索结果、相似影片、系列成员都用它 */
export interface MovieLite {
  id: number
  title: string
  originalTitle: string
  year: string
  posterPath: string | null
  backdropPath: string | null
  overview: string
  genreIds: number[]
}

/** 片单里的一条记录 = 电影信息 + 你自己的记录 */
export interface Entry extends MovieLite {
  runtime: number | null
  collection: { id: number; name: string } | null
  /** 子类型标签（中文），由 TMDB 关键词自动生成，可手动增删 */
  tags: string[]
  status: Status
  tier: TierId | null
  /** 吓人指数 0-5，0 表示未填 */
  scare: number
  /** 观看日期 YYYY-MM-DD */
  watchedAt: string | null
  note: string
  context: WatchContext
  addedAt: string
  /** 同步时按这个时间判断新旧，后改的覆盖先改的 */
  updatedAt: string
  /** 是否已用 TMDB 详情补全过（片长、系列、标签），避免覆盖手动改过的标签 */
  enriched?: boolean
  /** 软删除：保留记录以便把"删除"同步到其他设备 */
  deleted?: boolean
}

export interface CollectionInfo {
  id: number
  name: string
  parts: MovieLite[]
  fetchedAt: string
}

export interface MovieDetails extends MovieLite {
  runtime: number | null
  collection: { id: number; name: string } | null
  tags: string[]
  similar: MovieLite[]
}
