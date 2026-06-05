import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { ConfigService } from '../services/config'
import type { PosterInfo } from '../ipc/types'

// ─── Rotation pools ───────────────────────────────────────────────────────────

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
]

export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function sleepConfig(type: 'min' | 'batch' | 'initial' | 'pageWait'): Promise<void> {
  const cfg = ConfigService.get()
  let ms = 0
  switch (type) {
    case 'min':      ms = rand(cfg.scraperMinDelay, cfg.scraperMaxDelay) * 1000; break
    case 'batch':    ms = cfg.scraperBatchDelay * 1000; break
    case 'initial':  ms = cfg.scraperInitialDelay * 1000; break
    case 'pageWait': ms = rand(cfg.scraperPageWaitMin, cfg.scraperPageWaitMax) * 1000; break
  }
  if (ms > 0) await sleep(ms)
}

// ─── Abstract base ────────────────────────────────────────────────────────────

export abstract class BaseScraper {
  protected _browser: Browser | null = null
  protected _aborted = false

  abstract scrape(url: string): Promise<PosterInfo[]>

  // ── Browser lifecycle ──────────────────────────────────────────────────────

  async getBrowser(): Promise<Browser> {
    if (!this._browser || !this._browser.isConnected()) {
      this._browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
        ],
      })
    }
    return this._browser
  }

  async newContext(): Promise<{ context: BrowserContext; page: Page }> {
    const browser = await this.getBrowser()
    const context = await browser.newContext({
      userAgent: pick(USER_AGENTS),
      viewport: pick(VIEWPORTS),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    })
    const page = await context.newPage()
    // Mask automation fingerprints (runs in browser context, not Node)
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any
      Object.defineProperty(g.navigator, 'webdriver', { get: () => undefined })
      g.chrome = { runtime: {} }
    })
    return { context, page }
  }

  async navigate(page: Page, url: string, waitFor: string): Promise<void> {
    await sleepConfig('initial')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => {})
    await sleepConfig('pageWait')
  }

  abort(): void {
    this._aborted = true
  }

  async close(): Promise<void> {
    await this._browser?.close().catch(() => {})
    this._browser = null
    this._aborted = false
  }
}
