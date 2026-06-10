import type { IpcMain } from 'electron'
import { BulkService } from '../services/bulkService'
import type { BulkWriteReq } from './types'

/**
 * Registers bulk-file IPC handlers: list, read, write, create, delete, and rename.
 *
 * @param ipcMain - The main-process IPC bus.
 */
export function registerBulkHandlers(ipcMain: IpcMain) {
  ipcMain.handle('bulk:listFiles', () => BulkService.list())

  ipcMain.handle('bulk:readFile', (_e, filename: string) =>
    BulkService.read(filename)
  )

  ipcMain.handle('bulk:writeFile', (_e, { filename, lines }: BulkWriteReq) =>
    BulkService.write(filename, lines)
  )

  ipcMain.handle('bulk:newFile', (_e, filename: string) =>
    BulkService.create(filename)
  )

  ipcMain.handle('bulk:deleteFile', (_e, filename: string) =>
    BulkService.delete(filename)
  )

  ipcMain.handle('bulk:renameFile', (_e, oldName: string, newName: string) =>
    BulkService.rename(oldName, newName)
  )
}
