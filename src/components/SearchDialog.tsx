import { Bookmark, Check, Eye, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { addMovie, useOverlay } from '../lib/actions'
import { HORROR_GENRE_ID } from '../lib/constants'
import { useLog, useUi } from '../lib/store'
import { getKey, searchMovies } from '../lib/tmdb'
import type { MovieLite } from '../lib/types'
import { Poster } from './ui'

function Result({ movie }: { movie: MovieLite }) {
  const entry = useLog((s) => s.entries[movie.id])
  const { openDetail, setSearchOpen } = useUi()
  const status = entry && !entry.deleted ? entry.status : null

  const open = () => {
    setSearchOpen(false)
    openDetail(movie)
  }

  return (
    <li className="flex gap-3.5 border-b border-line py-3.5">
      <button onClick={open} className="w-[68px] shrink-0 self-start" aria-label={`查看《${movie.title}》`}>
        <Poster movie={movie} size="w185" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={open} className="block max-w-full text-left hover:text-flare">
          <span className="font-medium">{movie.title}</span>
          <span className="num ml-2 text-[13px] text-ash">{movie.year}</span>
        </button>
        {movie.originalTitle && movie.originalTitle !== movie.title && (
          <p className="truncate text-[13px] text-dim">{movie.originalTitle}</p>
        )}
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ash">{movie.overview || '暂无中文简介'}</p>
        <div className="mt-2.5 flex gap-2">
          {status === 'watched' ? (
            <span className="chip border-transparent px-0 text-bone hover:border-transparent">
              <Check size={14} className="mr-1 text-flare" />
              已在"看过"里
            </span>
          ) : (
            <>
              <button
                className="chip"
                onClick={() => {
                  addMovie(movie, 'watched')
                  open() // 标为看过后直接进详情评级
                }}
              >
                <Eye size={14} className="mr-1.5" />
                看过
              </button>
              {status === 'wishlist' ? (
                <span className="chip border-transparent px-0 hover:border-transparent">
                  <Check size={14} className="mr-1 text-flare" />
                  已在"想看"里
                </span>
              ) : (
                <button className="chip" onClick={() => addMovie(movie, 'wishlist')}>
                  <Bookmark size={14} className="mr-1.5" />
                  想看
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export function SearchDialog() {
  const { searchOpen, setSearchOpen, go } = useUi()
  const [query, setQuery] = useState('')
  const [horrorOnly, setHorrorOnly] = useState(true)
  const [results, setResults] = useState<MovieLite[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const close = () => setSearchOpen(false)
  useOverlay(searchOpen, close)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  // 停止输入 350 毫秒后再发请求
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      setError('')
      return
    }
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      searchMovies(q)
        .then((r) => {
          if (!alive) return
          setResults(r)
          setError('')
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false))
    }, 350)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  if (!searchOpen) return null

  const horror = results?.filter((m) => m.genreIds.includes(HORROR_GENRE_ID)) ?? []
  const shown = horrorOnly ? horror : (results ?? [])
  const hidden = (results?.length ?? 0) - horror.length
  const noKey = !getKey()

  return (
    <div className="anim-fade fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索电影"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-panel md:mt-[8vh] md:h-auto md:max-h-[80vh] md:rounded-lg md:border md:border-line"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={18} className="shrink-0 text-flare" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入片名，中文英文都可以"
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-dim"
            enterKeyHint="search"
          />
          <button onClick={close} className="btn btn-quiet h-9 px-2" aria-label="关闭搜索">
            <X size={19} />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 text-[13px] text-ash">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={horrorOnly}
              onChange={(e) => setHorrorOnly(e.target.checked)}
              className="h-4 w-4 accent-[#c8102e]"
            />
            只看恐怖片
          </label>
          {loading && <span>搜索中</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {noKey ? (
            <div className="py-8">
              <p className="mb-3 text-sm text-ash">搜索需要一个 TMDB key（免费）。填好之后就能搜到海报和简介。</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  close()
                  go('settings')
                }}
              >
                去设置里填写
              </button>
            </div>
          ) : error ? (
            <p className="py-8 text-sm text-flare">{error}</p>
          ) : results === null ? (
            <p className="py-8 text-sm text-dim">结果会显示海报、年份和简介，可以直接标为看过或想看。</p>
          ) : shown.length === 0 && !loading ? (
            <div className="py-8 text-sm text-ash">
              <p>没有找到{horrorOnly ? '恐怖类型的' : ''}结果。</p>
              {horrorOnly && hidden > 0 && (
                <button className="mt-2 text-bone underline" onClick={() => setHorrorOnly(false)}>
                  显示其他类型的 {hidden} 个结果
                </button>
              )}
            </div>
          ) : (
            <ul>
              {shown.map((m) => (
                <Result key={m.id} movie={m} />
              ))}
              {horrorOnly && hidden > 0 && (
                <li className="pt-4 text-[13px] text-dim">
                  另有 {hidden} 个其他类型的结果。
                  <button className="ml-1 text-ash underline" onClick={() => setHorrorOnly(false)}>
                    全部显示
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
