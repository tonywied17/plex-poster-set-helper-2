import type { IpcMain } from 'electron'
import { handlers } from '../handlers'
import type { SectionItemsReq, BrowseSetsReq, UserSetsReq, CreatorSearchReq, CollectionsReq, CollectionSetsReq, CurrentArtReq } from './types'

export function registerLibraryHandlers(ipcMain: IpcMain) {
  ipcMain.handle('library:sections', () => handlers.library.sections())
  ipcMain.handle('library:items', (_e, req: SectionItemsReq) => handlers.library.items(req))
  ipcMain.handle('library:collections', (_e, req: CollectionsReq) => handlers.library.collections(req))
  ipcMain.handle('library:collectionSets', (_e, req: CollectionSetsReq) => handlers.library.collectionSets(req))
  ipcMain.handle('library:sets', (_e, req: BrowseSetsReq) => handlers.library.sets(req))
  ipcMain.handle('library:userSets', (_e, req: UserSetsReq) => handlers.library.userSets(req))
  ipcMain.handle('library:creatorSearch', (_e, req: CreatorSearchReq) => handlers.library.creatorSearch(req))
  ipcMain.handle('library:currentArt', (_e, req: CurrentArtReq) => handlers.library.currentArt(req))
}
