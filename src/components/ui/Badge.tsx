import styles from './Badge.module.css'

export type BadgeVariant =
  | 'default'
  | 'mediux'
  | 'posterdb'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'movie'
  | 'show'
  | 'collection'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

/** Small status badge with optional dot. */
export default function Badge({ variant = 'default', children, dot, className }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant], className].filter(Boolean).join(' ')}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  )
}
