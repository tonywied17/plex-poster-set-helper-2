import { motion } from 'framer-motion'
import styles from './ProgressBar.module.css'

type ProgressVariant = 'default' | 'success' | 'error' | 'segmented' | 'indeterminate'

interface ProgressBarProps {
  value?: number
  max?: number
  variant?: ProgressVariant
  segments?: number
  activeSegments?: number
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
}

/** Horizontal progress bar. */
export default function ProgressBar({
  value = 0,
  max = 100,
  variant = 'default',
  segments = 4,
  activeSegments = 0,
  label,
  showPercent = false,
  size = 'md',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  if (variant === 'segmented') {
    return (
      <div className={styles.wrapper}>
        {label && <span className={styles.label}>{label}</span>}
        <div className={[styles.segmented, styles[size]].join(' ')} role="progressbar" aria-valuenow={activeSegments} aria-valuemax={segments}>
          {Array.from({ length: segments }).map((_, i) => (
            <motion.div
              key={i}
              className={[styles.segment, i < activeSegments ? styles.segmentActive : ''].join(' ')}
              initial={false}
              animate={{ opacity: i < activeSegments ? 1 : 0.25 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'indeterminate') {
    return (
      <div className={styles.wrapper}>
        {label && <span className={styles.label}>{label}</span>}
        <div className={[styles.track, styles[size]].join(' ')}>
          <div className={styles.indeterminate} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {(label || showPercent) && (
        <div className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.percent}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className={[styles.track, styles[size]].join(' ')}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemax={max}
      >
        <motion.div
          className={[styles.fill, styles[variant]].join(' ')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}
