import { Dices, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOverlay } from '../lib/actions'
import { useEntries, useUi } from '../lib/store'
import type { Entry } from '../lib/types'
import { Backdrop, Poster, Select } from './ui'

const RUNTIMES = [
  { value: '0', label: '片长不限' },
  { value: '90', label: '90 分钟以内' },
  { value: '120', label: '两小时以内' },
]

/** 从想看片单里随机抽一部 */
function Panel() {
  const { setTonightOpen, openDetail } = useUi()
  const entries = useEntries()
  const [tag, setTag] = useState('')
  const [maxRuntime, setMaxRuntime] = useState(0)
  const [shown, setShown] = useState<Entry | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  const close = useCallback(() => setTonightOpen(false), [setTonightOpen])
  useOverlay(true, close)
  useEffect(() => () => clearInterval(timer.current), [])

  const wishlist = useMemo(() => entries.filter((e) => e.status === 'wishlist'), [entries])
  const tags = useMemo(() => [...new Set(wishlist.flatMap((e) => e.tags))], [wishlist])
  const pool = useMemo(
    () =>
      wishlist.filter(
        (e) => (!tag || e.tags.includes(tag)) && (!maxRuntime || (e.runtime != null && e.runtime <= maxRuntime)),
      ),
    [wishlist, tag, maxRuntime],
  )

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

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center">
      <Backdrop onClick={close} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="今晚看什么"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative mx-auto w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-6 shadow-float md:rounded-3xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-[26px] font-bold">今晚看什么</h2>
          <button onClick={close} className="btn btn-quiet h-9 w-9 rounded-full px-0" aria-label="关闭">
            <X size={19} />
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          <Select
            label="子类型"
            value={tag}
            onChange={setTag}
            options={[{ value: '', label: '子类型不限' }, ...tags.map((t) => ({ value: t, label: t }))]}
            className="flex-1"
          />
          <Select
            label="片长"
            value={String(maxRuntime)}
            onChange={(v) => setMaxRuntime(Number(v))}
            options={RUNTIMES}
            className="flex-1"
          />
        </div>

        <div className="flex min-h-[186px] items-center gap-5" aria-live="polite">
          {shown ? (
            <>
              <motion.div
                key={rolling ? 'rolling' : `pick-${shown.id}`}
                initial={rolling ? false : { scale: 0.9, rotate: -2 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className={`w-[120px] shrink-0 rounded-xl ${
                  rolling ? 'opacity-55 blur-[1px]' : 'shadow-[0_0_44px_-8px_rgb(255_64_87/0.65)] ring-1 ring-flare/70'
                }`}
              >
                <Poster key={shown.id} movie={shown} />
              </motion.div>
              {!rolling && (
                <motion.div
                  key={shown.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                  className="min-w-0"
                >
                  <p className="font-serif text-[22px] leading-snug font-bold">{shown.title}</p>
                  <p className="num mt-1 text-[13px] text-ash">
                    {[shown.year, shown.runtime && `${shown.runtime} 分钟`].filter(Boolean).join('　')}
                  </p>
                  <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ash">{shown.overview}</p>
                </motion.div>
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

        <div className="mt-6 flex gap-2">
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
      </motion.div>
    </div>
  )
}

export function TonightDialog() {
  const open = useUi((s) => s.tonightOpen)
  return <AnimatePresence>{open && <Panel key="tonight" />}</AnimatePresence>
}
