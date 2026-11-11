import { Dices, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOverlay } from '../lib/actions'
import { useEntries, useUi } from '../lib/store'
import type { Entry } from '../lib/types'
import { Poster } from './ui'

const RUNTIMES = [
  { value: 0, label: '片长不限' },
  { value: 90, label: '90 分钟以内' },
  { value: 120, label: '两小时以内' },
]

/** 从想看片单里随机抽一部 */
export function TonightDialog() {
  const { tonightOpen, setTonightOpen, openDetail } = useUi()
  const entries = useEntries()
  const [tag, setTag] = useState('')
  const [maxRuntime, setMaxRuntime] = useState(0)
  const [shown, setShown] = useState<Entry | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  const close = useCallback(() => setTonightOpen(false), [setTonightOpen])
  useOverlay(tonightOpen, close)

  const wishlist = useMemo(() => entries.filter((e) => e.status === 'wishlist'), [entries])
  const tags = useMemo(() => [...new Set(wishlist.flatMap((e) => e.tags))], [wishlist])
  const pool = useMemo(
    () =>
      wishlist.filter(
        (e) => (!tag || e.tags.includes(tag)) && (!maxRuntime || (e.runtime != null && e.runtime <= maxRuntime)),
      ),
    [wishlist, tag, maxRuntime],
  )

  useEffect(() => {
    if (!tonightOpen) {
      clearInterval(timer.current)
      setShown(null)
      setRolling(false)
    }
    return () => clearInterval(timer.current)
  }, [tonightOpen])

  const draw = () => {
    if (pool.length === 0) return
    // 尽量不连续抽到同一部
    const candidates = pool.length > 1 ? pool.filter((e) => e.id !== shown?.id) : pool
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || pool.length < 3) return setShown(pick)

    // 快速闪过几张海报再停下
    setRolling(true)
    let ticks = 0
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      ticks += 1
      if (ticks >= 11) {
        clearInterval(timer.current)
        setShown(pick)
        setRolling(false)
      } else {
        setShown(pool[Math.floor(Math.random() * pool.length)])
      }
    }, 85)
  }

  if (!tonightOpen) return null

  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-end bg-black/75 backdrop-blur-sm md:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="今晚看什么"
        onClick={(e) => e.stopPropagation()}
        className="anim-rise mx-auto w-full max-w-md rounded-t-xl border border-line bg-panel p-5 md:rounded-xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold">今晚看什么</h2>
          <button onClick={close} className="btn btn-quiet h-9 px-2" aria-label="关闭">
            <X size={19} />
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="field" aria-label="子类型">
            <option value="">子类型不限</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            value={maxRuntime}
            onChange={(e) => setMaxRuntime(Number(e.target.value))}
            className="field"
            aria-label="片长"
          >
            {RUNTIMES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-h-[176px] items-center gap-4" aria-live="polite">
          {shown ? (
            <>
              <Poster
                key={shown.id}
                movie={shown}
                className={`w-[112px] shrink-0 ${rolling ? 'opacity-60' : 'ring-1 ring-flare'}`}
              />
              {!rolling && (
                <div className="anim-rise min-w-0">
                  <p className="font-serif text-xl leading-snug font-bold">{shown.title}</p>
                  <p className="num mt-1 text-[13px] text-ash">
                    {[shown.year, shown.runtime && `${shown.runtime} 分钟`].filter(Boolean).join('　')}
                  </p>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ash">{shown.overview}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ash">
              {pool.length === 0
                ? '想看片单里没有符合条件的电影，放宽一下条件试试。'
                : `从 ${pool.length} 部想看的电影里随机抽一部。`}
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={draw} disabled={rolling || pool.length === 0}>
            <Dices size={17} />
            {shown ? '再抽一次' : '抽一部'}
          </button>
          {shown && !rolling && (
            <button
              className="btn flex-1"
              onClick={() => {
                close()
                openDetail(shown)
              }}
            >
              就看这部
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
