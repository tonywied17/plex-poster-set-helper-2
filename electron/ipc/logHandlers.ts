import type { IpcMain } from 'electron'
import { Logger } from '../services/logger'

export function registerLogHandlers(ipcMain: IpcMain) {
  ipcMain.handle('log:getHistory', () => Logger.getHistory())
}
