import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Images, List, ArrowLeftRight, RotateCcw, Settings, ScrollText, Pin
} from 'lucide-react'
import type { NavTab } from '../../app/App'
import styles from './Sidebar.module.css'

interface NavItem {
  id: NavTab | 'logs'
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { id: 'scrape',   label: 'Poster Scrape',   icon: <Images size={18} /> },
  { id: 'bulk',     label: 'Bulk Import',      icon: <List size={18} /> },
  { id: 'mappings', label: 'Title Mappings',   icon: <ArrowLeftRight size={18} /> },
  { id: 'reset',    label: 'Reset Posters',    icon: <RotateCcw size={18} /> },
]

interface Props {
  activeTab: NavTab
  onNavigate: (tab: NavTab) => void
  onToggleLogs: () => void
}

export default function Sidebar({ activeTab, onNavigate, onToggleLogs }: Props) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const expanded = pinned || hovered

  return (
    <motion.aside
      className={styles.sidebar}
      animate={{ width: expanded ? 220 : 60 }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id as NavTab)}
            title={!expanded ? item.label : undefined}
          >
            {activeTab === item.id && (
              <motion.div className={styles.indicator} layoutId="nav-indicator" transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }} />
            )}
            <span className={styles.icon}>{item.icon}</span>
            <motion.span
              className={styles.label}
              animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }}
              transition={{ duration: 0.15 }}
            >
              {item.label}
            </motion.span>
          </button>
        ))}
      </nav>

      <div className={styles.bottom}>
        <div className={styles.divider} />
        <button
          className={styles.navItem}
          onClick={onToggleLogs}
          title={!expanded ? 'Logs' : undefined}
        >
          <span className={styles.icon}><ScrollText size={18} /></span>
          <motion.span className={styles.label} animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }} transition={{ duration: 0.15 }}>
            Logs
          </motion.span>
        </button>
        <div className={styles.divider} />
        <button
          className={`${styles.navItem} ${activeTab === 'settings' ? styles.active : ''}`}
          onClick={() => onNavigate('settings')}
          title={!expanded ? 'Settings' : undefined}
        >
          {activeTab === 'settings' && (
            <motion.div className={styles.indicator} layoutId="nav-indicator" transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }} />
          )}
          <span className={styles.icon}><Settings size={18} /></span>
          <motion.span className={styles.label} animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }} transition={{ duration: 0.15 }}>
            Settings
          </motion.span>
        </button>
        <button
          className={`${styles.navItem} ${pinned ? styles.pinned : ''}`}
          onClick={() => setPinned(v => !v)}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
        >
          <span className={styles.icon}><Pin size={16} /></span>
          <motion.span className={styles.label} animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }} transition={{ duration: 0.15 }}>
            {pinned ? 'Unpin' : 'Pin'}
          </motion.span>
        </button>
      </div>
    </motion.aside>
  )
}
