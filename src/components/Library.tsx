import { Dices, Skull } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TIERS, tierRank } from '../lib/constants'
import { useEntries, useUi } from '../lib/store'
import type { Entry, Status, TierId } from '../lib/types'
import { Empty, Poster, TierBadge } from './ui'

type Sort = 'recent' | 'tier' | 'scare' | 'year' | 'runtime'

const SORTS: Record<Status, { value: Sort; label: string }[]> = {
  watched: [
    { value: 'recent', label: '最近观看' },
    { value: 'tier', label: '评级从高到低' },
    { value: 'scare', label: '最吓人' },
    { value: 'year', label: '上映年份' },
  ],
  wishlist: [
    { value: 'recent', label: '最近添加' },
    { value: 'year', label: '上映年份' },
    { value: 'runtime', label: '片长从短到长' },
  ],
}

function sortEntries(list: Entry[], sort: Sort, tab: Status) {
  const by: Record<Sort, (a: Entry, b: Entry) => number> = {
    recent: (a, b) =>
      tab === 'watched'
        ? (b.watchedAt ?? '').localeCompare(a.watchedAt ?? '') || b.addedAt.localeCompare(a.addedAt)
        : b.addedAt.localeCompare(a.addedAt),
    tier: (a, b) => tierRank(a.tier) - tierRank(b.tier) || b.scare - a.scare,
    scare: (a, b) => b.scare - a.scare || tierRank(a.tier) - tierRank(b.tier),
    year: (a, b) => b.year.localeCompare(a.year),
    runtime: (a, b) => (a.runtime ?? 9999) - (b.runtime ?? 9999),
  }
  return [...list].sort(by[sort])
}

export function MovieCard({ entry }: { entry: Entry }) {
  const openDetail = useUi((s) => s.openDetail)
  return (
    <button onClick={() => openDetail(entry)} className="group block text-left">
      <div className="relative">
        <Poster movie={entry} className="ring-1 ring-white/5 transition group-hover:ring-flare/70" />
        {entry.tier && (
          <span className="absolute top-1.5 left-1.5 shadow-[0_2px_8px_rgb(0_0_0/0.6)]">
            <TierBadge tier={entry.tier} />
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-sm leading-snug text-bone">{entry.title}</p>
      <p className="num flex items-center gap-2 text-xs text-ash">
        <span>{entry.year || '年份不详'}</span>
        {entry.status === 'watched' && entry.scare > 0 && (
          <span className="flex items-center gap-0.5 text-flare">
            <Skull size={12} />
            {entry.scare}
          </span>
        )}
        {entry.status === 'wishlist' && entry.runtime && <span>{entry.runtime} 分钟</span>}
      </p>
    </button>
  )
}

export function Library() {
  const entries = useEntries()
  const { libraryTab: tab, setLibraryTab, setSearchOpen, setTonightOpen } = useUi()
  const [tier, setTier] = useState<TierId | null>(null)
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<Sort>('recent')

  const inTab = useMemo(() => entries.filter((e) => e.status === tab), [entries, tab])
  const counts = useMemo(
    () => ({
      watched: entries.filter((e) => e.status === 'watched').length,
      wishlist: entries.filter((e) => e.status === 'wishlist').length,
    }),
    [entries],
  )
  const tags = useMemo(() => {
    const n = new Map<string, number>()
    inTab.forEach((e) => e.tags.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)))
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [inTab])

  const activeSort = SORTS[tab].some((s) => s.value === sort) ? sort : 'recent'
  const shown = useMemo(() => {
    const list = inTab.filter(
      (e) => (!tier || tab !== 'watched' || e.tier === tier) && (!tag || e.tags.includes(tag)),
    )
    return sortEntries(list, activeSort, tab)
  }, [inTab, tier, tag, activeSort, tab])

  const switchTab = (t: Status) => {
    setLibraryTab(t)
    setTag('')
    setTier(null)
  }

  return (
    <div>
      {/* 两个片单的切换，同时就是页面标题 */}
      <div className="mb-6 flex items-end gap-7" role="tablist">
        {(['watched', 'wishlist'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`flex items-baseline gap-2 border-b-2 pb-1.5 transition-colors ${
              tab === t ? 'border-flare text-bone' : 'border-transparent text-dim hover:text-ash'
            }`}
          >
            <span className="font-serif text-[28px] leading-tight font-bold md:text-[34px]">
              {t === 'watched' ? '看过' : '想看'}
            </span>
            <span className="num text-sm">{counts[t]}</span>
          </button>
        ))}
        {tab === 'wishlist' && counts.wishlist > 0 && (
          <button onClick={() => setTonightOpen(true)} className="btn btn-primary mb-1.5 ml-auto">
            <Dices size={17} />
            今晚看什么
          </button>
        )}
      </div>

      {inTab.length === 0 ? (
        <Empty title={tab === 'watched' ? '还没有看过的电影' : '想看片单是空的'}>
          <p className="text-sm text-ash">
            {tab === 'watched' ? '搜索片名，把看过的恐怖片加进来，再给它评个级。' : '搜索片名，把想看的先存起来。'}
          </p>
          <button className="btn btn-primary" onClick={() => setSearchOpen(true)}>
            搜索电影
          </button>
        </Empty>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            {tab === 'watched' && (
              <div className="flex gap-1.5" aria-label="按评级筛选">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(tier === t.id ? null : t.id)}
                    aria-pressed={tier === t.id}
                    title={t.name}
                    className="num flex h-8 w-8 items-center justify-center rounded-[3px] border text-[13px] font-bold transition-colors"
                    style={
                      tier === t.id
                        ? { background: t.color, borderColor: t.color, color: '#0a090c' }
                        : { borderColor: '#2c2831', color: t.color }
                    }
                  >
                    {t.id}
                  </button>
                ))}
              </div>
            )}
            {tags.length > 0 && (
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="field h-8 w-auto py-0 pr-8 text-[13px]"
                aria-label="按子类型筛选"
              >
                <option value="">全部子类型</option>
                {tags.map(([t, n]) => (
                  <option key={t} value={t}>
                    {t}（{n}）
                  </option>
                ))}
              </select>
            )}
            <select
              value={activeSort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="field h-8 w-auto py-0 pr-8 text-[13px] sm:ml-auto"
              aria-label="排序"
            >
              {SORTS[tab].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-sm text-ash">没有符合筛选条件的电影。</p>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] md:gap-x-5 md:gap-y-7">
              {shown.map((e) => (
                <MovieCard key={e.id} entry={e} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
