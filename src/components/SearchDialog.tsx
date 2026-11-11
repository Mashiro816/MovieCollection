import { Bookmark, Check, Eye, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { addMovie, useOverlay } from '../lib/actions'
import { HORROR_GENRE_ID } from '../lib/constants'
import { useLog, useUi } from '../lib/store'
import { searchMovies } from '../lib/tmdb'
import type { MovieLite } from '../lib/types'
import { Backdrop, Poster } from './ui'

function Result({ movie, index }: { movie: MovieLite; index: number }) {
  const entry = useLog((s) => s.entries[movie.id])
  const { openDetail, setSearchOpen } = useUi()
  const status = entry && !entry.deleted ? entry.status : null

  const open = () => {
    setSearchOpen(false)
    openDetail(movie)
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 8) * 0.035 }}
      className="flex gap-4 rounded-2xl p-3 transition-colors duration-200 hover:bg-white/[0.04]"
    >
      <button onClick={open} className="w-[72px] shrink-0 self-start" aria-label={`查看《${movie.title}》`}>
        <Poster movie={movie} size="w185" className="rounded-lg shadow-poster ring-1 ring-white/[0.08]" />
      </button>
      <div className="min-w-0 flex-1 py-0.5">
        <button onClick={open} className="block max-w-full text-left transition-colors hover:text-flare">
          <span className="text-[15px] font-medium">{movie.title}</span>
          <span className="num ml-2 text-[13px] text-ash">{movie.year}</span>
        </button>
        {movie.originalTitle && movie.originalTitle !== movie.title && (
          <p className="truncate text-[13px] text-dim">{movie.originalTitle}</p>
        )}
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ash">{movie.overview || '暂无中文简介'}</p>
        <div className="mt-3 flex gap-2">
          {status === 'watched' ? (
            <span className="flex h-8 items-center text-[13px] text-bone">
              <Check size={14} className="mr-1.5 text-flare" />
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
                <span className="flex h-8 items-center text-[13px] text-ash">
                  <Check size={14} className="mr-1.5 text-flare" />
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
    </motion.li>
  )
}

function Skeletons() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 p-3">
          <div className="skeleton aspect-[2/3] w-[72px] shrink-0" />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Panel() {
  const { setSearchOpen } = useUi()
  const [query, setQuery] = useState('')
  const [horrorOnly, setHorrorOnly] = useState(true)
  const [results, setResults] = useState<MovieLite[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setSearchOpen(false), [setSearchOpen])
  useOverlay(true, close)

  useEffect(() => inputRef.current?.focus(), [])

  // 停止输入 350 毫秒后再发请求
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      setError('')
      setLoading(false)
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

  const horror = results?.filter((m) => m.genreIds.includes(HORROR_GENRE_ID)) ?? []
  const shown = horrorOnly ? horror : (results ?? [])
  const hidden = (results?.length ?? 0) - horror.length

  return (
    <div className="fixed inset-0 z-40">
      <Backdrop onClick={close} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="搜索电影"
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex h-dvh w-full max-w-2xl flex-col bg-panel md:mt-[9vh] md:h-auto md:max-h-[78vh] md:rounded-3xl md:border md:border-white/10 md:shadow-float"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <Search size={19} className="shrink-0 text-flare" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入片名，中文英文都可以"
            className="h-10 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-dim"
            enterKeyHint="search"
          />
          <button onClick={close} className="btn btn-quiet h-9 w-9 rounded-full px-0" aria-label="关闭搜索">
            <X size={19} />
          </button>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-[13px] text-ash">
          <button
            role="switch"
            aria-checked={horrorOnly}
            onClick={() => setHorrorOnly(!horrorOnly)}
            className="flex items-center gap-2.5"
          >
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-200 ${horrorOnly ? 'bg-blood' : 'bg-white/15'}`}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 600, damping: 34 }}
                className={`h-4 w-4 rounded-full bg-white ${horrorOnly ? 'ml-auto' : ''}`}
              />
            </span>
            只看恐怖片
          </button>
          {loading && results !== null && <span>搜索中</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-5">
          {error ? (
            <p className="px-3 py-8 text-sm text-flare">{error}</p>
          ) : results === null ? (
            loading ? (
              <Skeletons />
            ) : (
              <p className="px-3 py-8 text-sm text-dim">结果会显示海报、年份和简介，可以直接标为看过或想看。</p>
            )
          ) : shown.length === 0 && !loading ? (
            <div className="px-3 py-8 text-sm text-ash">
              <p>没有找到{horrorOnly ? '恐怖类型的' : ''}结果。</p>
              {horrorOnly && hidden > 0 && (
                <button className="mt-2 text-bone underline underline-offset-4" onClick={() => setHorrorOnly(false)}>
                  显示其他类型的 {hidden} 个结果
                </button>
              )}
            </div>
          ) : (
            <ul>
              {shown.map((m, i) => (
                <Result key={m.id} movie={m} index={i} />
              ))}
              {horrorOnly && hidden > 0 && (
                <li className="px-3 pt-4 text-[13px] text-dim">
                  另有 {hidden} 个其他类型的结果。
                  <button className="ml-1 text-ash underline underline-offset-4" onClick={() => setHorrorOnly(false)}>
                    全部显示
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export function SearchDialog() {
  const open = useUi((s) => s.searchOpen)
  return <AnimatePresence>{open && <Panel key="search" />}</AnimatePresence>
}
