import { useEffect } from 'react'
import { useLog } from './store'
import { getKey, getMovie } from './tmdb'
import type { MovieLite, Status } from './types'

/** 加入片单，并在后台向 TMDB 补全片长、系列和子类型标签 */
export function addMovie(movie: MovieLite, status: Status) {
  const { add, enrich, entries } = useLog.getState()
  add(movie, status)
  if (!entries[movie.id]?.enriched && getKey()) {
    getMovie(movie.id)
      .then(enrich)
      .catch(() => {
        /* 补全失败不影响使用，下次打开详情时会再试 */
      })
  }
}

/** 弹层打开时：按 Esc 关闭，并锁住背景滚动 */
export function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}
