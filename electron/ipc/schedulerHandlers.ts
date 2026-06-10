import type { IpcMain } from 'electron'
import { SchedulerService } from '../services/schedulerService'
import type { ScheduledJob } from './types'

/**
 * Registers scheduler IPC handlers: job CRUD, manual runs, auto-start, and
 * engine status.
 *
 * @param ipcMain - The main-process IPC bus.
 */
export function registerSchedulerHandlers(ipcMain: IpcMain) {
  ipcMain.handle('scheduler:list',         ()           => SchedulerService.list())
  ipcMain.handle('scheduler:save',         (_e, job: ScheduledJob) => SchedulerService.save(job))
  ipcMain.handle('scheduler:delete',       (_e, id: string)        => SchedulerService.delete(id))
  ipcMain.handle('scheduler:runNow',       (_e, id: string)        => SchedulerService.runNow(id))
  ipcMain.handle('scheduler:setAutoStart', (_e, enable: boolean)   => SchedulerService.setAutoStart(enable))
  ipcMain.handle('scheduler:getAutoStart', ()                      => SchedulerService.getAutoStart())
  ipcMain.handle('scheduler:engineStatus', ()                      => SchedulerService.engineStatus())
}
