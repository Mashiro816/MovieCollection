import { Dices, LayoutGrid, Orbit } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { TIERS, tierOf, tierRank } from '../lib/constants'
import { useEntries, useUi } from '../lib/store'
import { backdropUrl } from '../lib/tmdb'
import type { Entry, Status, TierId } from '../lib/types'
import { Ring } from './Ring'
import { Empty, Poster, Select, Skulls, TierBadge, ViewToggle } from './ui'

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

interface Group {
  key: string
  /** 分段牌上的大字和小字，比如"10 月"和"2026 年" */
  title: ReactNode
  sub: string
  color?: string
  items: Entry[]
}

/**
 * 把排好序的片单按当前的排序方式分段：按评级、按吓人指数、按年代。
 * 返回 null 表示这种排序不分段（按观看或添加时间排、按片长排）。
 */
function groupEntries(list: Entry[], sort: Sort): Group[] | null {
  let keyOf: (e: Entry) => Omit<Group, 'items'>
  if (sort === 'tier') {
    keyOf = (e) => {
      const t = tierOf(e.tier)
      return t
        ? { key: t.id, title: <span className="num">{t.id}</span>, sub: t.name, color: t.color }
        : { key: 'none', title: <span className="num">?</span>, sub: '还没评级' }
    }
  } else if (sort === 'scare') {
    keyOf = (e) =>
      e.scare > 0
        ? { key: String(e.scare), title: <span className="num">{e.scare}</span>, sub: '个骷髅', color: '#ff4057' }
        : { key: 'none', title: <span className="num">0</span>, sub: '没标吓人指数' }
  } else if (sort === 'year') {
    keyOf = (e) => {
      const decade = Math.floor(Number(e.year) / 10) * 10
      return e.year
        ? { key: String(decade), title: <span className="num">{decade}</span>, sub: '年代' }
        : { key: 'none', title: '不详', sub: '上映年份' }
    }
  } else {
    return null
  }

  const groups: Group[] = []
  for (const e of list) {
    const g = keyOf(e)
    const last = groups[groups.length - 1]
    if (last?.key === g.key) last.items.push(e)
    else groups.push({ ...g, items: [e] })
  }
  return groups
}

/** 分段牌：和海报一样大，插在每一段的开头。海报墙因此保持连续，不会因为分段而留下大片空白 */
function GroupTile({ group, still }: { group: Group; still: boolean }) {
  const color = group.color
  return (
    <motion.div
      layout={still ? false : 'position'}
      className="relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 md:p-4"
      style={color ? { background: `radial-gradient(120% 90% at 0% 100%, ${color}24, transparent 70%)` } : undefined}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r" style={{ background: color ?? '#655e6a' }} />
      <span
        className="font-serif text-[26px] leading-none font-bold md:text-[40px]"
        style={color ? { color, textShadow: `0 0 30px ${color}55` } : undefined}
      >
        {group.title}
      </span>
      <span className="mt-1.5 truncate text-xs text-ash md:mt-2.5 md:text-sm">{group.sub}</span>
      <span className="num mt-0.5 text-[11px] text-dim md:text-xs">{group.items.length} 部</span>
    </motion.div>
  )
}

interface Slide {
  entry: Entry
  label: string
}

/** 固定种子的随机数：同一次打开期间顺序不变，不会因为你改了某条记录就重新洗牌 */
function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 顶部大图轮播哪些电影：最近看的一部，加上随机的几部 S 级和几部吓人指数 4 到 5 的。
 * 只取有剧照的；同一部不重复出现；最后整体打乱顺序。
 */
function pickSlides(entries: Entry[], seed: number): Slide[] {
  const random = seededRandom(seed)
  const shuffle = <T,>(list: T[]) =>
    list
      .map((item) => ({ item, key: random() }))
      .sort((x, y) => x.key - y.key)
      .map((x) => x.item)

  const watched = sortEntries(
    entries.filter((e) => e.status === 'watched' && e.backdropPath),
    'recent',
    'watched',
  )
  if (watched.length === 0) return []
  const slides: Slide[] = [{ entry: watched[0], label: '最近看的' }]
  const used = new Set([watched[0].id])
  const add = (list: Entry[], label: (e: Entry) => string) => {
    for (const e of shuffle(list.filter((x) => !used.has(x.id))).slice(0, 2)) {
      used.add(e.id)
      slides.push({ entry: e, label: label(e) })
    }
  }
  add(
    watched.filter((e) => e.tier === 'S'),
    () => '你评的噩梦级',
  )
  add(
    watched.filter((e) => e.scare >= 4),
    (e) => `吓人指数 ${e.scare}`,
  )
  return shuffle(slides)
}

