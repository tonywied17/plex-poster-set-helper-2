import * as cheerio from 'cheerio'
import { BaseScraper, sleepConfig } from './baseScraper'
import { Logger } from '../services/logger'
import type { PosterInfo } from '../ipc/types'

const BASE = 'https://theposterdb.com'

/**
 * Classifies a ThePosterDB URL.
 *
 * @param url - URL to inspect.
 * @returns set, poster, user, or unknown.
 */
export function posterdbUrlType(url: string): 'set' | 'poster' | 'user' | 'unknown' {
  if (/theposterdb\.com\/set\/\d+/.test(url)) return 'set'
  if (/theposterdb\.com\/poster\/\d+/.test(url)) return 'poster'
  if (/theposterdb\.com\/user\//.test(url)) return 'user'
  return 'unknown'
}

/**
 * Returns the original-quality image endpoint (matches the Python scraper:
 * /api/assets/{id}).
 *
 * @param posterId - The poster's data-poster-id.
 * @returns The asset URL.
 */
function posterAssetUrl(posterId: string): string {
  return `${BASE}/api/assets/${posterId}`
}

interface RawCard {
  posterId: string
  thumbUrl: string
  title: string
  mediaType: string
  year?: number
  season?: number | 'Cover' | 'Backdrop'
}

/**
 * Extracts the "(YYYY)" year from a poster title.
 *
 * @param text - Raw card title.
 * @returns The year, or undefined.
 */
function parseYear(text: string): number | undefined {
  const m = text.match(/\((\d{4})\)/)
  return m ? parseInt(m[1]) : undefined
}

/**
 * Derives the season for a TV show poster from the title suffix the way
 * ThePosterDB formats it: "Title (Year) - Season N", "- Specials" maps to 0,
 * otherwise it's the show cover poster. Movies/collections have no season.
 *
 * @param text - Raw card title.
 * @returns The season number, 0 for Specials, or 'Cover'.
 */
function parseShowSeason(text: string): number | 'Cover' | undefined {
  if (text.includes(' - ')) {
    const last = text.split(' - ').pop()!.trim()
    if (/specials/i.test(last)) return 0
    const m = last.match(/season\s+(\d+)/i)
    if (m) return parseInt(m[1])
  }
  return 'Cover'
}

/**
 * Parses poster cards from a ThePosterDB page. Each poster is a grid cell
 * containing a `div.overlay` that carries `data-poster-id`, a tooltip anchor
 * whose `title` is the media type (Movie / Show / Collection), and a
 * `p.text-break` title. The overlay is the most stable hook; the rest is read
 * from its grid cell.
 *
 * @param $ - Cheerio handle over the page HTML.
 * @returns One raw card per poster found.
 */
function parseCards($: cheerio.CheerioAPI): RawCard[] {
  const cards: RawCard[] = []

  $('div.overlay[data-poster-id]').each((_, el) => {
    const $overlay = $(el)
    const posterId = $overlay.attr('data-poster-id')
    if (!posterId) return

    let $cell = $overlay.closest('div[class*="col-"]')
    if (!$cell.length) $cell = $overlay.parent()

    // data-poster-type is the modern attribute; the tooltip anchor's title
    // covers older markup
    const mediaType = (
      $overlay.attr('data-poster-type') ||
      $cell.find('a.text-white[data-toggle="tooltip"]').attr('title') ||
      $overlay.find('a[data-toggle="tooltip"]').attr('title') ||
      'Movie'
    ).trim()

    const rawTitle = (
      $cell.find('p.text-break').first().text() ||
      $cell.find('p').first().text() ||
      $cell.find('img').first().attr('alt') ||
      ''
    ).trim()
    if (!rawTitle) return

    const title = rawTitle.split(' (')[0].trim()
    const year = parseYear(rawTitle)
    const season = /show/i.test(mediaType) ? parseShowSeason(rawTitle) : undefined

    const imgEl = $cell.find('img').first()
    const rawThumb = imgEl.attr('src') ?? imgEl.attr('data-src') ?? imgEl.attr('data-lazy-src') ?? ''
    const thumbUrl = rawThumb.startsWith('http') ? rawThumb : rawThumb ? `${BASE}${rawThumb}` : ''

    cards.push({ posterId, thumbUrl, title, mediaType, year, season })
  })

  return cards
}

/**
 * Converts parsed cards into PosterInfo entries.
 *
 * @param cards - Cards from parseCards().
 * @returns Posters with original-quality URLs and display thumbs.
 */
function cardsToPosters(cards: RawCard[]): PosterInfo[] {
  return cards.map(c => ({
    title: c.title,
    url: posterAssetUrl(c.posterId),
    thumbUrl: c.thumbUrl || posterAssetUrl(c.posterId),
    source: 'posterdb' as const,
    year: c.year,
    season: c.season,
  }))
}

/** Scrapes ThePosterDB set, single-poster, and user-upload pages via a headless browser. */
export class PosterdbScraper extends BaseScraper {
  /**
   * Routes a ThePosterDB URL to the matching scrape strategy.
   *
   * @param url - Set, poster, or user page URL.
   * @returns Posters found, empty for unrecognised URLs.
   */
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

  /**
   * Scrapes every poster on a set page.
   *
   * @param url - Set page URL.
   * @returns Posters found, empty on failure.
   */
  async scrapeSet(url: string): Promise<PosterInfo[]> {
    const { context, page } = await this.newContext()
    try {
      await this.navigate(page, url, 'div.overlay[data-poster-id]')
      const html = await page.content()
      const $ = cheerio.load(html)
      const cards = parseCards($)
      const posters = cardsToPosters(cards)
      Logger.scrape('PosterDB', `Set ${url} - ${posters.length} posters found`)
      return posters
    } catch (err) {
      Logger.error('PosterDB', `scrapeSet failed: ${err instanceof Error ? err.message : err}`)
      return []
    } finally {
      await context.close()
    }
  }

  /**
   * Scrapes a single-poster page by locating its parent set, falling back to
   * the poster itself.
   *
   * @param url - Poster page URL.
   * @returns The parent set's posters, or just this poster.
   */
  async scrapeSinglePoster(url: string): Promise<PosterInfo[]> {
    const { context, page } = await this.newContext()
    try {
      await this.navigate(page, url, 'div.overlay[data-poster-id], a[title="View Set Page"]')
      const html = await page.content()
      const $ = cheerio.load(html)

      // "View Set Page" link (new layout), then older fallbacks
      const setHref =
        $('a[data-toggle="tooltip"][title="View Set Page"]').first().attr('href') ||
        $('a.rounded.view_all').first().attr('href') ||
        $('a[href*="/set/"]').first().attr('href')
      if (!setHref) {
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

  /**
   * Scrapes a user's uploads, paginating until a short page or abort.
   *
   * @param url - User profile URL.
   * @returns All posters across the paginated upload pages.
   */
  async scrapeUserUploads(url: string): Promise<PosterInfo[]> {
    const allPosters: PosterInfo[] = []
    let page = 1
    let hasMore = true

    const baseUrl = url.split('?')[0]
    while (hasMore && !this._aborted) {
      const pageUrl = `${baseUrl}?section=uploads&page=${page}`
      const { context, ctx: pageCtx } = await this._newUserPage()

      try {
        await this.navigate(pageCtx, pageUrl, 'div.overlay[data-poster-id]')
        const html = await pageCtx.content()
        const $ = cheerio.load(html)
        const cards = parseCards($)

        if (!cards.length) {
          hasMore = false
        } else {
          allPosters.push(...cardsToPosters(cards))
          // A full page (24 per page) means more may follow; a short page is the last
          hasMore = cards.length >= 24
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

    Logger.scrape('PosterDB', `User uploads ${url} - ${allPosters.length} total posters`)
    return allPosters
  }

  /** Opens a fresh context/page pair with the page aliased to avoid clashing with the loop counter. */
  private async _newUserPage() {
    const { context, page } = await this.newContext()
    return { context, ctx: page }
  }
}
