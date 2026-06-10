import { motion } from 'framer-motion'
import styles from './Card.module.css'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps {
  children: React.ReactNode
  glow?: boolean
  hoverable?: boolean
  padding?: CardPadding
  className?: string
  onClick?: () => void
  as?: 'div' | 'article' | 'section' | 'li'
}

/** Content card with optional title and actions. */
export default function Card({
  children,
  glow = false,
  hoverable = false,
  padding = 'md',
  className,
  onClick,
  as: Tag = 'div',
}: CardProps) {
  const classes = [
    styles.card,
    styles[`pad-${padding}`],
    hoverable ? styles.hoverable : '',
    glow ? styles.glow : '',
    className,
  ].filter(Boolean).join(' ')

  if (hoverable || onClick) {
    return (
      <motion.div
        className={classes}
        onClick={onClick}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </motion.div>
    )
  }

  return <Tag className={classes}>{children}</Tag>
}
