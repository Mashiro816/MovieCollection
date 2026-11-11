import { Dices, LayoutGrid, Orbit, Skull } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { TIERS, tierOf, tierRank } from '../lib/constants'
import { useEntries, useUi } from '../lib/store'
import { backdropUrl } from '../lib/tmdb'
import type { Entry, Status, TierId } from '../lib/types'
import { Ring } from './Ring'
import { Empty, Poster, Select, Skulls, TierBadge } from './ui'

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

/** 首页顶部的大图：最近看的一部。顶栏浮在它上面 */
function Hero({ entry }: { entry: Entry }) {
  const openDetail = useUi((s) => s.openDetail)
  const src = backdropUrl(entry.backdropPath, 'w1280')
  const tier = tierOf(entry.tier)
  return (
    <button
      onClick={() => openDetail(entry)}
      className="group relative -mx-4 -mt-[84px] mb-8 block h-[340px] w-[calc(100%+2rem)] overflow-hidden text-left md:-mx-10 md:-mt-[92px] md:mb-10 md:h-[440px] md:w-[calc(100%+5rem)]"
    >
      {src && (
        <motion.img
          key={src}
          src={src}
          alt=""
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
        />
      )}
      {/* 两层渐变：底部融进页面，左侧压暗保证文字可读 */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/20 to-transparent" />

      <div className="absolute inset-x-4 bottom-6 md:inset-x-10 md:bottom-9">
        <p className="mb-2 text-[13px] text-bone/70">最近看的</p>
        <h2 className="max-w-2xl font-serif text-[34px] leading-[1.15] font-bold md:text-[52px]">{entry.title}</h2>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {tier && (
            <span className="flex items-center gap-2">
              <TierBadge tier={entry.tier} />
              <span style={{ color: tier.color }}>{tier.name}</span>
            </span>
          )}
          {entry.scare > 0 && <Skulls value={entry.scare} size={15} />}
          <span className="num text-bone/60">{[entry.year, entry.watchedAt].filter(Boolean).join('　看于 ')}</span>
        </div>
        {entry.note && <p className="mt-3 max-w-xl truncate font-serif text-[15px] text-bone/80">"{entry.note}"</p>}
      </div>
    </button>
  )
}

export function MovieCard({ entry, index = 0 }: { entry: Entry; index?: number }) {
  const openDetail = useUi((s) => s.openDetail)
  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 14) * 0.028 }}
      onClick={() => openDetail(entry)}
      className="group block text-left"
    >
      <div className="relative overflow-hidden rounded-xl shadow-poster ring-1 ring-white/[0.08] transition duration-300 ease-out-soft group-hover:-translate-y-1 group-hover:ring-white/30">
        <Poster
          movie={entry}
          className="rounded-none transition-transform duration-500 ease-out-soft group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        {entry.tier && (
          <span className="absolute top-2 left-2">
            <TierBadge tier={entry.tier} />
          </span>
        )}
      </div>
      <p className="mt-2.5 truncate text-sm leading-snug text-bone">{entry.title}</p>
      <p className="num mt-0.5 flex items-center gap-2 text-xs text-ash">
        <span>{entry.year || '年份不详'}</span>
        {entry.status === 'watched' && entry.scare > 0 && (
          <span className="flex items-center gap-0.5 text-flare">
            <Skull size={12} />
            {entry.scare}
          </span>
        )}
        {entry.status === 'wishlist' && entry.runtime && <span>{entry.runtime} 分钟</span>}
      </p>
    </motion.button>
  )
}

