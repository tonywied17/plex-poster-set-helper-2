import type { IpcMain } from 'electron'
import { handlers } from '../handlers'
import type { BulkWriteReq } from './types'

export function registerBulkHandlers(ipcMain: IpcMain) {
  ipcMain.handle('bulk:listFiles', () => handlers.bulk.listFiles())
  ipcMain.handle('bulk:readFile', (_e, filename: string) => handlers.bulk.readFile(filename))
  ipcMain.handle('bulk:writeFile', (_e, req: BulkWriteReq) => handlers.bulk.writeFile(req))
  ipcMain.handle('bulk:newFile', (_e, filename: string) => handlers.bulk.newFile(filename))
  ipcMain.handle('bulk:deleteFile', (_e, filename: string) => handlers.bulk.deleteFile(filename))
  ipcMain.handle('bulk:renameFile', (_e, oldName: string, newName: string) => handlers.bulk.renameFile(oldName, newName))
}
