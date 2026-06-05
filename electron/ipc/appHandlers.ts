import { ipcMain, app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { IpcMain } from 'electron'
import { ConfigService } from '../services/config'

export function registerAppHandlers(_ipcMain: IpcMain) {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { available: !!result?.updateInfo, version: result?.updateInfo?.version }
    } catch {
      return { available: false }
    }
  })

  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('app:openLogFolder', () => {
    shell.openPath(ConfigService.getLogPath())
  })

  ipcMain.handle('config:get', () => ConfigService.get())

  ipcMain.handle('config:set', (_event, partial) => ConfigService.set(partial))
}
