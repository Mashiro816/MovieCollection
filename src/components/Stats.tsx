import { Skull } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { CONTEXT_OPTIONS, TIERS } from '../lib/constants'
import { useEntries } from '../lib/store'
import { Empty, PageTitle } from './ui'

function Bar({ label, value, max, color = '#ebe5df' }: { label: React.ReactNode; value: number; max: number; color?: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr_36px] items-center gap-3 py-2 text-sm">
      <span className="truncate text-ash">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${max ? (value / max) * 100 : 0}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </span>
      <span className="num text-right text-bone">{value}</span>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 font-serif text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function Stats() {
  const entries = useEntries()
  const s = useMemo(() => {
    const watched = entries.filter((e) => e.status === 'watched')
    const year = String(new Date().getFullYear())
    const scared = watched.filter((e) => e.scare > 0)
    const tags = new Map<string, number>()
    watched.forEach((e) => e.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1)))
    return {
      watched,
      wishlist: entries.length - watched.length,
      thisYear: watched.filter((e) => e.watchedAt?.startsWith(year)).length,
      hours: Math.round(watched.reduce((n, e) => n + (e.runtime ?? 0), 0) / 60),
      avgScare: scared.length ? scared.reduce((n, e) => n + e.scare, 0) / scared.length : 0,
      tiers: TIERS.map((t) => ({ ...t, n: watched.filter((e) => e.tier === t.id).length })),
      scares: [5, 4, 3, 2, 1].map((v) => ({ v, n: watched.filter((e) => e.scare === v).length })),
      tags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    }
  }, [entries])

  if (s.watched.length === 0) {
    return (
      <div>
        <PageTitle>统计</PageTitle>
        <Empty title="还没有数据">
          <p className="text-sm text-ash">记录几部看过的电影后，这里会显示你的评级分布和最常看的子类型。</p>
        </Empty>
      </div>
    )
  }

  const figures = [
    { label: '看过', value: s.watched.length, unit: '部' },
    { label: '今年看了', value: s.thisYear, unit: '部' },
    { label: '想看', value: s.wishlist, unit: '部' },
    { label: '累计片长', value: s.hours, unit: '小时' },
    { label: '平均吓人指数', value: s.avgScare ? s.avgScare.toFixed(1) : '无', unit: s.avgScare ? '/ 5' : '' },
  ]
  const maxTier = Math.max(...s.tiers.map((t) => t.n))
  const maxScare = Math.max(...s.scares.map((x) => x.n))

  return (
    <div>
      <PageTitle>统计</PageTitle>
      <dl className="card mb-4 grid grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-5">
        {figures.map((f) => (
          <div key={f.label} className="-mr-px -mb-px border-r border-b border-white/[0.06] px-6 py-5">
            <dt className="text-[13px] text-ash">{f.label}</dt>
            <dd className="mt-1.5 flex items-baseline gap-1.5">
              <span className="num text-[32px] leading-none font-semibold">{f.value}</span>
              <span className="text-[13px] text-ash">{f.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="评级分布">
          {s.tiers.map((t) => (
            <Bar
              key={t.id}
              label={
                <>
                  <span className="num mr-1.5 font-bold" style={{ color: t.color }}>
                    {t.id}
                  </span>
                  {t.name}
                </>
              }
              value={t.n}
              max={maxTier}
              color={t.color}
            />
          ))}
        </Block>

        <Block title="最常看的子类型">
          {s.tags.length === 0 ? (
            <p className="text-sm text-ash">片单里的电影还没有子类型标签。</p>
          ) : (
            s.tags.map(([t, n]) => <Bar key={t} label={t} value={n} max={s.tags[0][1]} />)
          )}
        </Block>

        <Block title="吓人指数分布">
          {s.scares.map(({ v, n }) => (
            <Bar
              key={v}
              label={
                <span className="flex gap-0.5 text-flare" aria-label={`${v} 个骷髅`}>
                  {Array.from({ length: v }, (_, i) => (
                    <Skull key={i} size={13} />
                  ))}
                </span>
              }
              value={n}
              max={maxScare}
              color="#c8102e"
            />
          ))}
        </Block>

        <Block title="怎么看的">
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(CONTEXT_OPTIONS) as (keyof typeof CONTEXT_OPTIONS)[]).map((k) => (
              <div key={k}>
                {CONTEXT_OPTIONS[k].map((o) => (
                  <p key={o.value} className="flex items-baseline justify-between border-b border-white/[0.06] py-2.5 text-sm">
                    <span className="text-ash">{o.label}</span>
                    <span className="num">{s.watched.filter((e) => e.context[k] === o.value).length}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Block>
      </div>
    </div>
  )
}
