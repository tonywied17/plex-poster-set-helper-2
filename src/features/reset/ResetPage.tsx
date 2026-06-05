import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  RotateCcw, RefreshCw, Film, Tv2, AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import type { PlexItem } from '../../../electron/ipc/types'
import styles from './ResetPage.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'mediux' | 'posterdb'
type TypeFilter   = 'all' | 'movie' | 'show'
type ItemStatus   = 'idle' | 'resetting' | 'done' | 'error'

interface TrackedItem extends PlexItem {
  source: 'mediux' | 'posterdb'
  resetStatus: ItemStatus
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statVal}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResetPage() {
  const [items, setItems]           = useState<TrackedItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [stats, setStats]           = useState<Record<string, number>>({})
  const [sourceFilter, setSource]   = useState<SourceFilter>('all')
  const [typeFilter, setType]       = useState<TypeFilter>('all')
  const [search, setSearch]         = useState('')
  const [confirmAll, setConfirmAll] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, mediuxRes, posterdbRes] = await Promise.all([
        window.api.plex.getStats() as Promise<Record<string, number>>,
        window.api.plex.getLabeledItems('MediUX') as Promise<PlexItem[]>,
        window.api.plex.getLabeledItems('ThePosterDB') as Promise<PlexItem[]>,
      ])
      setStats(statsRes)

      const combined: TrackedItem[] = [
        ...mediuxRes.map(i => ({ ...i, source: 'mediux' as const, resetStatus: 'idle' as const })),
        ...posterdbRes.map(i => ({ ...i, source: 'posterdb' as const, resetStatus: 'idle' as const })),
      ]
      // deduplicate by key
      const seen = new Set<string>()
      setItems(combined.filter(i => {
        if (seen.has(i.key)) return false
        seen.add(i.key)
        return true
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Reset single ───────────────────────────────────────────────────────────

  async function resetOne(key: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, resetStatus: 'resetting' } : i))
    try {
      await window.api.plex.resetPoster(key, true)
      setItems(prev => prev.map(i => i.key === key ? { ...i, resetStatus: 'done' } : i))
    } catch {
      setItems(prev => prev.map(i => i.key === key ? { ...i, resetStatus: 'error' } : i))
    }
  }

  // ── Reset all ──────────────────────────────────────────────────────────────

  async function resetAll() {
    setConfirmAll(false)
    setResettingAll(true)
    for (const item of filtered) {
      if (item.resetStatus === 'done') continue
      await resetOne(item.key)
    }
    setResettingAll(false)
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = items.filter(i => {
    if (sourceFilter !== 'all' && i.source !== sourceFilter) return false
    if (typeFilter   !== 'all' && i.type   !== typeFilter)   return false
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const doneCount = filtered.filter(i => i.resetStatus === 'done').length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className="page-title">Reset Posters</h1>
          <p className="page-subtitle">
            View and remove custom posters applied by this tool. Resets the item to its original Plex artwork.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            icon={loading ? <Spinner size="xs" color="current" /> : <RefreshCw size={13} />}
            onClick={load}
            disabled={loading}
          >
            Refresh
          </Button>
          {filtered.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              icon={<RotateCcw size={13} />}
              onClick={() => setConfirmAll(true)}
              disabled={resettingAll || filtered.every(i => i.resetStatus === 'done')}
            >
              Reset All ({filtered.length})
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div className={styles.statsRow}>
          <StatCard label="Total" value={stats.total ?? items.length} />
          <StatCard label="MediUX" value={stats.mediux ?? 0} />
          <StatCard label="PosterDB" value={stats.posterdb ?? 0} />
          <StatCard label="Movies" value={stats.movies ?? 0} />
          <StatCard label="Shows" value={stats.shows ?? 0} />
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title…"
          />
          <div className={styles.filterGroup}>
            {(['all', 'mediux', 'posterdb'] as SourceFilter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${sourceFilter === f ? styles.filterActive : ''}`}
                onClick={() => setSource(f)}
              >
                {f === 'all' ? 'All Sources' : f === 'mediux' ? 'MediUX' : 'PosterDB'}
              </button>
            ))}
          </div>
          <div className={styles.filterGroup}>
            {(['all', 'movie', 'show'] as TypeFilter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${typeFilter === f ? styles.filterActive : ''}`}
                onClick={() => setType(f)}
              >
                {f === 'all' ? 'All Types' : f === 'movie' ? 'Movies' : 'Shows'}
              </button>
            ))}
          </div>
          {doneCount > 0 && (
            <span className={styles.doneCount}>{doneCount} reset</span>
          )}
        </div>
      )}

      {/* ── Item list ──────────────────────────────────────────────────────── */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.loadingCenter}>
            <Spinner size="md" />
            <span className={styles.loadingText}>Loading labeled items…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title={items.length === 0 ? 'No custom posters found' : 'No results'}
            description={
              items.length === 0
                ? 'No Plex items are labeled with MediUX or ThePosterDB tags yet.'
                : 'Try adjusting your filters or search.'
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(item => (
              <motion.div
                key={item.key}
                className={`${styles.itemRow} ${item.resetStatus === 'done' ? styles.itemDone : ''}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                layout
              >
                {/* thumb */}
                <div className={styles.thumb}>
                  {item.thumb ? (
                    <img
                      src={`${window.api.plex ? '' : ''}${item.thumb}`}
                      alt={item.title}
                      className={styles.thumbImg}
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className={styles.thumbFallback}>
                      {item.type === 'movie' ? <Film size={14} /> : <Tv2 size={14} />}
                    </div>
                  )}
                </div>

                {/* info */}
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <div className={styles.itemMeta}>
                    {item.year && <span className={styles.itemYear}>{item.year}</span>}
                    <Badge variant={item.source}>{item.source === 'mediux' ? 'MediUX' : 'PosterDB'}</Badge>
                    <Badge variant={item.type === 'movie' ? 'movie' : 'show'}>
                      {item.type === 'movie' ? 'Movie' : 'Show'}
                    </Badge>
                    <span className={styles.libraryName}>{item.libraryTitle}</span>
                  </div>
                </div>

                {/* action */}
                <div className={styles.itemAction}>
                  {item.resetStatus === 'resetting' && <Spinner size="xs" />}
                  {item.resetStatus === 'done' && (
                    <span className={styles.doneLabel}>
                      <CheckCircle2 size={13} /> Reset
                    </span>
                  )}
                  {item.resetStatus === 'error' && (
                    <span className={styles.errorLabel}>
                      <AlertTriangle size={13} /> Failed
                    </span>
                  )}
                  {(item.resetStatus === 'idle' || item.resetStatus === 'error') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw size={12} />}
                      onClick={() => resetOne(item.key)}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Confirm all modal ───────────────────────────────────────────────── */}
      <Modal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Reset All Posters?"
        size="sm"
      >
        <p className={styles.confirmText}>
          This will reset <strong>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</strong> to
          their original Plex artwork and remove MediUX / ThePosterDB labels. This cannot be undone.
        </p>
        <div className={styles.confirmActions}>
          <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" icon={<RotateCcw size={13} />} onClick={resetAll}>
            Reset All
          </Button>
        </div>
      </Modal>
    </div>
  )
}
