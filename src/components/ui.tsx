import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown, Skull, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { tierOf } from '../lib/constants'
import { posterUrl } from '../lib/tmdb'
import type { MovieLite, TierId } from '../lib/types'

/** 海报。加载完成后淡入；没有海报或加载失败时用片名占位 */
export function Poster({
  movie,
  size = 'w342',
  className = '',
}: {
  movie: Pick<MovieLite, 'title' | 'posterPath'>
  size?: 'w185' | 'w342' | 'w500'
  className?: string
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading')
  const src = posterUrl(movie.posterPath, size)
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-raise ${className}`}>
      {src && state !== 'failed' ? (
        <img
          src={src}
          alt={movie.title}
          loading="lazy"
          onLoad={() => setState('ok')}
          onError={() => setState('failed')}
          className={`h-full w-full object-cover transition-opacity duration-500 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="flex h-full w-full items-end bg-gradient-to-b from-raise to-panel p-2.5">
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
  const box = {
    sm: 'h-5 w-5 rounded-[5px] text-[11px]',
    md: 'h-7 w-7 rounded-lg text-sm',
    lg: 'h-10 w-10 rounded-xl text-xl',
  }[size]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-mono font-bold text-ink ${box}`}
      style={{
        background: t.color,
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.45), 0 3px 10px rgb(0 0 0 / 0.55)',
      }}
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
          <Skull key={n} size={size} className={n <= value ? 'text-flare' : 'text-white/15'} strokeWidth={2} />
        ))}
      </span>
    )
  }
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="吓人指数">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value
        return (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} 个骷髅`}
            onClick={() => onChange(value === n ? 0 : n)}
            whileTap={{ scale: 0.86 }}
            animate={{ scale: on ? 1 : 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors duration-200 ${
              on
                ? 'border-flare/40 bg-flare/15 text-flare shadow-[0_0_18px_-4px_rgb(255_64_87/0.6)]'
                : 'border-white/10 bg-white/[0.03] text-dim hover:text-ash'
            }`}
          >
            <Skull size={20} strokeWidth={1.75} />
          </motion.button>
        )
      })}
    </div>
  )
}

/** 下拉选择。value 可以是空字符串（表示"全部"） */
export function Select({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  className?: string
}) {
  // Radix 不允许选项的值是空字符串，内部用占位值代替
  const enc = (v: string) => (v === '' ? '__all' : v)
  const dec = (v: string) => (v === '__all' ? '' : v)
  return (
    <RSelect.Root value={enc(value)} onValueChange={(v) => onChange(dec(v))}>
      <RSelect.Trigger
        aria-label={label}
        className={`inline-flex h-9 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.04] pr-2.5 pl-3.5 text-[13px] text-bone transition duration-200 hover:border-white/25 data-[state=open]:border-white/30 ${className}`}
      >
        <RSelect.Value />
        <RSelect.Icon>
          <ChevronDown size={15} className="text-ash" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/10 bg-[#1a171e]/95 shadow-float backdrop-blur-xl"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={enc(o.value)}
                className="flex h-9 cursor-pointer items-center justify-between gap-4 rounded-lg px-3 text-[13px] text-ash outline-none select-none data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-bone data-[state=checked]:text-bone"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator>
                  <Check size={14} className="text-flare" />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-4 px-7 py-12">
      <p className="font-serif text-2xl text-bone">{title}</p>
      {children}
    </div>
  )
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-serif text-[30px] leading-tight font-bold md:text-[38px]">{children}</h1>
      {aside}
    </div>
  )
}

/** 弹层的半透明背景 */
export function Backdrop({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <motion.div
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    />
  )
}

/** 两种展示方式之间的切换按钮。id 用来区分页面上的不同切换器（选中的白色滑块各滑各的） */
export function ViewToggle<T extends string>({
  id,
  value,
  onChange,
  options,
  className = '',
}: {
  id: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon: LucideIcon }[]
  className?: string
}) {
  return (
    <div
      className={`flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 ${className}`}
      role="group"
      aria-label="展示方式"
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={label}
          title={label}
          className={`relative flex h-8 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
            value === v ? 'text-ink' : 'text-ash hover:text-bone'
          }`}
        >
          {value === v && (
            <motion.span
              layoutId={id}
              className="absolute inset-0 rounded-full bg-bone"
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            />
          )}
          <Icon size={16} className="relative" />
        </button>
      ))}
    </div>
  )
}
