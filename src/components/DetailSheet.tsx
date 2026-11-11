import { Bookmark, Check, ExternalLink, Eye, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { addMovie, removeMovie, useOverlay } from '../lib/actions'
import { ALL_TAGS, CONTEXT_OPTIONS, TIERS, today } from '../lib/constants'
import { useEntries, useEntry, useLog, useUi } from '../lib/store'
import { backdropUrl, doubanSearchUrl, getMovie, tmdbUrl } from '../lib/tmdb'
import type { Entry, MovieDetails, MovieLite, WatchContext } from '../lib/types'
import { Backdrop, Poster, Skulls } from './ui'

/** 看过的电影：评级、吓人指数、观看日期、观影方式、短评 */
function WatchedForm({ entry }: { entry: Entry }) {
  const patch = useLog((s) => s.patch)
  const setContext = <K extends keyof WatchContext>(k: K, v: WatchContext[K]) =>
    patch(entry.id, { context: { ...entry.context, [k]: entry.context[k] === v ? null : v } })

  return (
    <div className="space-y-7">
      <div>
        <span className="label">评级</span>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="评级">
          {TIERS.map((t) => {
            const on = entry.tier === t.id
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={on}
                aria-label={`${t.id} ${t.name}`}
                onClick={() => patch(entry.id, { tier: on ? null : t.id })}
                className="relative flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-1 py-3 transition duration-200 hover:border-white/25 active:scale-[0.97]"
              >
                {/* 选中的色块在档位之间滑动 */}
                {on && (
                  <motion.span
                    layoutId="tier-pick"
                    className="absolute -inset-px rounded-xl"
                    style={{ background: t.color, boxShadow: `0 8px 28px -8px ${t.color}` }}
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  />
                )}
                <span
                  className="num relative text-[26px] leading-none font-bold transition-colors duration-200"
                  style={{ color: on ? '#09080b' : t.color }}
                >
                  {t.id}
                </span>
                <span
                  className={`relative text-[11px] leading-tight transition-colors duration-200 ${on ? 'font-medium text-ink' : 'text-ash'}`}
                >
                  {t.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <span className="label">吓人指数（和评级分开记：很吓人不等于好看）</span>
        <Skulls value={entry.scare} onChange={(scare) => patch(entry.id, { scare })} />
      </div>

      <div>
        <label className="label" htmlFor="watched-at">
          观看日期
        </label>
        <input
          id="watched-at"
          type="date"
          max={today()}
          value={entry.watchedAt ?? ''}
          onChange={(e) => patch(entry.id, { watchedAt: e.target.value || null })}
          className="field num w-48"
        />
      </div>

      <div>
        <span className="label">怎么看的</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(CONTEXT_OPTIONS) as (keyof WatchContext)[]).map((k) => (
            <div key={k} className="flex gap-1.5">
              {CONTEXT_OPTIONS[k].map((o) => (
                <button
                  key={o.value}
                  aria-pressed={entry.context[k] === o.value}
                  onClick={() => setContext(k, o.value)}
                  className={`chip ${entry.context[k] === o.value ? 'chip-on' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          一句话短评
        </label>
        <textarea
          id="note"
          rows={2}
          value={entry.note}
          onChange={(e) => patch(entry.id, { note: e.target.value })}
          placeholder="比如：后半段才是正片"
          className="field h-auto resize-y py-3 leading-relaxed"
        />
      </div>
    </div>
  )
}

function Tags({ entry }: { entry: Entry }) {
  const patch = useLog((s) => s.patch)
  const [adding, setAdding] = useState(false)
  const rest = ALL_TAGS.filter((t) => !entry.tags.includes(t))
  return (
    <div>
      <span className="label">子类型</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {entry.tags.map((t) => (
          <button
            key={t}
            className="chip pr-2"
            onClick={() => patch(entry.id, { tags: entry.tags.filter((x) => x !== t) })}
            aria-label={`移除标签 ${t}`}
          >
            {t}
            <X size={13} className="ml-1 text-dim" />
          </button>
        ))}
        <button className="chip border-dashed" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          <Plus size={13} className="mr-1" />
          {adding ? '收起' : '加标签'}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              {rest.map((t) => (
                <button key={t} className="chip h-7 px-2.5 text-xs" onClick={() => patch(entry.id, { tags: [...entry.tags, t] })}>
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Sheet({ movie }: { movie: MovieLite }) {
  const openDetail = useUi((s) => s.openDetail)
  const go = useUi((s) => s.go)
  const entry = useEntry(movie.id)
  const all = useEntries()
  const { patch, enrich } = useLog()
  const [details, setDetails] = useState<MovieDetails | null>(null)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  // 电脑上从右侧滑入，手机上从底部升起
  const [desktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  const close = useCallback(() => openDetail(null), [openDetail])
  useOverlay(true, close)

  const id = movie.id
  useEffect(() => {
    setDetails(null)
    setError('')
    setConfirmRemove(false)
    let alive = true
    getMovie(id)
      .then((d) => alive && setDetails(d))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id])

  // 第一次看到完整详情时，把片长、系列、标签补进片单
  useEffect(() => {
    if (details && entry && !entry.enriched && details.id === entry.id) enrich(details)
  }, [details, entry, enrich])

  const title = entry?.title ?? movie.title
  const overview = entry?.overview || details?.overview || movie.overview
  const runtime = entry?.runtime ?? details?.runtime ?? null
  const collection = entry?.collection ?? details?.collection ?? null
  const backdrop = backdropUrl(entry?.backdropPath ?? details?.backdropPath ?? movie.backdropPath)
  const seenInSeries = collection
    ? all.filter((e) => e.collection?.id === collection.id && e.status === 'watched').length
    : 0
  const off = desktop ? { x: '100%' } : { y: '100%' }

  return (
    <div className="fixed inset-0 z-30">
      <Backdrop onClick={close} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={off}
        animate={{ x: 0, y: 0 }}
        exit={off}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-panel shadow-float md:w-[520px] md:border-l md:border-white/[0.08]"
      >
        <div className="relative h-44 overflow-hidden bg-raise md:h-56">
          {backdrop && (
            <motion.img
              key={backdrop}
              src={backdrop}
              alt=""
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
          <button
            onClick={close}
            className="absolute top-3.5 right-3.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-ink/60 text-bone backdrop-blur-md transition hover:bg-ink active:scale-95"
            aria-label="关闭"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-8 px-5 pb-14 md:px-7">
          <div className="-mt-20 flex gap-5">
            <Poster
              key={movie.id}
              movie={movie}
              className="relative w-[116px] shrink-0 shadow-[0_18px_50px_-10px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
            />
            <div className="min-w-0 self-end pb-1">
              <h2 className="font-serif text-[26px] leading-tight font-bold">{title}</h2>
              {movie.originalTitle && movie.originalTitle !== title && (
                <p className="mt-1 text-[13px] text-ash">{movie.originalTitle}</p>
              )}
              <p className="num mt-2 text-[13px] text-ash">
                {[movie.year, runtime && `${runtime} 分钟`].filter(Boolean).join('　') || '年份不详'}
              </p>
            </div>
          </div>

          {/* 还没加入片单 / 在想看里 / 已看过，三种状态对应不同的操作 */}
          {!entry ? (
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => addMovie(movie, 'watched')}>
                <Eye size={16} />
                看过
              </button>
              <button className="btn flex-1" onClick={() => addMovie(movie, 'wishlist')}>
                <Bookmark size={16} />
                想看
              </button>
            </div>
          ) : entry.status === 'wishlist' ? (
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-sm text-ash">
                <Check size={15} className="text-flare" />
                在想看片单里
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={() => patch(entry.id, { status: 'watched', watchedAt: today() })}
              >
                <Eye size={16} />
                看完了，去评级
              </button>
            </div>
          ) : (
            <WatchedForm entry={entry} />
          )}

          <div>
            <span className="label">简介</span>
            <p className="text-sm leading-[1.8] text-bone/85">{overview || '暂无简介。'}</p>
            {error && <p className="mt-2 text-[13px] text-ash">没能获取完整信息：{error}</p>}
          </div>

          {entry && <Tags entry={entry} />}

          {collection && (
            <button
              onClick={() => go('series')}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left text-sm transition duration-200 hover:border-white/25"
            >
              <span>
                <span className="text-ash">系列　</span>
                {collection.name}
              </span>
              <span className="num text-ash">已看 {seenInSeries} 部</span>
            </button>
          )}

          {details && details.similar.length > 0 && (
            <div>
              <span className="label">相似影片</span>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-2 md:-mx-7 md:px-7">
                {details.similar.map((m) => (
                  <button key={m.id} onClick={() => openDetail(m)} className="group w-[96px] shrink-0 text-left">
                    <Poster
                      movie={m}
                      size="w185"
                      className="rounded-lg ring-1 ring-white/[0.08] transition duration-300 ease-out-soft group-hover:-translate-y-1 group-hover:ring-white/30"
                    />
                    <p className="mt-2 truncate text-[13px]">{m.title}</p>
                    <p className="num text-xs text-dim">{m.year}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-6">
            <a className="btn h-10" href={doubanSearchUrl(title)} target="_blank" rel="noreferrer">
              在豆瓣打开
              <ExternalLink size={14} />
            </a>
            <a className="btn h-10" href={tmdbUrl(movie.id)} target="_blank" rel="noreferrer">
              TMDB
              <ExternalLink size={14} />
            </a>
            {entry &&
              (confirmRemove ? (
                <button
                  className="btn ml-auto h-10 border-flare/50 text-flare"
                  onClick={() => {
                    removeMovie(entry.id)
                    close()
                  }}
                >
                  确认移出
                </button>
              ) : (
                <button className="btn btn-quiet ml-auto h-10" onClick={() => setConfirmRemove(true)}>
                  <Trash2 size={15} />
                  移出片单
                </button>
              ))}
          </div>
        </div>
      </motion.aside>
    </div>
  )
}

export function DetailSheet() {
  const movie = useUi((s) => s.detail)
  return <AnimatePresence>{movie && <Sheet key="detail" movie={movie} />}</AnimatePresence>
}
