import styles from './EmptyState.module.css'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

/** Centered empty-state placeholder with icon, title, and optional action. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper} role="status">
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
