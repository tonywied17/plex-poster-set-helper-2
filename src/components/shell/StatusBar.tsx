import { useEffect, useState } from 'react'
import type { NavTab } from '../../app/App'
import styles from './StatusBar.module.css'

interface Props {
  activeTab: NavTab
}

export default function StatusBar({ activeTab: _activeTab }: Props) {
  const [version, setVersion] = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    window.api.auth.getStatus().then(s => setConnected(s.status === 'authorized'))
    const unsub = window.api.auth.onStatusChange(s => setConnected(s.status === 'authorized'))
    return () => { unsub() }
  }, [])

  const dotClass = connected === null ? styles.dotUnknown : connected ? styles.dotOn : styles.dotOff
  const label = connected === null ? 'Connecting…' : connected ? 'Connected to Plex' : 'Not connected'

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={`${styles.dot} ${dotClass}`} />
        <span className={styles.text}>{label}</span>
      </div>
      <div className={styles.right}>
        {version && <span className={styles.text}>v{version}</span>}
      </div>
    </div>
  )
}
