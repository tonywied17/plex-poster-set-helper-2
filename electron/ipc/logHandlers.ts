import type { IpcMain } from 'electron'
import { handlers } from '../handlers'

export function registerLogHandlers(ipcMain: IpcMain) {
  ipcMain.handle('log:getHistory', () => handlers.log.getHistory())
  ipcMain.handle('log:clear', () => handlers.log.clear())
}
