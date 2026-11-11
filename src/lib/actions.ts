import { useEffect } from 'react'
import { toast } from 'sonner'
import { useLog } from './store'
import { getMovie } from './tmdb'
import type { MovieLite, Status } from './types'

/** 加入片单，并在后台向 TMDB 补全片长、系列和子类型标签 */
export function addMovie(movie: MovieLite, status: Status) {
  const { add, enrich, entries } = useLog.getState()
  add(movie, status)
  if (status === 'wishlist') toast('已加入想看', { description: movie.title })
  if (!entries[movie.id]?.enriched) {
    getMovie(movie.id)
      .then(enrich)
      .catch(() => {
        /* 补全失败不影响使用，下次打开详情时会再试 */
      })
  }
}

// 当前开着几个弹层。用计数而不是"记住之前的状态再还原"：
// 两个弹层交替开关时（比如从搜索结果进详情），后者会把前者留下的锁定状态当成原状还原回去，页面就再也滚不动了。
let openOverlays = 0

/** 弹层打开时：按 Esc 关闭，并锁住背景滚动 */
export function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // 下拉菜单开着时，Esc 只关菜单，不关弹层
      if (e.key === 'Escape' && !document.querySelector('[role="listbox"]')) onClose()
    }
    // 用捕获阶段监听，赶在下拉菜单自己处理 Esc 之前判断它是否开着
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    openOverlays += 1
    document.body.style.overflow = 'hidden'
    return () => {
      openOverlays -= 1
      if (openOverlays === 0) document.body.style.overflow = ''
    }
  }, [open])
}

/** 移出片单，并给一个撤销的机会 */
export function removeMovie(id: number) {
  const { entries, remove, patch } = useLog.getState()
  const title = entries[id]?.title ?? ''
  remove(id)
  toast('已移出片单', {
    description: title,
    action: { label: '撤销', onClick: () => patch(id, { deleted: false }) },
  })
}
