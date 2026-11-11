import { ChartColumn, Cloud, CloudOff, Film, Layers, Rows3, Search, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { useUi, type View } from '../lib/store'
import { cloudEnabled, useSync } from '../lib/sync'

const NAV: { view: View; label: string; icon: typeof Film }[] = [
  { view: 'library', label: '片单', icon: Film },
  { view: 'tiers', label: '评级墙', icon: Rows3 },
  { view: 'series', label: '系列', icon: Layers },
  { view: 'stats', label: '统计', icon: ChartColumn },
  { view: 'settings', label: '设置', icon: Settings },
]

function SyncNote() {
  const { session, status } = useSync()
  const go = useUi((s) => s.go)
  let text = '仅保存在本机'
  if (cloudEnabled) {
    if (!session) text = '未登录，仅本机'
    else if (status === 'syncing') text = '同步中'
    else if (status === 'error') text = '同步失败'
    else text = '已同步'
  }
  const Icon = cloudEnabled && session && status !== 'error' ? Cloud : CloudOff
  return (
    <button
      onClick={() => go('settings')}
      className={`flex items-center gap-2 text-[13px] transition-colors hover:text-bone ${status === 'error' ? 'text-flare' : 'text-dim'}`}
    >
      <Icon size={15} />
      {text}
    </button>
  )
}

function SearchTrigger() {
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  return (
    <button
      onClick={() => setSearchOpen(true)}
      className="glass flex h-11 w-full items-center gap-3 rounded-full border px-4 text-left text-sm text-ash transition duration-200 hover:border-white/20 hover:text-bone"
    >
      <Search size={17} className="text-flare" />
      <span className="flex-1">搜索片名，添加电影</span>
      <kbd className="hidden rounded-md border border-white/10 px-1.5 font-mono text-[11px] text-dim md:inline">/</kbd>
    </button>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { view, go, setSearchOpen } = useUi()

  // 按 "/" 打开搜索（正在输入时不触发）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== '/' || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      e.preventDefault()
      setSearchOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  return (
    <div className="flex min-h-dvh">
      {/* 电脑：左侧导航 */}
      <aside className="sticky top-0 z-20 hidden h-dvh w-[216px] shrink-0 flex-col border-r border-white/[0.06] bg-ink px-4 py-7 md:flex">
        <button onClick={() => go('library')} className="mb-10 flex items-center gap-2.5 px-2 text-left">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-serif text-[21px] font-bold tracking-wide">午夜时光</span>
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ view: v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => go(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm transition-colors duration-200 ${
                view === v ? 'text-bone' : 'text-ash hover:text-bone'
              }`}
            >
              {view === v && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-white/[0.07] bg-white/[0.06]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <Icon size={18} strokeWidth={1.75} className={`relative ${view === v ? 'text-flare' : ''}`} />
              <span className="relative">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <SyncNote />
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px]"
          style={{ background: 'radial-gradient(75% 100% at 28% 0%, rgb(200 16 46 / 0.16), transparent 72%)' }}
        />
        {/* 顶栏浮在内容上方，首页的大图会从它下面透出来 */}
        <header className="sticky top-0 z-20 bg-gradient-to-b from-ink via-ink/75 to-transparent px-4 pt-3 pb-5 md:px-10">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="午夜时光" className="h-9 w-9 md:hidden" />
            <div className="max-w-xl flex-1">
              <SearchTrigger />
            </div>
          </div>
        </header>
        <main className="relative flex-1 px-4 pt-2 pb-32 md:px-10 md:pt-4 md:pb-20">{children}</main>
      </div>

      {/* 手机：底部悬浮导航 */}
      <nav
        className="glass fixed inset-x-3 z-20 grid grid-cols-5 rounded-2xl border shadow-float md:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => go(v)}
            aria-current={view === v ? 'page' : undefined}
            className={`relative flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors duration-200 ${
              view === v ? 'text-bone' : 'text-ash'
            }`}
          >
            {view === v && (
              <motion.span
                layoutId="tab-active"
                className="absolute inset-1.5 rounded-xl bg-white/[0.07]"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <Icon size={20} strokeWidth={1.75} className={`relative ${view === v ? 'text-flare' : ''}`} />
            <span className="relative">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
