import type { IpcMain, BrowserWindow } from 'electron'
import { handlers } from '../handlers'
import { appEvents } from '../runtime/events'

export function registerBrowserHandlers(ipcMain: IpcMain) {
  ipcMain.handle('browser:status', () => handlers.browser.getStatus())
  ipcMain.handle('browser:install', () => handlers.browser.install())
}

export function wireBrowserEvents(win: BrowserWindow) {
  appEvents.onEvent('browser:installProgress', (line: string) => {
    if (!win.isDestroyed()) win.webContents.send('browser:installProgress', line)
  })
}
