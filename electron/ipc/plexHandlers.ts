import type { IpcMain } from 'electron'
import { handlers } from '../handlers'
import type { ConnectReq, FindItemReq, FindCollectionReq, UploadReq, LabelReq, ResetReq } from './types'

export function registerPlexHandlers(ipcMain: IpcMain) {
  ipcMain.handle('plex:connect', (_e, req: ConnectReq) => handlers.plex.connect(req))
  ipcMain.handle('plex:getLibraries', () => handlers.plex.getLibraries())
  ipcMain.handle('plex:getLibraryCount', (_e, key: string, type: 'movie' | 'show') => handlers.plex.getLibraryCount(key, type))
  ipcMain.handle('plex:findItem', (_e, req: FindItemReq) => handlers.plex.findItem(req))
  ipcMain.handle('plex:findCollection', (_e, req: FindCollectionReq) => handlers.plex.findCollection(req))
  ipcMain.handle('plex:uploadPoster', (_e, req: UploadReq) => handlers.plex.uploadPoster(req))
  ipcMain.handle('plex:getLabeledItems', (_e, req: LabelReq) => handlers.plex.getLabeledItems(req))
  ipcMain.handle('plex:resetPoster', (_e, req: ResetReq) => handlers.plex.resetPoster(req))
  ipcMain.handle('plex:cleanBundles', () => handlers.plex.cleanBundles())
  ipcMain.handle('plex:getStats', () => handlers.plex.getStats())
}
