import { useState } from 'react'
import { Link2, FileStack } from 'lucide-react'
import ScrapePage from '../scrape/ScrapePage'
import BulkPage from '../bulk/BulkPage'
import styles from './ManualPage.module.css'

type Mode = 'scrape' | 'bulk'

/** Manual page placeholder. */
export default function ManualPage() {
  const [mode, setMode] = useState<Mode>('scrape')

  return (
    <div className={styles.page}>
      <div className={styles.modeSwitch}>
        <button
          className={`${styles.modeBtn} ${mode === 'scrape' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('scrape')}
        >
          <Link2 size={14} /> Scrape URLs
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'bulk' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('bulk')}
        >
          <FileStack size={14} /> Bulk Files
        </button>
      </div>

      <div className={styles.body}>
        {mode === 'scrape' ? <ScrapePage /> : <BulkPage />}
      </div>
    </div>
  )
}