const SLIDE_SECONDS = 7

/** 首页顶部的大图轮播。顶栏浮在它上面 */
function Hero({ slides }: { slides: Slide[] }) {
  const openDetail = useUi((s) => s.openDetail)
  const detailOpen = useUi((s) => s.detail != null)
  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState(false)
  const swiped = useRef(false)
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const count = slides.length
  const current = slides[Math.min(index, count - 1)]
  const go = (step: number) => setIndex((i) => (i + step + count) % count)
  // 鼠标停在上面、打开了详情、或系统要求减少动态效果时，不自动切换
  const playing = count > 1 && !hover && !detailOpen && !still

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [playing, index, count])

  // 提前加载其余几张剧照，切换时不会先看到空白
  useEffect(() => {
    slides.forEach((s) => {
      const src = backdropUrl(s.entry.backdropPath, 'w1280')
      if (src) new Image().src = src
    })
  }, [slides])

  const { entry, label } = current
  const src = backdropUrl(entry.backdropPath, 'w1280')
  const tier = tierOf(entry.tier)

  return (
    <motion.div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      // 手机上左右滑动切换
      onPan={(_, info) => {
        if (Math.abs(info.offset.x) > 12) swiped.current = true
      }}
      onPanEnd={(_, info) => {
        if (count > 1 && Math.abs(info.offset.x) > 50) go(info.offset.x < 0 ? 1 : -1)
        setTimeout(() => (swiped.current = false), 60)
      }}
      className="group relative -mx-4 -mt-[84px] mb-8 h-[340px] touch-pan-y overflow-hidden md:-mx-10 md:-mt-[92px] md:mb-10 md:h-[420px]"
    >
      <AnimatePresence initial={false}>
        {src && (
          <motion.img
            key={entry.id}
            src={src}
            alt=""
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.9 }, scale: { duration: SLIDE_SECONDS + 1, ease: 'linear' } }}
            className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
          />
        )}
      </AnimatePresence>
      {/* 两层渐变：底部融进页面，左侧压暗保证文字可读 */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/20 to-transparent" />

      {/* 整张图都可以点开详情 */}
      <button
        onClick={() => !swiped.current && openDetail(entry)}
        className="absolute inset-0 w-full cursor-pointer"
        aria-label={`查看《${entry.title}》`}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-4 bottom-9 flex items-end gap-5 md:inset-x-10 md:bottom-11 md:gap-7"
        >
          <Poster
            movie={entry}
            className="hidden w-[132px] shrink-0 shadow-[0_18px_50px_-10px_rgb(0_0_0/0.9)] ring-1 ring-white/15 md:block"
          />
          <div className="min-w-0">
            <p className="mb-2 text-[13px] text-bone/70">{label}</p>
            <h2 className="max-w-2xl font-serif text-[34px] leading-[1.15] font-bold md:text-[50px]">{entry.title}</h2>
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
        </motion.div>
      </AnimatePresence>

      {/* 进度条：每张一段，当前这段在停留时间内慢慢填满 */}
      {count > 1 && (
        <div className="absolute inset-x-4 bottom-3 flex gap-1.5 md:inset-x-10 md:bottom-4 md:max-w-[260px]">
          {slides.map((s, i) => (
            <button
              key={s.entry.id}
              onClick={() => setIndex(i)}
              aria-label={`第 ${i + 1} 张：${s.entry.title}`}
              aria-current={i === index}
              className="relative h-5 flex-1"
            >
              <span className="absolute inset-x-0 top-2 h-[3px] overflow-hidden rounded-full bg-white/20">
                {i === index && (
                  <motion.span
                    key={`${index}-${playing}`}
                    className="block h-full rounded-full bg-bone"
                    initial={{ width: playing ? '0%' : '100%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: playing ? SLIDE_SECONDS : 0, ease: 'linear' }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function MovieCard({ entry, index = 0, still = false }: { entry: Entry; index?: number; still?: boolean }) {
  const openDetail = useUi((s) => s.openDetail)
  // 鼠标悬停时在海报底部浮出的一行：有短评显示短评，没有就显示子类型
  const peek = entry.note ? `"${entry.note}"` : entry.tags.slice(0, 3).join(' / ')
  return (
    <motion.button
      // 筛选后卡片滑到新位置；片单很长时关掉，几百张一起算位移会卡
      layout={still ? false : 'position'}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 14) * 0.028 }}
      onClick={() => openDetail(entry)}
      className="group block text-left"
    >
      <div className="relative overflow-hidden rounded-xl shadow-poster ring-1 ring-white/[0.08] transition duration-300 ease-out-soft group-hover:-translate-y-1.5 group-hover:shadow-[0_26px_50px_-18px_rgb(0_0_0/0.95)] group-hover:ring-white/30">
        <Poster movie={entry} className="rounded-none transition-transform duration-500 ease-out-soft group-hover:scale-[1.05]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        {entry.tier && (
          <span className="absolute top-2 left-2">
            <TierBadge tier={entry.tier} />
          </span>
        )}
        {peek && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-12 pb-3 opacity-0 transition duration-300 ease-out-soft group-hover:translate-y-0 group-hover:opacity-100 md:block">
            <p className={`line-clamp-3 text-xs leading-relaxed text-bone/90 ${entry.note ? 'font-serif' : ''}`}>{peek}</p>
          </div>
        )}
      </div>
      <p className="mt-2.5 truncate text-sm leading-snug text-bone">{entry.title}</p>
      <p className="num mt-1 flex items-center gap-2 text-xs text-ash">
        <span>{entry.year || '年份不详'}</span>
        {entry.status === 'watched' && entry.scare > 0 && <Skulls value={entry.scare} size={11} />}
        {entry.status === 'wishlist' && entry.runtime && <span>{entry.runtime} 分钟</span>}
      </p>
    </motion.button>
  )
}

const GRID =
  'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(164px,1fr))] md:gap-x-6 md:gap-y-9'

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
  // 轮播的内容只跟"哪些电影符合条件"有关：改短评、换标签不会让它重新洗牌
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32))
  const slideKey = entries
    .filter((e) => e.status === 'watched' && e.backdropPath)
    .map((e) => `${e.id}${e.tier ?? ''}${e.scare}${e.watchedAt ?? ''}`)
    .join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slides = useMemo(() => pickSlides(entries, seed), [slideKey, seed])
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
  const groups = useMemo(() => groupEntries(shown, activeSort), [shown, activeSort])

  const switchTab = (t: Status) => {
    setLibraryTab(t)
    setTag('')
    setTier(null)
  }

  let cardIndex = 0 // 入场动画的先后顺序，跨分段连续计数
  const still = shown.length > 120

  return (
    <div>
      {/* 环形展台本身就是主角，这时不再显示顶部大图 */}
      {slides.length > 0 && view === 'grid' && <Hero slides={slides} />}

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
        {tab === 'wishlist' && (
          <button
            onClick={() =>
              counts.wishlist === 0
                ? toast('暂无想看的电影', { description: '先搜索片名，把想看的加进来' })
                : setTonightOpen(true)
            }
            className="btn btn-primary mb-2.5 ml-auto"
          >
            <Dices size={17} />
            随机推荐
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
          {/* 筛选栏。手机上第一行是评级和视图切换，第二行是两个下拉框 */}
          <div className="mb-7 flex flex-wrap items-center gap-2.5">
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
                        : { borderColor: 'rgb(255 255 255 / 0.1)', background: 'rgb(255 255 255 / 0.04)', color: t.color }
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
                options={[{ value: '', label: '全部子类型' }, ...tags.map(([t, n]) => ({ value: t, label: `${t}（${n}）` }))]}
              />
            )}
            <Select
              label="排序"
              value={activeSort}
              onChange={(v) => setSort(v as Sort)}
              options={SORTS[tab]}
              className="order-3 md:order-none md:ml-auto"
            />
            <ViewToggle
              id="library-view"
              className="order-2 ml-auto md:order-last md:ml-0"
              value={view}
              onChange={setLibraryView}
              options={[
                { value: 'grid', label: '海报墙', icon: LayoutGrid },
                { value: 'ring', label: '环形展台', icon: Orbit },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-sm text-ash">没有符合筛选条件的电影。</p>
          ) : view === 'ring' ? (
            // 筛选或排序变了就重新开始，回到第一张
            <Ring key={`${tab}-${tier}-${tag}-${activeSort}`} entries={shown} />
          ) : groups ? (
            <div key={`${tab}-${activeSort}`} className={GRID}>
              {groups.flatMap((g) => [
                <GroupTile key={`group-${g.key}`} group={g} still={still} />,
                ...g.items.map((e) => <MovieCard key={e.id} entry={e} index={cardIndex++} still={still} />),
              ])}
            </div>
          ) : (
            <div key={`${tab}-${activeSort}`} className={GRID}>
              {shown.map((e, i) => (
                <MovieCard key={e.id} entry={e} index={i} still={still} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
