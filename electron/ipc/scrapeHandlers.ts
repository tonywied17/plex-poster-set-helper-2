import type { IpcMain, BrowserWindow } from 'electron'
import { ScraperFactory } from '../scrapers/scraperFactory'
import type { ScrapeReq, ScrapeProgress } from './types'

/**
 * Registers scraping IPC handlers: poster-set scraping with progress events,
 * and cancellation.
 *
 * @param ipcMain - The main-process IPC bus.
 * @param win - Window that receives scrape:progress events.
 */
export function registerScrapeHandlers(ipcMain: IpcMain, win?: BrowserWindow) {
  function emitProgress(progress: ScrapeProgress) {
    win?.webContents.send('scrape:progress', progress)
  }

  ipcMain.handle('scrape:url', async (_e, req: ScrapeReq) => {
    return ScraperFactory.scrapeUrl(req.url, emitProgress, req.workerId)
  })

  ipcMain.handle('scrape:cancel', async () => {
    ScraperFactory.abort()
    await ScraperFactory.close()
  })
}
