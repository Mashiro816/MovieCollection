import { motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TIERS } from '../lib/constants'
import { useEntries, useUi } from '../lib/store'
import type { Entry } from '../lib/types'
import { Empty, PageTitle, Poster } from './ui'

// 每档默认显示多少张：手机一行 5 张，显示 4 行；电脑显示两行左右
const FOLD = window.matchMedia('(min-width: 768px)').matches ? 18 : 20

function Row({
  letter,
  name,
  color,
  entries,
  index,
}: {
  letter: string
  name: string
  color: string
  entries: Entry[]
  index: number
}) {
  const openDetail = useUi((s) => s.openDetail)
  // 一档里电影很多时先只显示前面一部分，避免整页被一档占满
  const [expanded, setExpanded] = useState(false)
  const collapsible = entries.length > FOLD + 6
  const shown = collapsible && !expanded ? entries.slice(0, FOLD) : entries
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
      className="card relative grid overflow-clip md:grid-cols-[190px_1fr]"
      aria-label={name}
    >
      {/* 档位颜色从左侧晕开，越靠右越淡 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(520px 260px at 0% 50%, ${color}26, transparent 70%)` }}
      />
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />

      <div className="relative flex items-center gap-3 px-5 pt-4 md:sticky md:top-24 md:flex-col md:items-start md:justify-center md:gap-0 md:self-start md:px-7 md:py-6">
        <span
          className="num text-[40px] leading-none font-bold md:text-[72px]"
          style={{ color, textShadow: `0 0 36px ${color}66` }}
        >
          {letter}
        </span>
        <span className="font-serif text-lg font-bold md:mt-2.5 md:text-xl">{name}</span>
        <span className="num ml-auto text-xs text-ash md:mt-1 md:ml-0">{entries.length} 部</span>
      </div>

      <div className="relative grid min-h-[72px] grid-cols-5 content-start gap-2 p-4 md:flex md:min-h-[150px] md:flex-wrap md:gap-3 md:py-5 md:pr-6 md:pl-0">
        {entries.length === 0 ? (
          <span className="col-span-5 self-center text-[13px] text-dim">这一档还空着</span>
        ) : (
          shown.map((e) => (
            <button
              key={e.id}
              onClick={() => openDetail(e)}
              title={e.title}
              className="rounded-lg shadow-poster ring-1 ring-white/[0.08] transition duration-300 ease-out-soft hover:-translate-y-1 hover:ring-white/35 md:w-[92px]"
            >
              <Poster movie={e} size="w185" className="rounded-lg" />
            </button>
          ))
        )}
        {collapsible && (
          <div className="col-span-5 md:basis-full">
            <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="chip mt-1">
              {expanded ? '收起' : `显示全部 ${entries.length} 部`}
              <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </motion.section>
  )
}

export function TierWall() {
  const entries = useEntries()
  const watched = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'watched')
        .sort((a, b) => b.scare - a.scare || (b.watchedAt ?? '').localeCompare(a.watchedAt ?? '')),
    [entries],
  )
  const unrated = watched.filter((e) => !e.tier)
  const setSearchOpen = useUi((s) => s.setSearchOpen)

  return (
    <div>
      <PageTitle aside={<span className="num text-sm text-ash">已评级 {watched.length - unrated.length} 部</span>}>
        评级墙
      </PageTitle>
      {watched.length === 0 ? (
        <Empty title="评级墙还是空的">
          <p className="text-sm text-ash">给看过的电影评级后，海报会按档位排在这里。</p>
          <button className="btn btn-primary" onClick={() => setSearchOpen(true)}>
            搜索电影
          </button>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {TIERS.map((t, i) => (
            <Row
              key={t.id}
              index={i}
              letter={t.id}
              name={t.name}
              color={t.color}
              entries={watched.filter((e) => e.tier === t.id)}
            />
          ))}
          {unrated.length > 0 && <Row index={5} letter="?" name="还没评级" color="#655e6a" entries={unrated} />}
        </div>
      )}
    </div>
  )
}
