import { Skull } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { tierOf } from '../lib/constants'
import { posterUrl } from '../lib/tmdb'
import type { MovieLite, TierId } from '../lib/types'

/** 海报。没有海报或加载失败时，用片名占位 */
export function Poster({
  movie,
  size = 'w342',
  className = '',
}: {
  movie: Pick<MovieLite, 'title' | 'posterPath'>
  size?: 'w185' | 'w342' | 'w500'
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = posterUrl(movie.posterPath, size)
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[3px] bg-raise ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={movie.title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-end border border-line p-2">
          <span className="line-clamp-4 font-serif text-[13px] leading-snug text-ash">{movie.title}</span>
        </div>
      )}
    </div>
  )
}

/** 评级字母块 */
export function TierBadge({ tier, size = 'md' }: { tier: TierId | null; size?: 'sm' | 'md' | 'lg' }) {
  const t = tierOf(tier)
  if (!t) return null
  const box = { sm: 'h-5 w-5 text-[11px]', md: 'h-6 w-6 text-[13px]', lg: 'h-9 w-9 text-lg' }[size]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] font-mono font-bold text-ink ${box}`}
      style={{ background: t.color }}
      title={t.name}
    >
      {t.id}
    </span>
  )
}

/** 吓人指数：五个骷髅。传 onChange 时可点击，再点一次当前值会清零 */
export function Skulls({
  value,
  onChange,
  size = 14,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  if (!onChange) {
    return (
      <span className="inline-flex gap-0.5" role="img" aria-label={`吓人指数 ${value} / 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Skull key={n} size={size} className={n <= value ? 'text-flare' : 'text-dim/50'} strokeWidth={2} />
        ))}
      </span>
    )
  }
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="吓人指数">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} 个骷髅`}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
            n <= value ? 'border-blood/60 bg-blood/15 text-flare' : 'border-line text-dim hover:text-ash'
          }`}
        >
          <Skull size={20} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-dashed border-line px-6 py-10">
      <p className="font-serif text-xl text-bone">{title}</p>
      {children}
    </div>
  )
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-serif text-[28px] leading-tight font-bold md:text-[34px]">{children}</h1>
      {aside}
    </div>
  )
}
