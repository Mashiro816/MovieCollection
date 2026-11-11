import { ChartColumn, Cloud, CloudOff, Film, Layers, Rows3, Search, Settings } from 'lucide-react'
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
      className={`flex items-center gap-2 text-[13px] hover:text-bone ${status === 'error' ? 'text-flare' : 'text-dim'}`}
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
      className="flex h-11 w-full items-center gap-3 rounded-md border border-line bg-panel px-3.5 text-left text-sm text-ash transition-colors hover:border-ash"
    >
      <Search size={17} className="text-flare" />
      <span className="flex-1">搜索片名，添加电影</span>
      <kbd className="hidden rounded border border-line px-1.5 font-mono text-[11px] text-dim md:inline">/</kbd>
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
      <aside className="sticky top-0 hidden h-dvh w-[208px] shrink-0 flex-col border-r border-line px-5 py-7 md:flex">
        <button onClick={() => go('library')} className="mb-9 flex items-center gap-2.5 text-left">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="font-serif text-xl font-bold tracking-wide">午夜片单</span>
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ view: v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => go(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                view === v ? 'bg-raise text-bone' : 'text-ash hover:text-bone'
              }`}
            >
              {view === v && <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded bg-flare" />}
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <SyncNote />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur md:px-10">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="午夜片单" className="h-8 w-8 md:hidden" />
            <div className="max-w-xl flex-1">
              <SearchTrigger />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-9 md:pb-16">{children}</main>
      </div>

      {/* 手机：底部导航 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-ink/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => go(v)}
            aria-current={view === v ? 'page' : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
              view === v ? 'text-flare' : 'text-ash'
            }`}
          >
            <Icon size={20} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
