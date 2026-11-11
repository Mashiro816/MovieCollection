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
    <>
      <Shell>
        <Page />
      </Shell>
      <DetailSheet />
      <SearchDialog />
      <TonightDialog />
    </>
  )
}
