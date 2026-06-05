import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TitleBar from '../components/shell/TitleBar'
import Sidebar from '../components/shell/Sidebar'
import StatusBar from '../components/shell/StatusBar'
import ParticleField from '../components/shell/ParticleField'
import LogDrawer from '../features/logs/LogDrawer'
import ScrapePage from '../features/scrape/ScrapePage'
import BulkPage from '../features/bulk/BulkPage'
import MappingsPage from '../features/mappings/MappingsPage'
import ResetPage from '../features/reset/ResetPage'
import SettingsPage from '../features/settings/SettingsPage'

export type NavTab = 'scrape' | 'bulk' | 'mappings' | 'reset' | 'settings'

const NAV_ORDER: NavTab[] = ['scrape', 'bulk', 'mappings', 'reset', 'settings']

const PAGE_MAP: Record<NavTab, React.ReactNode> = {
  scrape: <ScrapePage />,
  bulk: <BulkPage />,
  mappings: <MappingsPage />,
  reset: <ResetPage />,
  settings: <SettingsPage />,
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('scrape')
  const [prevTab, setPrevTab] = useState<NavTab>('scrape')
  const [logOpen, setLogOpen] = useState(false)

  const direction = NAV_ORDER.indexOf(activeTab) > NAV_ORDER.indexOf(prevTab) ? 1 : -1

  function navigate(tab: NavTab) {
    setPrevTab(activeTab)
    setActiveTab(tab)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-base)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ParticleField />

      <TitleBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <Sidebar activeTab={activeTab} onNavigate={navigate} onToggleLogs={() => setLogOpen(v => !v)} />

        <main
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%', overflow: 'auto', padding: 'var(--content-padding)' }}
            >
              {PAGE_MAP[activeTab]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <LogDrawer open={logOpen} onClose={() => setLogOpen(false)} />

      <StatusBar activeTab={activeTab} />
    </div>
  )
}
