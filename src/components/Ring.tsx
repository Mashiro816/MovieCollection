import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { tierOf } from '../lib/constants'
import { useUi } from '../lib/store'
import { posterUrl } from '../lib/tmdb'
import type { Entry } from '../lib/types'
import { Poster, Skulls, TierBadge } from './ui'

/**
 * 环形展台：海报排在一个圆环上，拖动、滚轮、方向键都能转动它。
 *
 * 做法：用一个数字 pos 表示"正对着你的是第几张"（可以是小数，转到一半时就是小数）。
 * 第 v 张海报与正面的夹角是 (v - pos) × STEP 度，由此算出它在环上的位置。
 * 只渲染正面附近的十来张，所以片单再长也不卡；片单够长时首尾相接，可以一直转下去。
 */

const SIDE = 4 // 正面两侧各显示几张
const STEP = 23 // 相邻两张之间的夹角（度）

const mod = (a: number, n: number) => ((a % n) + n) % n

function useCardWidth() {
  const query = '(min-width: 768px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop ? 214 : 150
}

function RingCard({
  v,
  entry,
  pos,
  radius,
  width,
  onPick,
}: {
  v: number
  entry: Entry
  pos: MotionValue<number>
  radius: number
  width: number
  onPick: (v: number) => void
}) {
  // 先退到圆心，转过夹角，再回到环上：这样每张海报都面朝外
  const transform = useTransform(
    pos,
    (p) => `translateZ(${-radius}px) rotateY(${(v - p) * STEP}deg) translateZ(${radius}px)`,
  )
  // 越靠侧面越暗、越透明，转到背面之前完全消失
  const opacity = useTransform(pos, (p) => Math.max(0, 1 - Math.pow(Math.abs(v - p) / (SIDE + 0.7), 2.4)))
  const filter = useTransform(pos, (p) => `brightness(${1 - Math.min(Math.abs(v - p), SIDE) * 0.14})`)
  const ring = useTransform(pos, (p) => Math.max(0, 1 - Math.abs(v - p) * 2))

  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-label={entry.title}
      onClick={() => onPick(v)}
      className="pointer-events-auto absolute top-0 left-1/2 block rounded-2xl text-left"
      style={{
        width,
        marginLeft: -width / 2,
        transform,
        opacity,
        filter,
        // 海报下方的倒影（Firefox 不支持，会直接不显示）
        WebkitBoxReflect: 'below 10px linear-gradient(transparent 62%, rgb(0 0 0 / 0.28))',
      }}
    >
      <Poster movie={entry} className="rounded-2xl shadow-poster ring-1 ring-white/10" />
      {/* 正对着的那一张有一圈亮边 */}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_60px_-10px_rgb(255_64_87/0.55)] ring-1 ring-white/45"
        style={{ opacity: ring }}
      />
      {entry.tier && (
        <span className="absolute top-2.5 left-2.5">
          <TierBadge tier={entry.tier} />
        </span>
      )}
    </motion.button>
  )
}

