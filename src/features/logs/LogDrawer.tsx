import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
}

export default function LogDrawer({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 300, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
          style={{
            background: 'var(--color-bg-surface)',
            borderTop: '1px solid var(--color-border)',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
            zIndex: 20,
          }}
        >
          <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
              Application Logs
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
              Close
            </button>
          </div>
          <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
            Log viewer — Phase 10
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
