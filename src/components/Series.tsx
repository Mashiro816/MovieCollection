import { Activity, Bookmark, Images } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { TIERS, tierOf, tierRank } from '../lib/constants'
import { useEntries, useLog, useUi } from '../lib/store'
import { getCollection } from '../lib/tmdb'
import type { Entry, MovieLite } from '../lib/types'
import { Empty, PageTitle, Poster, TierBadge, ViewToggle } from './ui'

const STALE_MS = 1000 * 60 * 60 * 24 * 30 // 系列成员缓存 30 天，之后重新拉取（可能出了新续集）

/** 取一个系列的全部成员（按上映先后），以及其中哪些在你的片单里 */
function useSeries(id: number, mine: Entry[]) {
  const info = useLog((s) => s.collections[id])
  const setCollection = useLog((s) => s.setCollection)
  const [error, setError] = useState('')

  useEffect(() => {
    const fresh = info && Date.now() - new Date(info.fetchedAt).getTime() < STALE_MS
    if (fresh) return
    let alive = true
    getCollection(id)
      .then((c) => alive && setCollection(c))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, info, setCollection])

  const byId = new Map(mine.map((e) => [e.id, e]))
  // 还没拿到完整系列时，先显示片单里已有的几部
  const parts: MovieLite[] = info?.parts ?? [...mine].sort((a, b) => a.year.localeCompare(b.year))
  const watched = parts.filter((p) => byId.get(p.id)?.status === 'watched').length
  return { info, error, parts, byId, watched, done: info != null && watched === parts.length }
}

function Progress({ watched, total, done }: { watched: number; total: number | null; done: boolean }) {
  return (
    <p className="num text-sm text-ash">
      已看 <span className={done ? 'text-flare' : 'text-bone'}>{watched}</span>
      {total != null ? ` / ${total}` : ''}
      {done && <span className="ml-2 font-sans text-flare">全部看完</span>}
    </p>
  )
}

/* ---------- 海报视图：每个系列一排海报 ---------- */

