import { BaseScraper } from './baseScraper'
import { Logger } from '../services/logger'
import { ConfigService } from '../services/config'
import type { PosterInfo } from '../ipc/types'

// ─── Types matching MediUX __NEXT_DATA__ shape ────────────────────────────────
// MediUX is a Next.js app — all set data lives in the inline __NEXT_DATA__ JSON.

interface MediuxFile {
  id: string
  fileType: 'poster' | 'backdrop' | 'title_card' | string
  title?: string
  season_number?: number | null
  episode_number?: number | null
  show?: { name?: string; title?: string; first_air_date?: string } | null
  movie?: { title?: string; release_date?: string } | null
  // MediUX CDN URL fields — one of these will be present
  poster_path?: string | null
  backdrop_path?: string | null
  file_path?: string | null
  // Direct URL sometimes present
  url?: string | null
}

interface MediuxSet {
  id: number | string
  name?: string
  show?: { name?: string; title?: string } | null
  movie?: { title?: string } | null
  files?: MediuxFile[]
  posters?: MediuxFile[]
}

interface NextData {
  props?: {
    pageProps?: {
      set?: MediuxSet
      data?: MediuxSet
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CDN_BASE = 'https://mediux.pro'

function resolveUrl(file: MediuxFile): string | null {
  // Prefer direct URL fields, fall back to path-based
  if (file.url) return file.url
  const path = file.poster_path ?? file.backdrop_path ?? file.file_path
  if (path) return path.startsWith('http') ? path : `${CDN_BASE}${path}`
  return null
}

function extractYear(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined
  const m = dateStr.match(/^(\d{4})/)
  return m ? parseInt(m[1]) : undefined
}

function fileToInfo(file: MediuxFile, setName?: string): PosterInfo | null {
  const url = resolveUrl(file)
  if (!url) return null

  const title =
    file.title ??
    file.show?.name ?? file.show?.title ??
    file.movie?.title ??
    setName ?? 'Unknown'

  const year = extractYear(
    file.show?.first_air_date ?? file.movie?.release_date
  )

  let season: PosterInfo['season'] | undefined = undefined
  if (file.fileType === 'backdrop') {
    season = 'Backdrop'
  } else if (file.season_number != null) {
    season = file.season_number === 0 ? 'Cover' : file.season_number
  }

  return {
    title,
    url,
    thumbUrl: url,   // MediUX CDN URLs serve as thumbnails directly
    source: 'mediux',
    year,
    season,
    episode: file.episode_number ?? undefined,
  }
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

export class MediuxScraper extends BaseScraper {
  async scrape(url: string): Promise<PosterInfo[]> {
    Logger.scrape('MediUX', `Scraping: ${url}`)

    const { context, page } = await this.newContext()
    try {
      // Wait for the Next.js data script to be present in DOM
      await this.navigate(page, url, 'script#__NEXT_DATA__')

      // Extract the inline JSON — more reliable than evaluating window props
      const nextDataRaw = await page.$eval(
        'script#__NEXT_DATA__',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el: any) => el.textContent ?? '',
      ).catch(() => '')

      if (!nextDataRaw) {
        Logger.warn('MediUX', `No __NEXT_DATA__ found at: ${url}`)
        return []
      }

      const nextData: NextData = JSON.parse(nextDataRaw)
      const set: MediuxSet | undefined =
        nextData.props?.pageProps?.set ??
        nextData.props?.pageProps?.data

      if (!set) {
        Logger.warn('MediUX', `Could not locate set data in __NEXT_DATA__ at: ${url}`)
        return []
      }

      const setName = set.name ?? set.show?.name ?? set.show?.title ?? set.movie?.title ?? ''
      const rawFiles: MediuxFile[] = set.files ?? set.posters ?? []

      // Apply the user's mediuxFilters config
      const cfg = ConfigService.get()
      const allowedTypes = new Set<string>(cfg.mediuxFilters)

      const posters: PosterInfo[] = []
      for (const file of rawFiles) {
        if (this._aborted) break
        // Normalise fileType — the API uses poster/backdrop/title_card
        const ft = file.fileType?.toLowerCase().replace(/[-\s]/g, '_')
        if (!allowedTypes.has(ft as 'poster' | 'backdrop' | 'title_card')) continue

        const info = fileToInfo(file, setName)
        if (info) posters.push(info)
      }

      Logger.scrape('MediUX', `Set "${setName}" — ${posters.length} posters (after filter)`)
      return posters
    } catch (err) {
      Logger.error('MediUX', `Scrape failed: ${err instanceof Error ? err.message : err}`)
      return []
    } finally {
      await context.close()
    }
  }
}