export function Ring({ entries }: { entries: Entry[] }) {
  const openDetail = useUi((s) => s.openDetail)
  const n = entries.length
  const width = useCardWidth()
  // 片单足够长时首尾相接；太短的话接起来会看到重复的海报，改为两端到头
  const loop = n >= SIDE * 2 + 3
  const radius = (width / 2 / Math.tan((STEP * Math.PI) / 360)) * 1.1
  const pxPerCard = width * 0.92 // 拖动多少像素算转过一张

  const pos = useMotionValue(0)
  const [center, setCenter] = useState(0)
  const moved = useRef(false)
  // 目标位置。转动还没停下时再按一次，是在目标上继续加，而不是从当前的中间位置算
  const target = useRef(0)
  useMotionValueEvent(pos, 'change', (p) => {
    const c = Math.round(p)
    setCenter((prev) => (prev === c ? prev : c))
  })

  const clamp = useCallback((p: number) => (loop ? p : Math.max(0, Math.min(n - 1, p))), [loop, n])
  const settle = useCallback(
    (to: number) => {
      target.current = clamp(Math.round(to))
      return animate(pos, target.current, { type: 'spring', stiffness: 150, damping: 24, mass: 0.9 })
    },
    [pos, clamp],
  )

  // 进场时从侧面转进来
  useEffect(() => {
    target.current = 0
    pos.set(clamp(Math.min(3, n - 1)))
    const controls = animate(pos, 0, { type: 'spring', stiffness: 60, damping: 18 })
    return () => controls.stop()
  }, [pos, clamp, n])

  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 6) moved.current = true
    const next = pos.get() - info.delta.x / pxPerCard
    // 到头之后还能再拉一点，但有阻力
    const over = loop ? 0 : next < 0 ? next : next > n - 1 ? next - (n - 1) : 0
    pos.set(next - over * 0.65)
  }
  // 松手后按甩动的速度再滑一段，停在最近的一张上
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    void settle(pos.get() - (info.velocity.x * 0.22) / pxPerCard)
    // 松手时浏览器还会补发一次点击，等它过去再恢复点击
    setTimeout(() => (moved.current = false), 60)
  }

  const pick = (v: number) => {
    if (moved.current) return // 刚拖动过，这次不算点击
    if (v === target.current) openDetail(entries[mod(v, n)])
    else void settle(v)
  }

  // 触控板横向滑动、Shift + 滚轮
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    pos.set(clamp(pos.get() + e.deltaX / pxPerCard))
    clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => void settle(pos.get()), 90)
  }
  useEffect(() => () => clearTimeout(wheelTimer.current), [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') void settle(target.current - 1)
    else if (e.key === 'ArrowRight') void settle(target.current + 1)
    else if (e.key === 'Enter') openDetail(entries[mod(center, n)])
    else return
    e.preventDefault()
  }

  const current = entries[mod(center, n)]
  const tier = tierOf(current.tier)
  const glow = posterUrl(current.posterPath, 'w185')

  const slots: number[] = []
  for (let v = center - SIDE - 1; v <= center + SIDE + 1; v++) {
    if (loop || (v >= 0 && v < n)) slots.push(v)
  }

  return (
    <div className="relative -mx-4 overflow-hidden md:-mx-10">
      {/* 背景：把正中那张海报放大并模糊，颜色随之变化 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          maskImage: 'radial-gradient(ellipse 58% 60% at 50% 42%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 58% 60% at 50% 42%, black 20%, transparent 100%)',
        }}
      >
        <AnimatePresence>
          {glow && (
            <motion.img
              key={current.id}
              src={glow}
              alt=""
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.34 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-[90px] saturate-150"
            />
          )}
        </AnimatePresence>
      </div>

      <motion.div
        role="group"
        aria-roledescription="环形展台"
        aria-label={`共 ${n} 部，当前是《${current.title}》。用左右方向键转动，回车查看详情`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPan={onPan}
        onPanEnd={onPanEnd}
        className="relative cursor-grab touch-pan-y overscroll-x-contain pt-8 outline-none select-none active:cursor-grabbing md:pt-10"
        style={{ perspective: 1500, perspectiveOrigin: '50% 32%', height: width * 1.5 + (width > 160 ? 150 : 110) }}
      >
        {/* 这一层自己不接收点击：侧面的海报在它的平面后方，否则会被它挡住点不到 */}
        <div className="pointer-events-none relative h-full" style={{ transformStyle: 'preserve-3d' }}>
          {slots.map((v) => (
            <RingCard key={v} v={v} entry={entries[mod(v, n)]} pos={pos} radius={radius} width={width} onPick={pick} />
          ))}
        </div>
      </motion.div>

      {/* 正中那张的信息 */}
      <div className="relative -mt-6 flex items-center justify-center gap-3 px-4 pb-4 md:-mt-8 md:gap-8">
        <button
          onClick={() => void settle(target.current - 1)}
          disabled={!loop && center <= 0}
          className="btn h-11 w-11 shrink-0 rounded-full px-0"
          aria-label="上一部"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1 text-center md:w-[440px] md:flex-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.button
              key={current.id}
              onClick={() => openDetail(current)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="block w-full"
            >
              <span className="block truncate font-serif text-[24px] leading-tight font-bold md:text-[32px]">
                {current.title}
              </span>
              <span className="mt-2 flex h-7 items-center justify-center gap-3 text-sm">
                {tier && <span style={{ color: tier.color }}>{tier.name}</span>}
                {current.scare > 0 && <Skulls value={current.scare} size={14} />}
                <span className="num text-ash">
                  {[current.year, current.status === 'wishlist' && current.runtime && `${current.runtime} 分钟`]
                    .filter(Boolean)
                    .join('　')}
                </span>
              </span>
            </motion.button>
          </AnimatePresence>
          <p className="num mt-2 text-xs text-dim">
            {String(mod(center, n) + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </p>
        </div>

        <button
          onClick={() => void settle(target.current + 1)}
          disabled={!loop && center >= n - 1}
          className="btn h-11 w-11 shrink-0 rounded-full px-0"
          aria-label="下一部"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