export function Library() {
  const entries = useEntries()
  const { libraryTab: tab, setLibraryTab, libraryView: view, setLibraryView, setSearchOpen, setTonightOpen } = useUi()
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
  const latest = useMemo(
    () =>
      sortEntries(
        entries.filter((e) => e.status === 'watched' && e.backdropPath),
        'recent',
        'watched',
      )[0],
    [entries],
  )
  const tags = useMemo(() => {
    const n = new Map<string, number>()
    inTab.forEach((e) => e.tags.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)))
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [inTab])

  const activeSort = SORTS[tab].some((s) => s.value === sort) ? sort : 'recent'
  const shown = useMemo(() => {
    const list = inTab.filter((e) => (!tier || tab !== 'watched' || e.tier === tier) && (!tag || e.tags.includes(tag)))
    return sortEntries(list, activeSort, tab)
  }, [inTab, tier, tag, activeSort, tab])

  const switchTab = (t: Status) => {
    setLibraryTab(t)
    setTag('')
    setTier(null)
  }

  return (
    <div>
      {/* 环形展台本身就是主角，这时不再显示顶部大图 */}
      {latest && view === 'grid' && <Hero entry={latest} />}

      {/* 两个片单的切换，同时就是页面标题 */}
      <div className="mb-6 flex items-end gap-7" role="tablist">
        {(['watched', 'wishlist'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`relative flex items-baseline gap-2 pb-2.5 transition-colors duration-200 ${
              tab === t ? 'text-bone' : 'text-dim hover:text-ash'
            }`}
          >
            <span className="font-serif text-[30px] leading-tight font-bold md:text-[38px]">
              {t === 'watched' ? '看过' : '想看'}
            </span>
            <span className="num text-sm">{counts[t]}</span>
            {tab === t && (
              <motion.span
                layoutId="library-tab"
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-flare"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
          </button>
        ))}
        {tab === 'wishlist' && counts.wishlist > 0 && (
          <button onClick={() => setTonightOpen(true)} className="btn btn-primary mb-2.5 ml-auto">
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
          <div className="mb-6 flex flex-wrap items-center gap-2.5">
            {tab === 'watched' && (
              <div className="flex gap-1.5" aria-label="按评级筛选">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(tier === t.id ? null : t.id)}
                    aria-pressed={tier === t.id}
                    title={t.name}
                    className="num flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-bold transition duration-200 active:scale-95"
                    style={
                      tier === t.id
                        ? { background: t.color, borderColor: t.color, color: '#09080b' }
                        : {
                            borderColor: 'rgb(255 255 255 / 0.1)',
                            background: 'rgb(255 255 255 / 0.04)',
                            color: t.color,
                          }
                    }
                  >
                    {t.id}
                  </button>
                ))}
              </div>
            )}
            {tags.length > 0 && (
              <Select
                label="按子类型筛选"
                className="order-3 md:order-none"
                value={tag}
                onChange={setTag}
                options={[
                  { value: '', label: '全部子类型' },
                  ...tags.map(([t, n]) => ({ value: t, label: `${t}（${n}）` })),
                ]}
              />
            )}
            <Select
              label="排序"
              value={activeSort}
              onChange={(v) => setSort(v as Sort)}
              options={SORTS[tab]}
              className="order-3 md:order-none md:ml-auto"
            />
            <div
              className="order-2 ml-auto flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 md:order-last md:ml-0"
              role="group"
              aria-label="展示方式"
            >
              {(
                [
                  { value: 'grid', label: '海报墙', icon: LayoutGrid },
                  { value: 'ring', label: '环形展台', icon: Orbit },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setLibraryView(value)}
                  aria-pressed={view === value}
                  aria-label={label}
                  title={label}
                  className={`relative flex h-8 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                    view === value ? 'text-ink' : 'text-ash hover:text-bone'
                  }`}
                >
                  {view === value && (
                    <motion.span
                      layoutId="library-view"
                      className="absolute inset-0 rounded-full bg-bone"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                  <Icon size={16} className="relative" />
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-sm text-ash">没有符合筛选条件的电影。</p>
          ) : view === 'ring' ? (
            // 筛选或排序变了就重新开始，回到第一张
            <Ring key={`${tab}-${tier}-${tag}-${activeSort}`} entries={shown} />
          ) : (
            <div
              key={tab}
              className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(156px,1fr))] md:gap-x-6 md:gap-y-9"
            >
              {shown.map((e, i) => (
                <MovieCard key={e.id} entry={e} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
