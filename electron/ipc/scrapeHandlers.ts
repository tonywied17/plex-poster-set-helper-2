import type { IpcMain, BrowserWindow } from 'electron'
import { handlers } from '../handlers'
import { appEvents } from '../runtime/events'
import type { ScrapeReq, ScrapeProgress } from './types'

export function registerScrapeHandlers(ipcMain: IpcMain, win?: BrowserWindow) {
  if (win) {
    appEvents.onEvent('scrape:progress', (progress: ScrapeProgress) => {
      if (!win.isDestroyed()) win.webContents.send('scrape:progress', progress)
    })
  }

  ipcMain.handle('scrape:url', (_e, req: ScrapeReq) => handlers.scrape.url(req))
  ipcMain.handle('scrape:cancel', () => handlers.scrape.cancel())
}
