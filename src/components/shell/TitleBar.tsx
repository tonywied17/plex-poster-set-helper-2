import styles from './TitleBar.module.css'

// Poster-set mark - matches the app/tray icon (resources/tray.svg)
function PlexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ppsh-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9c449" />
          <stop offset="0.5" stopColor="#e5a00d" />
          <stop offset="1" stopColor="#bd860f" />
        </linearGradient>
      </defs>
      <rect x="12" y="4" width="40" height="56" rx="7" fill="#c3cadb" transform="rotate(-16 32 54)" />
      <rect x="12" y="4" width="40" height="56" rx="7" fill="#79829b" transform="rotate(13 32 54)" />
      <rect x="12" y="4" width="40" height="56" rx="7" fill="url(#ppsh-amber)" />
      <path d="M 26.4 24.6 L 40 32 L 26.4 39.4 Z" fill="#11141c" stroke="#11141c" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  )
}

/** Frameless-window title bar with window controls. */
export default function TitleBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.drag}>
        <div className={styles.brand}>
          <PlexIcon />
          <span className={styles.appName}>Plex Poster Set Helper</span>
        </div>
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
