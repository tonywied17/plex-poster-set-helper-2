import type { IpcMain } from 'electron'
import { PlaywrightService } from '../services/playwrightService'

/**
 * Registers Playwright browser IPC handlers: install status and on-demand install.
 *
 * @param ipcMain - The main-process IPC bus.
 */
export function registerBrowserHandlers(ipcMain: IpcMain) {
  ipcMain.handle('browser:status',  () => PlaywrightService.getStatus())
  ipcMain.handle('browser:install', async () => {
    await PlaywrightService.install()
    // Re-resolve PLEX_BROWSER_EXEC now that the binary exists
    PlaywrightService.setupEnv()
  })
}
