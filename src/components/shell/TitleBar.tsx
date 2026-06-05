import styles from './TitleBar.module.css'

export default function TitleBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.drag}>
        <span className={styles.appName}>Plex Poster Set Helper</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={() => window.api.window.minimize()} aria-label="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button className={styles.btn} onClick={() => window.api.window.maximize()} aria-label="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" /></svg>
        </button>
        <button className={`${styles.btn} ${styles.close}`} onClick={() => window.api.window.close()} aria-label="Close">
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" /><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  )
}