function PosterBlock({ id, name, mine }: { id: number; name: string; mine: Entry[] }) {
  const openDetail = useUi((s) => s.openDetail)
  const { info, error, parts, byId, watched, done } = useSeries(id, mine)

  return (
    <section className="card mb-4 px-5 py-5 md:px-7 md:py-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-serif text-[22px] font-bold">{info?.name ?? name}</h2>
        <Progress watched={watched} total={info ? parts.length : null} done={done} />
      </div>
      {/* 每一格代表系列里的一部，亮的是已看 */}
      {info && (
        <div className="mb-4 flex max-w-md gap-1" aria-hidden>
          {parts.map((p) => (
            <span
              key={p.id}
              className={`h-1 flex-1 rounded-full ${byId.get(p.id)?.status === 'watched' ? 'bg-flare shadow-[0_0_10px_rgb(255_64_87/0.7)]' : 'bg-white/10'}`}
            />
          ))}
        </div>
      )}
      {error && <p className="mb-3 text-[13px] text-ash">没能获取完整系列：{error}</p>}
      <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pt-1 pb-2 md:-mx-7 md:px-7">
        {parts.map((p) => {
          const e = byId.get(p.id)
          const seen = e?.status === 'watched'
          return (
            <button key={p.id} onClick={() => openDetail(e ?? p)} className="group w-[96px] shrink-0 text-left md:w-[116px]">
              <div className="relative overflow-hidden rounded-lg shadow-poster ring-1 ring-white/[0.08] transition duration-300 ease-out-soft group-hover:-translate-y-1 group-hover:ring-white/30">
                <Poster
                  movie={p}
                  size="w185"
                  className={`rounded-lg transition duration-500 ${seen ? '' : 'opacity-35 grayscale group-hover:opacity-70 group-hover:grayscale-0'}`}
                />
                {e?.tier && (
                  <span className="absolute top-1 left-1">
                    <TierBadge tier={e.tier} size="sm" />
                  </span>
                )}
                {e?.status === 'wishlist' && (
                  <span className="absolute top-1 left-1 rounded-md bg-ink/80 p-1 text-bone backdrop-blur" title="在想看片单里">
                    <Bookmark size={12} />
                  </span>
                )}
              </div>
              <p className={`mt-2 truncate text-[13px] ${seen ? 'text-bone' : 'text-ash'}`}>{p.title}</p>
              <p className="num text-xs text-dim">{p.year}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- 走势视图：一条折线看完整个系列 ---------- */

// 图的尺寸（像素）。纵向五条线对应 S 到 D，最下面一条是"没评级 / 没看"的基线
const LEVEL_GAP = 19
const TOP = 14
const BASE = TOP + TIERS.length * LEVEL_GAP
const HEIGHT = BASE + 34 // 基线下方留给年份
const UNIT = 100 // SVG 里每部电影占的横向宽度（会被拉伸到实际宽度）

/**
 * 横轴是系列里的每一部（按上映先后），纵轴是你给的评级。
 * 评过级的画成带字母的圆点并连成折线，一眼能看出这个系列是越拍越好还是越拍越差；
 * 没评级、想看、没看过的落在基线上，分别是实心点、虚线圈、空心圈。
 */
function TrendChart({ parts, byId }: { parts: MovieLite[]; byId: Map<number, Entry> }) {
  const openDetail = useUi((s) => s.openDetail)
  const n = parts.length
  const nodes = parts.map((p, i) => {
    const e = byId.get(p.id)
    const tier = e?.status === 'watched' ? tierOf(e.tier) : null
    return {
      part: p,
      entry: e,
      tier,
      x: (i + 0.5) * UNIT,
      y: tier ? TOP + tierRank(tier.id) * LEVEL_GAP : BASE,
      left: `${((i + 0.5) / n) * 100}%`,
    }
  })
  const rated = nodes.map((node, i) => ({ ...node, i })).filter((node) => node.tier)

  return (
    // 每部至少占 30 像素，放不下时（手机上的长系列）可以横向滑动
    <div className="overflow-x-auto pl-5 md:overflow-visible">
      <div className="relative" style={{ height: HEIGHT, minWidth: n * 30, maxWidth: n * 92 }}>
        {/* 五条评级参考线和基线 */}
        {TIERS.map((t, k) => (
          <div key={t.id} className="absolute inset-x-0 border-t border-white/[0.05]" style={{ top: TOP + k * LEVEL_GAP }}>
            <span className="num absolute -top-[7px] -left-5 text-[10px] leading-[14px] font-bold opacity-60" style={{ color: t.color }}>
              {t.id}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 border-t border-white/15" style={{ top: BASE }} />

        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${n * UNIT} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            {rated.slice(1).map((b, k) => {
              const a = rated[k]
              return (
                <linearGradient key={b.part.id} id={`seg-${a.part.id}-${b.part.id}`} gradientUnits="userSpaceOnUse" x1={a.x} x2={b.x}>
                  <stop offset="0" stopColor={a.tier!.color} />
                  <stop offset="1" stopColor={b.tier!.color} />
                </linearGradient>
              )
            })}
          </defs>
          {/* 评过级的点向下引一条细线到基线，方便对上年份 */}
          {rated.map((node) => (
            <line
              key={node.part.id}
              x1={node.x}
              x2={node.x}
              y1={node.y}
              y2={BASE}
              stroke={node.tier!.color}
              strokeOpacity="0.28"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* 折线：两点之间隔着没评级的电影时画成虚线 */}
          {rated.slice(1).map((b, k) => {
            const a = rated[k]
            return (
              <motion.line
                key={b.part.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                // 水平线段没有高度，渐变按整张图的坐标算（userSpaceOnUse）才不会失效
                stroke={`url(#seg-${a.part.id}-${b.part.id})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={b.i - a.i > 1 ? '5 5' : undefined}
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 + k * 0.08 }}
              />
            )
          })}
        </svg>

        {nodes.map(({ part, entry, tier, y, left }, i) => {
          const status = entry?.status
          const state = tier ? tier.name : status === 'watched' ? '看过，还没评级' : status === 'wishlist' ? '想看' : '没看过'
          return (
            <div key={part.id} className="absolute" style={{ left, top: 0, height: HEIGHT }}>
              <motion.button
                onClick={() => openDetail(entry ?? part)}
                aria-label={`${part.title}（${part.year}）：${state}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.04 }}
                className="group absolute flex h-8 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center hover:z-10 focus-visible:z-10"
                style={{ top: y }}
              >
                {tier ? (
                  <span
                    className="num flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold text-ink transition-transform duration-200 group-hover:scale-125"
                    style={{ background: tier.color, boxShadow: `0 0 16px -2px ${tier.color}` }}
                  >
                    {tier.id}
                  </span>
                ) : status === 'watched' ? (
                  <span className="h-3 w-3 rounded-full bg-bone transition-transform duration-200 group-hover:scale-125" />
                ) : status === 'wishlist' ? (
                  <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-dashed border-flare transition-transform duration-200 group-hover:scale-125" />
                ) : (
                  <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 bg-panel transition duration-200 group-hover:scale-125 group-hover:border-white/70" />
                )}
                {/* 鼠标悬停时的小卡片（触屏上直接点开详情） */}
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-max max-w-[220px] -translate-x-1/2 translate-y-1 items-center gap-3 rounded-xl border border-white/10 bg-[#1a171e]/95 p-2 pr-3.5 text-left opacity-0 shadow-float backdrop-blur-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 md:flex">
                  <Poster movie={part} size="w185" className="w-11 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-bone">{part.title}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: tier?.color ?? '#a199a3' }}>
                      {state}
                    </span>
                  </span>
                </span>
              </motion.button>
              <span className="num absolute -translate-x-1/2 text-[10px] text-dim" style={{ top: BASE + 16 }}>
                <span className="md:hidden">'{part.year.slice(2)}</span>
                <span className="hidden md:inline">{part.year}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendRow({ id, name, mine }: { id: number; name: string; mine: Entry[] }) {
  const { info, error, parts, byId, watched, done } = useSeries(id, mine)
  return (
    <div className="grid items-center gap-x-8 gap-y-4 px-5 py-6 md:grid-cols-[210px_1fr] md:px-7">
      <div className="min-w-0">
        <h2 className="truncate font-serif text-[19px] font-bold" title={info?.name ?? name}>
          {info?.name ?? name}
        </h2>
        <div className="mt-1">
          <Progress watched={watched} total={info ? parts.length : null} done={done} />
        </div>
        {error && <p className="mt-1 text-xs text-ash">没能获取完整系列</p>}
      </div>
      <TrendChart parts={parts} byId={byId} />
    </div>
  )
}

function Legend() {
  const item = 'flex items-center gap-1.5'
  return (
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ash">
      <span className={item}>
        <span className="num flex h-4 w-4 items-center justify-center rounded-full bg-flare text-[9px] font-bold text-ink">S</span>
        评过级，越高越靠上
      </span>
      <span className={item}>
        <span className="h-2.5 w-2.5 rounded-full bg-bone" />
        看过，还没评级
      </span>
      <span className={item}>
        <span className="h-3 w-3 rounded-full border-[1.5px] border-dashed border-flare" />
        想看
      </span>
      <span className={item}>
        <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white/30" />
        没看过
      </span>
    </div>
  )
}

export function Series() {
  const entries = useEntries()
  const { seriesView: view, setSeriesView } = useUi()
  const groups = useMemo(() => {
    const m = new Map<number, { name: string; mine: Entry[] }>()
    for (const e of entries) {
      if (!e.collection) continue
      const g = m.get(e.collection.id) ?? { name: e.collection.name, mine: [] }
      g.mine.push(e)
      m.set(e.collection.id, g)
    }
    return [...m.entries()].sort((a, b) => b[1].mine.length - a[1].mine.length)
  }, [entries])

  return (
    <div>
      <PageTitle
        aside={
          <div className="flex items-center gap-4">
            <span className="num text-sm text-ash">{groups.length} 个系列</span>
            {groups.length > 0 && (
              <ViewToggle
                id="series-view"
                value={view}
                onChange={setSeriesView}
                options={[
                  { value: 'posters', label: '海报', icon: Images },
                  { value: 'trend', label: '评级走势', icon: Activity },
                ]}
              />
            )}
          </div>
        }
      >
        系列
      </PageTitle>
      {groups.length === 0 ? (
        <Empty title="还没有系列电影">
          <p className="max-w-md text-sm text-ash">
            片单里的电影如果属于某个系列（比如《电锯惊魂》《招魂》），这里会列出整个系列，标出你看了哪几部、还差哪几部。
          </p>
        </Empty>
      ) : view === 'trend' ? (
        <>
          <Legend />
          <section className="card divide-y divide-white/[0.06]">
            {groups.map(([id, g]) => (
              <TrendRow key={id} id={id} name={g.name} mine={g.mine} />
            ))}
          </section>
        </>
      ) : (
        groups.map(([id, g]) => <PosterBlock key={id} id={id} name={g.name} mine={g.mine} />)
      )}
    </div>
  )
}
