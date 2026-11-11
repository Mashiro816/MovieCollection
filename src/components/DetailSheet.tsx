import { Bookmark, Check, ExternalLink, Eye, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { addMovie, useOverlay } from '../lib/actions'
import { ALL_TAGS, CONTEXT_OPTIONS, TIERS, today } from '../lib/constants'
import { useEntries, useEntry, useLog, useUi } from '../lib/store'
import { backdropUrl, doubanSearchUrl, getKey, getMovie, tmdbUrl } from '../lib/tmdb'
import type { Entry, MovieDetails, WatchContext } from '../lib/types'
import { Poster, Skulls } from './ui'

/** 看过的电影：评级、吓人指数、观看日期、观影方式、短评 */
function WatchedForm({ entry }: { entry: Entry }) {
  const patch = useLog((s) => s.patch)
  const setContext = <K extends keyof WatchContext>(k: K, v: WatchContext[K]) =>
    patch(entry.id, { context: { ...entry.context, [k]: entry.context[k] === v ? null : v } })

  return (
    <div className="space-y-6">
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
                onClick={() => patch(entry.id, { tier: on ? null : t.id })}
                className="flex flex-col items-center gap-1 rounded-md border px-1 py-2.5 transition-colors"
                style={
                  on
                    ? { background: t.color, borderColor: t.color, color: '#0a090c' }
                    : { borderColor: '#2c2831', color: t.color }
                }
              >
                <span className="num text-2xl leading-none font-bold">{t.id}</span>
                <span className={`text-[11px] leading-tight ${on ? 'font-medium text-ink' : 'text-ash'}`}>{t.name}</span>
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
          className="field num w-44"
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
          className="field h-auto resize-y py-2.5 leading-relaxed"
        />
      </div>
    </div>
  )
}

function Tags({ entry }: { entry: Entry }) {
  const patch = useLog((s) => s.patch)
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
        <select
          value=""
          onChange={(e) => e.target.value && patch(entry.id, { tags: [...entry.tags, e.target.value] })}
          className="chip w-auto appearance-none bg-transparent pr-3"
          aria-label="添加子类型标签"
        >
          <option value="">+ 加标签</option>
          {rest.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function DetailSheet() {
  const movie = useUi((s) => s.detail)
  const openDetail = useUi((s) => s.openDetail)
  const go = useUi((s) => s.go)
  const entry = useEntry(movie?.id)
  const all = useEntries()
  const { patch, remove, enrich } = useLog()
  const [details, setDetails] = useState<MovieDetails | null>(null)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const close = useCallback(() => openDetail(null), [openDetail])
  useOverlay(movie != null, close)

  const id = movie?.id
  useEffect(() => {
    setDetails(null)
    setError('')
    setConfirmRemove(false)
    if (id == null || !getKey()) return
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

  if (!movie) return null

  const title = entry?.title ?? movie.title
  const overview = entry?.overview || details?.overview || movie.overview
  const runtime = entry?.runtime ?? details?.runtime ?? null
  const collection = entry?.collection ?? details?.collection ?? null
  const backdrop = backdropUrl(entry?.backdropPath ?? details?.backdropPath ?? movie.backdropPath)
  const seenInSeries = collection
    ? all.filter((e) => e.collection?.id === collection.id && e.status === 'watched').length
    : 0

  return (
    <div className="anim-fade fixed inset-0 z-30 bg-black/65" onClick={close}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet absolute inset-y-0 right-0 w-full overflow-y-auto bg-panel md:w-[500px] md:border-l md:border-line"
      >
        <div className="relative h-36 bg-raise md:h-44">
          {backdrop && <img src={backdrop} alt="" className="h-full w-full object-cover opacity-55" />}
          <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
          <button
            onClick={close}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/70 text-bone backdrop-blur hover:bg-ink"
            aria-label="关闭"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-7 px-5 pb-12">
          <div className="-mt-16 flex gap-4">
            <Poster movie={movie} className="relative w-[108px] shrink-0 shadow-[0_8px_30px_rgb(0_0_0/0.6)]" />
            <div className="min-w-0 self-end">
              <h2 className="font-serif text-2xl leading-tight font-bold">{title}</h2>
              {movie.originalTitle && movie.originalTitle !== title && (
                <p className="mt-0.5 text-[13px] text-ash">{movie.originalTitle}</p>
              )}
              <p className="num mt-1.5 text-[13px] text-ash">
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
            <p className="text-sm leading-[1.75] text-bone/90">{overview || '暂无简介。'}</p>
            {error && <p className="mt-2 text-[13px] text-ash">没能获取完整信息：{error}</p>}
          </div>

          {entry && <Tags entry={entry} />}

          {collection && (
            <button
              onClick={() => go('series')}
              className="flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-sm hover:border-ash"
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
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
                {details.similar.map((m) => (
                  <button key={m.id} onClick={() => openDetail(m)} className="w-[92px] shrink-0 text-left">
                    <Poster movie={m} size="w185" />
                    <p className="mt-1.5 truncate text-[13px]">{m.title}</p>
                    <p className="num text-xs text-dim">{m.year}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <a className="btn" href={doubanSearchUrl(title)} target="_blank" rel="noreferrer">
              在豆瓣打开
              <ExternalLink size={14} />
            </a>
            <a className="btn" href={tmdbUrl(movie.id)} target="_blank" rel="noreferrer">
              TMDB
              <ExternalLink size={14} />
            </a>
            {entry &&
              (confirmRemove ? (
                <button
                  className="btn ml-auto border-blood text-flare"
                  onClick={() => {
                    remove(entry.id)
                    close()
                  }}
                >
                  确认移出，记录会删除
                </button>
              ) : (
                <button className="btn btn-quiet ml-auto" onClick={() => setConfirmRemove(true)}>
                  <Trash2 size={15} />
                  移出片单
                </button>
              ))}
            {!entry && (
              <span className="ml-auto flex items-center gap-1 text-[13px] text-dim">
                <Plus size={13} />
                还没加入片单
              </span>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
