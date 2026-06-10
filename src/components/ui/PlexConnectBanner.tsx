import { PlugZap, ArrowRight } from 'lucide-react'
import { useAppContext } from '../../app/AppContext'
import styles from './PlexConnectBanner.module.css'

/** Banner prompting the user to connect Plex in Settings. */
export default function PlexConnectBanner() {
  const { navigate } = useAppContext()

  return (
    <div className={styles.banner}>
      <span className={styles.icon}><PlugZap size={15} /></span>
      <div className={styles.body}>
        <span className={styles.heading}>Plex isn't connected</span>
        <span className={styles.sub}>Connect your Plex server in Settings to unlock uploads, resets, and library matching.</span>
      </div>
      <button className={styles.cta} onClick={() => navigate('settings')}>
        Go to Settings
        <ArrowRight size={13} />
      </button>
    </div>
  )
}
