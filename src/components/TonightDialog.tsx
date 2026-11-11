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

const SPIN_SECONDS = 4.6
const pickRandom = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

/** 轮盘上放哪几部：最多 10 格，从候选里随机取；候选不足 6 部时重复使用，凑满 6 格 */
function buildSlots(pool: Entry[]): Entry[] {
  if (pool.length === 0) return []
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const count = pool.length >= 10 ? 10 : pool.length >= 8 ? 8 : 6
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length])
}

/**
 * 轮盘：海报排在盘面外圈，指针固定在正上方。
 * 转动时先选好中奖的那一格，再算出让它正好停在指针下面需要转多少度，多转 5 整圈后减速停下。
 */
function Wheel({
  slots,
  rotation,
  spinning,
  winnerIndex,
  onStop,
}: {
  slots: Entry[]
  rotation: number
  spinning: boolean
  winnerIndex: number | null
  onStop: () => void
}) {
  const n = slots.length
  const step = 360 / n
  return (
    <div className="relative mx-auto h-[272px] w-[272px] md:h-[308px] md:w-[308px]">
      {/* 盘面下的一圈暗红光 */}
      <div className="absolute -inset-5 rounded-full bg-blood/20 blur-2xl" />
      <motion.div
        className="absolute inset-0 rounded-full border border-white/15 shadow-[inset_0_0_40px_rgb(0_0_0/0.7),0_20px_50px_-20px_rgb(0_0_0/0.9)]"
        style={{
          // 深浅相间的扇形格
          background: `repeating-conic-gradient(from ${-step / 2}deg, #18151c 0deg ${step}deg, #221e28 ${step}deg ${step * 2}deg)`,
        }}
        animate={{ rotate: rotation }}
        transition={spinning ? { duration: SPIN_SECONDS, ease: [0.12, 0.62, 0.06, 1] } : { duration: 0 }}
        onAnimationComplete={() => spinning && onStop()}
      >
        {slots.map((e, i) => {
          const won = !spinning && winnerIndex === i
          return (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-[46px] md:w-[52px]"
              // 先转到这一格的角度，再沿半径推到外圈
              style={{ transform: `translate(-50%, -50%) rotate(${i * step}deg) translateY(calc(-1 * var(--r)))` }}
            >
              <Poster
                movie={e}
                size="w185"
                className={`rounded-md transition duration-500 ${
                  won
                    ? 'scale-[1.18] shadow-[0_0_26px_rgb(255_64_87/0.85)] ring-2 ring-flare'
                    : `ring-1 ring-white/15 ${winnerIndex != null && !spinning ? 'opacity-45' : ''}`
                }`}
              />
            </div>
          )
        })}
        {/* 轴心 */}
        <div className="absolute top-1/2 left-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-panel shadow-[0_0_0_6px_rgb(0_0_0/0.35),inset_0_2px_10px_rgb(255_255_255/0.06)]">
          <span className="h-3 w-3 rounded-full bg-flare shadow-[0_0_14px_rgb(255_64_87/0.9)]" />
        </div>
      </motion.div>
      {/* 指针 */}
      <div
        className={`absolute -top-2.5 left-1/2 z-10 -ml-[11px] origin-top ${spinning ? 'animate-[pointer-tick_0.16s_ease-in-out_infinite_alternate]' : ''}`}
        aria-hidden
      >
        <div className="h-0 w-0 border-x-[11px] border-t-[20px] border-x-transparent border-t-flare drop-shadow-[0_0_8px_rgb(255_64_87/0.9)]" />
      </div>
    </div>
  )
}

