import { useId } from 'react'
import { motion } from 'framer-motion'
import styles from './Switch.module.css'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

/** Toggle switch with optional label and description. */
export default function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId()

  return (
    <label htmlFor={id} className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}>
      <div className={styles.text}>
        {label && <span className={styles.label}>{label}</span>}
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={[styles.track, checked ? styles.on : ''].join(' ')}>
        <motion.div
          className={styles.thumb}
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className={styles.input}
          aria-checked={checked}
        />
      </div>
    </label>
  )
}
