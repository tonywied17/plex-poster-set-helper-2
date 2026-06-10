import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import styles from './Tooltip.module.css'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: React.ReactNode
  side?: TooltipSide
  delay?: number
  maxWidth?: number
  children: React.ReactElement
}

interface Pos { top: number; left: number }

/** Hover tooltip positioned around its trigger. */
export default function Tooltip({
  content,
  side = 'top',
  delay = 400,
  maxWidth = 240,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const GAP = 8

  const calcPos = useCallback((): Pos => {
    if (!triggerRef.current) return { top: 0, left: 0 }
    const r = triggerRef.current.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    switch (side) {
      case 'bottom': return { top: r.bottom + scrollY + GAP, left: r.left + scrollX + r.width / 2 }
      case 'left':   return { top: r.top + scrollY + r.height / 2, left: r.left + scrollX - GAP }
      case 'right':  return { top: r.top + scrollY + r.height / 2, left: r.right + scrollX + GAP }
      default:       return { top: r.top + scrollY - GAP, left: r.left + scrollX + r.width / 2 }
    }
  }, [side])

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setPos(calcPos())
      setVisible(true)
    }, delay)
  }, [calcPos, delay])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const transforms: Record<TooltipSide, string> = {
    top:    'translateX(-50%) translateY(-100%)',
    bottom: 'translateX(-50%)',
    left:   'translateX(-100%) translateY(-50%)',
    right:  'translateY(-50%)',
  }

  const initial: Record<TooltipSide, { opacity: number; x?: number; y?: number }> = {
    top:    { opacity: 0, y: 4 },
    bottom: { opacity: 0, y: -4 },
    left:   { opacity: 0, x: 4 },
    right:  { opacity: 0, x: -4 },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const child = children as React.ReactElement<any>

  return (
    <>
      {React.cloneElement(child, {
        ref: triggerRef,
        onMouseEnter: (e: React.MouseEvent) => { show(); child.props.onMouseEnter?.(e) },
        onMouseLeave: (e: React.MouseEvent) => { hide(); child.props.onMouseLeave?.(e) },
        onFocus:      (e: React.FocusEvent) => { show(); child.props.onFocus?.(e) },
        onBlur:       (e: React.FocusEvent) => { hide(); child.props.onBlur?.(e) },
      })}

      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              className={`${styles.tooltip} ${styles[side]}`}
              style={{ top: pos.top, left: pos.left, transform: transforms[side], maxWidth }}
              initial={initial[side]}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              role="tooltip"
            >
              {content}
              <span className={styles.arrow} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

import React from 'react'
