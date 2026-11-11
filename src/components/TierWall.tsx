import { useMemo } from 'react'
import { TIERS } from '../lib/constants'
import { useEntries, useUi } from '../lib/store'
import type { Entry } from '../lib/types'
import { Empty, PageTitle, Poster } from './ui'

function Row({
  letter,
  name,
  color,
  entries,
}: {
  letter: string
  name: string
  color: string
  entries: Entry[]
}) {
  const openDetail = useUi((s) => s.openDetail)
  return (
    <section
      className="grid border-b border-line md:grid-cols-[168px_1fr]"
      style={{ borderLeft: `3px solid ${color}` }}
      aria-label={name}
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5 md:flex-col md:items-start md:justify-center md:gap-0 md:py-5"
        style={{ background: `linear-gradient(90deg, ${color}1f, transparent)` }}
      >
        <span className="num text-3xl leading-none font-bold md:text-[56px]" style={{ color }}>
          {letter}
        </span>
        <span className="font-serif text-base font-bold md:mt-2 md:text-lg">{name}</span>
        <span className="num ml-auto text-xs text-ash md:mt-0.5 md:ml-0">{entries.length} 部</span>
      </div>
      <div className="grid min-h-[72px] grid-cols-5 content-start gap-2 px-3 py-3 md:flex md:min-h-[132px] md:flex-wrap md:gap-2.5 md:px-4 md:py-4">
        {entries.length === 0 ? (
          <span className="col-span-5 self-center text-[13px] text-dim">这一档还空着</span>
        ) : (
          entries.map((e) => (
            <button
              key={e.id}
              onClick={() => openDetail(e)}
              title={e.title}
              className="transition hover:-translate-y-0.5 md:w-[84px]"
            >
              <Poster movie={e} size="w185" />
            </button>
          ))
        )}
      </div>
    </section>
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
        <div className="overflow-hidden rounded-md border border-b-0 border-line bg-panel">
          {TIERS.map((t) => (
            <Row
              key={t.id}
              letter={t.id}
              name={t.name}
              color={t.color}
              entries={watched.filter((e) => e.tier === t.id)}
            />
          ))}
          {unrated.length > 0 && <Row letter="?" name="还没评级" color="#615a66" entries={unrated} />}
        </div>
      )}
    </div>
  )
}
