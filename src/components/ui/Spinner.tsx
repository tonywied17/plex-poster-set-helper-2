import styles from './Spinner.module.css'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  color?: 'accent' | 'current' | 'muted'
}

const SIZE_PX: Record<SpinnerSize, number> = { xs: 12, sm: 16, md: 20, lg: 28 }

/** Loading spinner. */
export default function Spinner({ size = 'md', color = 'accent' }: SpinnerProps) {
  const px = SIZE_PX[size]
  return (
    <svg
      className={[styles.spinner, styles[color]].join(' ')}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
      role="status"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42" strokeDashoffset="12" />
    </svg>
  )
}
