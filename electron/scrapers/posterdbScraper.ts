import * as cheerio from 'cheerio'
import { BaseScraper, sleepConfig } from './baseScraper'
import { Logger } from '../services/logger'
import type { PosterInfo } from '../ipc/types'

// ─── URL helpers ──────────────────────────────────────────────────────────────

const BASE = 'https://theposterdb.com'

export function posterdbUrlType(url: string): 'set' | 'poster' | 'user' | 'unknown' {
  if (/theposterdb\.com\/set\/\d+/.test(url)) return 'set'
  if (/theposterdb\.com\/poster\/\d+/.test(url)) return 'poster'
  if (/theposterdb\.com\/user\//.test(url)) return 'user'
  return 'unknown'
}

function posterDownloadUrl(posterId: string): string {
  // PosterDB serves original-quality files via this endpoint
  return `${BASE}/api/media/${posterId}/download`
}

// ─── Metadata parsing ─────────────────────────────────────────────────────────

interface RawCard {
  posterId: string
  thumbUrl: string
  title: string
  mediaType: string
  year?: number
  season?: number | 'Cover' | 'Backdrop'
}

function parseYear(text: string): number | undefined {
  const m = text.match(/\((\d{4})\)/)
  return m ? parseInt(m[1]) : undefined
}

function parseSeason(text: string): number | 'Cover' | 'Backdrop' | undefined {
  if (/backdrop/i.test(text)) return 'Backdrop'
  if (/cover/i.test(text) || /season 0/i.test(text)) return 'Cover'
  const m = text.match(/season\s+(\d+)/i)
  return m ? parseInt(m[1]) : undefined
}

function parseCards($: cheerio.CheerioAPI): RawCard[] {
  const cards: RawCard[] = []

  // Cards are rendered as Bootstrap .card elements; poster links contain the ID
  $('div.card, .overlay-container').each((_, el) => {
    const $el = $(el)

    // Poster ID from the anchor link e.g. /poster/12345
    const href = $el.find('a[href*="/poster/"]').first().attr('href') ?? ''
    const posterIdMatch = href.match(/\/poster\/(\d+)/)
    if (!posterIdMatch) return
    const posterId = posterIdMatch[1]

    // Thumbnail URL — the img src already shown in the card grid
    const imgEl = $el.find('img').first()
    const rawThumb = imgEl.attr('src') ?? imgEl.attr('data-src') ?? imgEl.attr('data-lazy-src') ?? ''
    const thumbUrl = rawThumb.startsWith('http') ? rawThumb : rawThumb ? `${BASE}${rawThumb}` : ''

    // Title text — PosterDB puts it in an overlay paragraph or card-title
    const titleEl = $el.find('[class*="title"], .card-title, .fs-6, .fw-bold').first()
    const rawTitle = titleEl.text().trim() ||
      $el.find('p').first().text().trim() ||
      ($el.find('img').attr('alt') ?? '')

    const title = rawTitle.replace(/\s*\(\d{4}\)\s*/, '').trim()
    const year = parseYear(rawTitle)
    const season = parseSeason(rawTitle)

    // Media type from a badge/label element
    const mediaTypeEl = $el.find('[class*="type"], [class*="badge"], small').first()
    const mediaType = mediaTypeEl.text().trim() || 'Movie'

    if (title) {
      cards.push({ posterId, thumbUrl, title, mediaType, year, season })
    }
  })

  return cards
}

function cardsToPosters(cards: RawCard[]): PosterInfo[] {
  return cards.map(c => ({
    title: c.title,
    url: posterDownloadUrl(c.posterId),
    thumbUrl: c.thumbUrl || posterDownloadUrl(c.posterId),
    source: 'posterdb' as const,
    year: c.year,
    season: c.season,
  }))
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

export class PosterdbScraper extends BaseScraper {
  async scrape(url: string): Promise<PosterInfo[]> {
    const type = posterdbUrlType(url)
    Logger.scrape('PosterDB', `Scraping ${type}: ${url}`)

    switch (type) {
      case 'set':    return this.scrapeSet(url)
      case 'poster': return this.scrapeSinglePoster(url)
      case 'user':   return this.scrapeUserUploads(url)
      default:
        Logger.warn('PosterDB', `Unrecognised URL pattern: ${url}`)
        return []
    }
  }

  // ── Set page ──────────────────────────────────────────────────────────────

  async scrapeSet(url: string): Promise<PosterInfo[]> {
    const { context, page } = await this.newContext()
    try {
      await this.navigate(page, url, 'div.card, .overlay-container')
      const html = await page.content()
      const $ = cheerio.load(html)
      const cards = parseCards($)
      const posters = cardsToPosters(cards)
      Logger.scrape('PosterDB', `Set ${url} — ${posters.length} posters found`)
      return posters
    } catch (err) {
      Logger.error('PosterDB', `scrapeSet failed: ${err instanceof Error ? err.message : err}`)
      return []
    } finally {
      await context.close()
    }
  }

  // ── Single poster → find parent set, recurse ──────────────────────────────

  async scrapeSinglePoster(url: string): Promise<PosterInfo[]> {
    const { context, page } = await this.newContext()
    try {
      await this.navigate(page, url, 'a[href*="/set/"]')
      const html = await page.content()
      const $ = cheerio.load(html)

      // Find the "part of set" link on the poster detail page
      const setHref = $('a[href*="/set/"]').first().attr('href')
      if (!setHref) {
        // Fall back to parsing just this poster's detail page
        const cards = parseCards($)
        return cardsToPosters(cards)
      }

      const setUrl = setHref.startsWith('http') ? setHref : `${BASE}${setHref}`
      await context.close()
      await sleepConfig('min')
      return this.scrapeSet(setUrl)
    } catch (err) {
      Logger.error('PosterDB', `scrapeSinglePoster failed: ${err instanceof Error ? err.message : err}`)
      return []
    } finally {
      await context.close().catch(() => {})
    }
  }

  // ── User uploads — paginate through all pages ─────────────────────────────

  async scrapeUserUploads(url: string): Promise<PosterInfo[]> {
    const allPosters: PosterInfo[] = []
    let page = 1
    let hasMore = true

    while (hasMore && !this._aborted) {
      const pageUrl = url.includes('?') ? `${url}&page=${page}` : `${url}?page=${page}`
      const { context, ctx: pageCtx } = await this._newUserPage()

      try {
        await this.navigate(pageCtx, pageUrl, 'div.card, .overlay-container')
        const html = await pageCtx.content()
        const $ = cheerio.load(html)
        const cards = parseCards($)

        if (!cards.length) {
          hasMore = false
        } else {
          allPosters.push(...cardsToPosters(cards))
          // Check if there's a "next page" link
          const nextLink = $('a[rel="next"], .pagination .next:not(.disabled)').attr('href')
          hasMore = !!nextLink
          page++
          await sleepConfig('batch')
        }
      } catch (err) {
        Logger.error('PosterDB', `scrapeUserUploads page ${page} failed: ${err instanceof Error ? err.message : err}`)
        hasMore = false
      } finally {
        await context.close()
      }
    }

    Logger.scrape('PosterDB', `User uploads ${url} — ${allPosters.length} total posters`)
    return allPosters
  }

  // Private helper to avoid duplicate context/page naming
  private async _newUserPage() {
    const { context, page } = await this.newContext()
    return { context, ctx: page }
  }
}
