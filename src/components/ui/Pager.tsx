import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './Pager.module.css'

/**
 * Builds the page tokens for the pager: first and last page always show, a
 * small window around the current page, and 'gap' ellipses fill the rest.
 */
function pagerTokens(page: number, pageCount: number): (number | 'gap')[] {
  const out: (number | 'gap')[] = []
  const last = pageCount - 1
  const from = Math.max(1, page - 1)
  const to = Math.min(last - 1, page + 1)
  out.push(0)
  if (from > 1) out.push('gap')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < last - 1) out.push('gap')
  if (last > 0) out.push(last)
  return out
}

/**
 * Numbered pager (0-based `page`) with prev/next and ellipsis for many pages.
 * Renders nothing for a single page.
 *
 * @param page - Current 0-based page index.
 * @param pageCount - Total number of pages.
 * @param onPage - Called with the next 0-based page index.
 */
export default function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null
  return (
    <div className={styles.pager}>
      <button className={styles.pagerBtn} onClick={() => onPage(page - 1)} disabled={page <= 0} aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      {pagerTokens(page, pageCount).map((t, i) =>
        t === 'gap'
          ? <span key={`gap-${i}`} className={styles.pagerGap}>…</span>
          : <button
              key={t}
              className={`${styles.pagerBtn} ${t === page ? styles.pagerBtnActive : ''}`}
              onClick={() => onPage(t)}
              aria-current={t === page ? 'page' : undefined}
            >
              {t + 1}
            </button>,
      )}
      <button className={styles.pagerBtn} onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