function Panel() {
  const { setTonightOpen, openDetail } = useUi()
  const entries = useEntries()
  const [tag, setTag] = useState('')
  const [maxRuntime, setMaxRuntime] = useState(0)
  const [slots, setSlots] = useState<Entry[]>([])
  const [rotation, setRotation] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle')
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  const lastWinner = useRef<number | null>(null)

  const close = useCallback(() => setTonightOpen(false), [setTonightOpen])
  useOverlay(true, close)

  const wishlist = useMemo(() => entries.filter((e) => e.status === 'wishlist'), [entries])
  const tags = useMemo(() => [...new Set(wishlist.flatMap((e) => e.tags))], [wishlist])
  const pool = useMemo(
    () =>
      wishlist.filter(
        (e) => (!tag || e.tags.includes(tag)) && (!maxRuntime || (e.runtime != null && e.runtime <= maxRuntime)),
      ),
    [wishlist, tag, maxRuntime],
  )

  // 候选变了（换了筛选条件）就重新摆盘
  const poolKey = pool.map((e) => e.id).join(',')
  useEffect(() => {
    setSlots(buildSlots(pool))
    setPhase('idle')
    setWinnerIndex(null)
    // 只在候选的组成变化时重摆，pool 本身每次渲染都是新数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey])

  const spin = () => {
    if (pool.length === 0 || phase === 'spinning') return
    // 尽量不连续抽到同一部
    const candidates = pool.length > 1 ? pool.filter((e) => e.id !== lastWinner.current) : pool
    const winner = pickRandom(candidates)
    lastWinner.current = winner.id

    // 中奖的电影不在盘上（候选超过 10 部时可能发生）就随机换掉一格
    const next = [...slots]
    let index = next.findIndex((e) => e.id === winner.id)
    if (index < 0) {
      index = Math.floor(Math.random() * next.length)
      next[index] = winner
    }
    setSlots(next)
    setWinnerIndex(index)

    // 第 index 格在盘面上顺时针 index × step 度的位置，转到正上方需要再转 360 - 这个角度
    const step = 360 / next.length
    const target = Math.ceil(rotation / 360) * 360 + 360 * 5 + ((360 - index * step) % 360)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setRotation(target)
    setPhase(still ? 'done' : 'spinning')
  }

  const winner = phase === 'done' && winnerIndex != null ? slots[winnerIndex] : null

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center">
      <Backdrop onClick={close} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="随机推荐"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative mx-auto max-h-dvh w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-6 shadow-float md:rounded-3xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-[26px] font-bold">今晚看什么</h2>
          <button onClick={close} className="btn btn-quiet h-9 w-9 rounded-full px-0" aria-label="关闭">
            <X size={19} />
          </button>
        </div>

        <div className="mb-7 flex gap-2">
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

        {pool.length === 0 ? (
          <p className="py-16 text-center text-sm text-ash">
            {wishlist.length === 0 ? '暂无想看的电影。' : '没有符合条件的电影，放宽一下条件试试。'}
          </p>
        ) : (
          <div className="[--r:96px] md:[--r:110px]">
            <Wheel
              slots={slots}
              rotation={rotation}
              spinning={phase === 'spinning'}
              winnerIndex={winnerIndex}
              onStop={() => setPhase('done')}
            />
          </div>
        )}

        {/* 结果。高度固定，转之前和转之后弹层不会跳动 */}
        <div className="mt-6 flex h-[92px] items-center justify-center text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            {winner ? (
              <motion.div
                key={`${winner.id}-${rotation}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                className="min-w-0"
              >
                <p className="truncate font-serif text-[24px] leading-snug font-bold">{winner.title}</p>
                <p className="num mt-1 text-[13px] text-ash">
                  {[winner.year, winner.runtime && `${winner.runtime} 分钟`].filter(Boolean).join('　')}
                </p>
                {winner.tags.length > 0 && <p className="mt-1 text-xs text-dim">{winner.tags.slice(0, 3).join(' / ')}</p>}
              </motion.div>
            ) : pool.length > 0 ? (
              <motion.p key="hint" exit={{ opacity: 0 }} className="text-sm text-ash">
                {phase === 'spinning' ? '转动中' : `从 ${pool.length} 部想看的电影里抽一部。`}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={spin} disabled={phase === 'spinning' || pool.length === 0}>
            <Dices size={17} />
            {phase === 'done' ? '再转一次' : '转动轮盘'}
          </button>
          {winner && (
            <button
              className="btn flex-1"
              onClick={() => {
                close()
                openDetail(winner)
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

/** 随机推荐：从想看片单里转轮盘抽一部 */
export function TonightDialog() {
  const open = useUi((s) => s.tonightOpen)
  return <AnimatePresence>{open && <Panel key="tonight" />}</AnimatePresence>
}
