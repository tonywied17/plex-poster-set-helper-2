import type { IpcMain, BrowserWindow } from 'electron'
import { PlexAuthService } from '../services/plexAuthService'
import { PlexService } from '../services/plexService'
import { Logger } from '../services/logger'
import type { PlexAuthStatus } from './types'

/**
 * Registers Plex OAuth IPC handlers: sign-in, status polling, and disconnect.
 *
 * @param ipcMain - The main-process IPC bus.
 * @param win - Window that receives auth:statusChange events.
 */
export function registerAuthHandlers(ipcMain: IpcMain, win: BrowserWindow) {
  function emit(status: PlexAuthStatus) {
    win.webContents.send('auth:statusChange', status)
  }

  ipcMain.handle('auth:plexSignIn', async () => {
    try {
      const token = await PlexAuthService.signIn(win, emit)

      // Auto-connect to the Plex server with the new token (non-blocking, best-effort)
      const cfg = (await import('../services/config')).ConfigService.get()
      if (cfg.baseUrl) {
        PlexService.connect({ baseUrl: cfg.baseUrl, token }).catch(err => {
          Logger.warn('Auth', `Auto-connect after sign-in failed: ${err instanceof Error ? err.message : err}`)
        })
      }

      return token
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      emit({ status: 'error', error })
      throw err
    }
  })

  ipcMain.handle('auth:plexStatus', async () => {
    const status = PlexAuthService.getStatus()
    if (status.status === 'authorized') {
      const { ConfigService } = await import('../services/config')
      const cfg = ConfigService.get()
      return { ...status, serverName: cfg.plexServerName ?? '' }
    }
    return status
  })

  ipcMain.handle('auth:disconnect', async () => {
    await PlexAuthService.disconnect()
    emit({ status: 'idle' })
  })
}
