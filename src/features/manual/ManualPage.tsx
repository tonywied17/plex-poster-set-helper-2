import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, FileStack } from 'lucide-react'
import ScrapePage from '../scrape/ScrapePage'
import BulkPage from '../bulk/BulkPage'
import styles from './ManualPage.module.css'

type Mode = 'scrape' | 'bulk'

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  scrape: {
    title: 'Poster Scrape',
    subtitle: 'Paste PosterDB set / poster / user links or MediUX set & boxset links, one per line.',
  },
  bulk: {
    title: 'Bulk Import',
    subtitle: 'Save reusable URL lists and run a whole list against your library in one click.',
  },
}

const TABS: Array<{ id: Mode; label: string; icon: React.ReactNode }> = [
  { id: 'scrape', label: 'Scrape URLs', icon: <Link2 size={14} /> },
  { id: 'bulk',   label: 'Bulk Files',  icon: <FileStack size={14} /> },
]

/** Manual import: scrape pasted URLs on the fly, or run saved bulk URL lists. */
export default function ManualPage() {
  const [mode, setMode] = useState<Mode>('scrape')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className="page-title">{COPY[mode].title}</h1>
          <p className="page-subtitle">{COPY[mode].subtitle}</p>
        </div>

        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tabBarBtn} ${mode === t.id ? styles.tabBarBtnActive : ''}`}
              onClick={() => setMode(t.id)}
            >
              {mode === t.id && (
                <motion.span
                  className={styles.tabBarIndicator}
                  layoutId="manualTabIndicator"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {mode === 'scrape' ? <ScrapePage /> : <BulkPage />}
      </div>
    </div>
  )
}
