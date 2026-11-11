import { Bookmark } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useEntries, useLog, useUi } from '../lib/store'
import { getCollection, getKey } from '../lib/tmdb'
import type { Entry, MovieLite } from '../lib/types'
import { Empty, PageTitle, Poster, TierBadge } from './ui'

const STALE_MS = 1000 * 60 * 60 * 24 * 30 // 系列成员缓存 30 天，之后重新拉取（可能出了新续集）

function SeriesBlock({ id, name, mine }: { id: number; name: string; mine: Entry[] }) {
  const info = useLog((s) => s.collections[id])
  const setCollection = useLog((s) => s.setCollection)
  const openDetail = useUi((s) => s.openDetail)
  const [error, setError] = useState('')

  useEffect(() => {
    const fresh = info && Date.now() - new Date(info.fetchedAt).getTime() < STALE_MS
    if (fresh || !getKey()) return
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
  const done = info != null && watched === parts.length

  return (
    <section className="border-t border-line py-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-serif text-xl font-bold">{info?.name ?? name}</h2>
        <p className="num text-sm text-ash">
          已看 <span className={done ? 'text-flare' : 'text-bone'}>{watched}</span>
          {info ? ` / ${parts.length}` : ''}
          {done && <span className="ml-2 font-sans text-flare">全部看完</span>}
        </p>
      </div>
      {/* 每一格代表系列里的一部，亮的是已看 */}
      {info && (
        <div className="mb-4 flex max-w-md gap-1" aria-hidden>
          {parts.map((p) => (
            <span
              key={p.id}
              className={`h-1 flex-1 rounded-full ${byId.get(p.id)?.status === 'watched' ? 'bg-flare' : 'bg-line'}`}
            />
          ))}
        </div>
      )}
      {error && <p className="mb-3 text-[13px] text-ash">没能获取完整系列：{error}</p>}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {parts.map((p) => {
          const e = byId.get(p.id)
          const seen = e?.status === 'watched'
          return (
            <button key={p.id} onClick={() => openDetail(e ?? p)} className="w-[96px] shrink-0 text-left md:w-[112px]">
              <div className="relative">
                <Poster movie={p} size="w185" className={seen ? '' : 'opacity-40 grayscale'} />
                {e?.tier && (
                  <span className="absolute top-1 left-1">
                    <TierBadge tier={e.tier} size="sm" />
                  </span>
                )}
                {e?.status === 'wishlist' && (
                  <span className="absolute top-1 left-1 rounded-[3px] bg-ink/80 p-1 text-bone" title="在想看片单里">
                    <Bookmark size={12} />
                  </span>
                )}
              </div>
              <p className={`mt-1.5 truncate text-[13px] ${seen ? 'text-bone' : 'text-ash'}`}>{p.title}</p>
              <p className="num text-xs text-dim">{p.year}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function Series() {
  const entries = useEntries()
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
      <PageTitle aside={<span className="num text-sm text-ash">{groups.length} 个系列</span>}>系列</PageTitle>
      {groups.length === 0 ? (
        <Empty title="还没有系列电影">
          <p className="max-w-md text-sm text-ash">
            片单里的电影如果属于某个系列（比如《电锯惊魂》《招魂》），这里会列出整个系列，标出你看了哪几部、还差哪几部。
          </p>
        </Empty>
      ) : (
        groups.map(([id, g]) => <SeriesBlock key={id} id={id} name={g.name} mine={g.mine} />)
      )}
    </div>
  )
}
