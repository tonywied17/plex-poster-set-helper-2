import { useState } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical, X, ChevronDown, ChevronUp,
  Upload, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import Badge from '../../../components/ui/Badge'
import Spinner from '../../../components/ui/Spinner'
import Button from '../../../components/ui/Button'
import { useScrapeStore } from '../useScrapeStore'
import type { QueueEntry, PosterResult } from '../useScrapeStore'
import styles from './UrlQueueEntry.module.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entry: QueueEntry
  isRunning: boolean
  patchPoster: (entryId: string, posterUrl: string, patch: Partial<PosterResult>) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sourceFromUrl(url: string): 'posterdb' | 'mediux' | null {
  if (/theposterdb\.com/i.test(url)) return 'posterdb'
  if (/mediux\.pro/i.test(url)) return 'mediux'
  return null
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + u.pathname
  } catch {
    return url
  }
}

function posterLabel(p: PosterResult): string {
  if (p.season === 'Backdrop') return `${p.title} — Backdrop`
  if (p.season === 'Cover')    return `${p.title} — Cover`
  if (typeof p.season === 'number') return `${p.title} S${p.season}`
  if (p.episode != null)       return `${p.title} E${p.episode}`
  return p.title + (p.year ? ` (${p.year})` : '')
}

// ─── Upload a single poster via Plex IPC ──────────────────────────────────────

async function uploadPoster(
  entryId: string,
  poster: PosterResult,
  patchPoster: Props['patchPoster'],
) {
  patchPoster(entryId, poster.url, { uploadStatus: 'matching' })
  try {
    const item = await window.api.plex.findItem(poster.title, poster.year)
    if (!item) {
      patchPoster(entryId, poster.url, { uploadStatus: 'no_match' })
      return
    }
    patchPoster(entryId, poster.url, { uploadStatus: 'uploading' })
    const res = await window.api.plex.uploadPoster(item.key, poster.url, poster.source)
    patchPoster(entryId, poster.url, {
      uploadStatus: res.success ? 'done' : 'error',
      uploadError: res.success ? undefined : res.error,
    })
  } catch (err) {
    patchPoster(entryId, poster.url, {
      uploadStatus: 'error',
      uploadError: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── Poster thumbnail ─────────────────────────────────────────────────────────

function PosterThumb({
  poster,
  entryId,
  patchPoster,
}: {
  poster: PosterResult
  entryId: string
  patchPoster: Props['patchPoster']
}) {
  const [imgError, setImgError] = useState(false)
  const us = poster.uploadStatus

  const overlayIcon =
    us === 'matching' || us === 'uploading' ? <Loader2 size={14} className={styles.spin} /> :
    us === 'done'     ? <CheckCircle2 size={14} /> :
    us === 'error'    ? <AlertCircle size={14} /> :
    us === 'no_match' ? <AlertCircle size={14} /> :
    null

  const overlayClass =
    us === 'done'     ? styles.overlayDone :
    us === 'error' || us === 'no_match' ? styles.overlayError :
    us === 'matching' || us === 'uploading' ? styles.overlayPending :
    ''

  return (
    <motion.div
      className={styles.thumb}
      title={posterLabel(poster)}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.12 }}
      onClick={() => {
        if (us === 'idle' || us === 'error' || us === 'no_match') {
          uploadPoster(entryId, poster, patchPoster)
        }
      }}
    >
      {!imgError && poster.thumbUrl ? (
        <img
          src={poster.thumbUrl}
          alt={posterLabel(poster)}
          className={styles.thumbImg}
          onError={() => setImgError(true)}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className={styles.thumbFallback}>
          <span className={styles.thumbInitial}>
            {poster.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* upload status overlay */}
      {overlayIcon && (
        <div className={[styles.overlay, overlayClass].filter(Boolean).join(' ')}>
          {overlayIcon}
        </div>
      )}

      {/* idle hover hint */}
      {us === 'idle' && (
        <div className={styles.overlayHover}>
          <Upload size={12} />
        </div>
      )}
    </motion.div>
  )
}

// ─── Main entry card ──────────────────────────────────────────────────────────

export default function UrlQueueEntry({ entry, isRunning, patchPoster }: Props) {
  const [expanded, setExpanded] = useState(false)
  const removeEntry = useScrapeStore(s => s.removeEntry)

  const source = entry.posters[0]?.source ?? sourceFromUrl(entry.url) ?? 'posterdb'

  const posterCount = entry.posters.length
  const doneCount   = entry.posters.filter(p => p.uploadStatus === 'done').length
  const errorCount  = entry.posters.filter(p =>
    p.uploadStatus === 'error' || p.uploadStatus === 'no_match'
  ).length

  const hasDone    = doneCount > 0
  const hasErrors  = errorCount > 0
  const allDone    = posterCount > 0 && doneCount === posterCount

  async function uploadAll() {
    for (const p of entry.posters) {
      if (p.uploadStatus === 'idle' || p.uploadStatus === 'no_match' || p.uploadStatus === 'error') {
        await uploadPoster(entry.id, p, patchPoster)
      }
    }
  }

  return (
    <Reorder.Item
      value={entry}
      className={styles.item}
      as="li"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      {/* ── Row ──────────────────────────────────────────────────────────── */}
      <div className={styles.row}>

        {/* drag handle */}
        <div className={styles.dragHandle} title="Drag to reorder">
          <GripVertical size={14} />
        </div>

        {/* source badge */}
        <Badge variant={source} className={styles.sourceBadge}>
          {source === 'posterdb' ? 'PDB' : 'MX'}
        </Badge>

        {/* URL */}
        <div className={styles.urlText} title={entry.url}>
          {shortUrl(entry.url)}
        </div>

        {/* status */}
        <div className={styles.statusArea}>
          {entry.status === 'scraping' && (
            <span className={styles.statusScraping}>
              <Spinner size="xs" />
              <span>Scraping…</span>
            </span>
          )}
          {entry.status === 'done' && posterCount > 0 && (
            <span className={styles.statusDone}>
              {posterCount} poster{posterCount !== 1 ? 's' : ''}
              {hasDone && ` · ${doneCount} uploaded`}
              {hasErrors && <span className={styles.errBit}> · {errorCount} failed</span>}
            </span>
          )}
          {entry.status === 'done' && posterCount === 0 && (
            <span className={styles.statusMuted}>No posters found</span>
          )}
          {entry.status === 'error' && (
            <span className={styles.statusError} title={entry.error}>
              <AlertCircle size={12} />
              {entry.error ? entry.error.slice(0, 60) : 'Scrape failed'}
            </span>
          )}
          {entry.status === 'idle' && (
            <span className={styles.statusMuted}>Waiting</span>
          )}
        </div>

        {/* actions */}
        <div className={styles.rowActions}>
          {entry.status === 'done' && posterCount > 0 && !allDone && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload size={12} />}
              onClick={uploadAll}
              disabled={isRunning}
              className={styles.uploadAllBtn}
            >
              Upload All
            </Button>
          )}
          {entry.status === 'done' && posterCount > 0 && (
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded(v => !v)}
              title={expanded ? 'Collapse posters' : 'Show posters'}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {!isRunning && (
            <button
              className={styles.removeBtn}
              onClick={() => removeEntry(entry.id)}
              title="Remove"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Poster grid (expanded) ────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && entry.posters.length > 0 && (
          <motion.div
            className={styles.posterSection}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className={styles.posterGrid}>
              {entry.posters.map(p => (
                <PosterThumb
                  key={p.url}
                  poster={p}
                  entryId={entry.id}
                  patchPoster={patchPoster}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  )
}
