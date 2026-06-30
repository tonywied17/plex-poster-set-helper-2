import type { IpcMain, BrowserWindow } from 'electron'
import { handlers } from '../handlers'
import { appEvents } from '../runtime/events'
import type { PlexAuthStatus } from './types'

export function registerAuthHandlers(ipcMain: IpcMain, win: BrowserWindow) {
  appEvents.onEvent('auth:statusChange', (status: PlexAuthStatus) => {
    if (!win.isDestroyed()) win.webContents.send('auth:statusChange', status)
  })

  ipcMain.handle('auth:plexSignIn', () => handlers.auth.signIn(win))
  ipcMain.handle('auth:plexStatus', () => handlers.auth.getStatus())
  ipcMain.handle('auth:disconnect', () => handlers.auth.disconnect())
}
