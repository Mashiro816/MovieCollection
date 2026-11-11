import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Toaster } from 'sonner'
import { DetailSheet } from './components/DetailSheet'
import { Library } from './components/Library'
import { SearchDialog } from './components/SearchDialog'
import { Series } from './components/Series'
import { Settings } from './components/Settings'
import { Shell } from './components/Shell'
import { Stats } from './components/Stats'
import { TierWall } from './components/TierWall'
import { TonightDialog } from './components/TonightDialog'
import { useUi } from './lib/store'

const VIEWS = {
  library: Library,
  tiers: TierWall,
  series: Series,
  stats: Stats,
  settings: Settings,
}

export default function App() {
  const view = useUi((s) => s.view)
  const Page = VIEWS[view]
  return (
    // reducedMotion="user"：系统开了"减少动态效果"时，位移和缩放动画自动关闭
    <MotionConfig reducedMotion="user">
      <Shell>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </Shell>
      <DetailSheet />
      <SearchDialog />
      <TonightDialog />
      <Toaster
        theme="dark"
        position="bottom-center"
        offset={{ bottom: 96 }}
        mobileOffset={{ bottom: 96 }}
        toastOptions={{
          style: {
            background: 'rgb(27 24 32 / 0.92)',
            border: '1px solid rgb(255 255 255 / 0.1)',
            color: '#efe9e3',
            borderRadius: '14px',
            backdropFilter: 'blur(16px)',
          },
        }}
      />
    </MotionConfig>
  )
}
