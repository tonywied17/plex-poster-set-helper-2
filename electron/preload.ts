import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ScrapeProgress, LogEntry, PlexAuthStatus, UpdateInfo } from './ipc/types'

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // Plex
  plex: {
    connect: (baseUrl: string, token: string) =>
      ipcRenderer.invoke('plex:connect', { baseUrl, token }),
    getLibraries: () => ipcRenderer.invoke('plex:getLibraries'),
    findItem: (title: string, year?: number, libraries?: string[]) =>
      ipcRenderer.invoke('plex:findItem', { title, year, libraries: libraries ?? [] }),
    uploadPoster: (itemKey: string, imageUrl: string, source: 'mediux' | 'posterdb') =>
      ipcRenderer.invoke('plex:uploadPoster', { itemKey, imageUrl, source }),
    getLabeledItems: (label: string) =>
      ipcRenderer.invoke('plex:getLabeledItems', { label }),
    resetPoster: (itemKey: string, hierarchical?: boolean) =>
      ipcRenderer.invoke('plex:resetPoster', { itemKey, hierarchical }),
    getStats: () => ipcRenderer.invoke('plex:getStats'),
  },

  // Scraping
  scrape: {
    url: (url: string) => ipcRenderer.invoke('scrape:url', { url }),
    cancel: () => ipcRenderer.invoke('scrape:cancel'),
    onProgress: (cb: (progress: ScrapeProgress) => void) => {
      const handler = (_: unknown, data: ScrapeProgress) => cb(data)
      ipcRenderer.on('scrape:progress', handler)
      return () => ipcRenderer.removeListener('scrape:progress', handler)
    },
  },

  // Config
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
    set: (partial: Partial<AppConfig>) => ipcRenderer.invoke('config:set', partial),
  },

  // Bulk files
  bulk: {
    listFiles: (): Promise<string[]> => ipcRenderer.invoke('bulk:listFiles'),
    readFile: (filename: string): Promise<string[]> =>
      ipcRenderer.invoke('bulk:readFile', filename),
    writeFile: (filename: string, lines: string[]) =>
      ipcRenderer.invoke('bulk:writeFile', { filename, lines }),
    newFile: (filename: string) => ipcRenderer.invoke('bulk:newFile', filename),
    deleteFile: (filename: string) => ipcRenderer.invoke('bulk:deleteFile', filename),
    renameFile: (oldName: string, newName: string) => ipcRenderer.invoke('bulk:renameFile', oldName, newName),
  },

  // Plex auth
  auth: {
    signIn: (): Promise<string> => ipcRenderer.invoke('auth:plexSignIn'),
    getStatus: (): Promise<PlexAuthStatus> => ipcRenderer.invoke('auth:plexStatus'),
    disconnect: () => ipcRenderer.invoke('auth:disconnect'),
    onStatusChange: (cb: (status: PlexAuthStatus) => void) => {
      const handler = (_: unknown, data: PlexAuthStatus) => cb(data)
      ipcRenderer.on('auth:statusChange', handler)
      return () => ipcRenderer.removeListener('auth:statusChange', handler)
    },
  },

  // App / updater
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    checkUpdate: (): Promise<UpdateInfo> => ipcRenderer.invoke('app:checkUpdate'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    openLogFolder: () => ipcRenderer.invoke('app:openLogFolder'),
    onUpdateAvailable: (cb: (info: UpdateInfo) => void) => {
      const handler = (_: unknown, data: UpdateInfo) => cb(data)
      ipcRenderer.on('app:updateAvailable', handler)
      return () => ipcRenderer.removeListener('app:updateAvailable', handler)
    },
    onUpdateReady: (cb: () => void) => {
      ipcRenderer.on('app:updateReady', cb)
      return () => ipcRenderer.removeListener('app:updateReady', cb)
    },
  },

  // Log streaming
  log: {
    getHistory: (): Promise<LogEntry[]> => ipcRenderer.invoke('log:getHistory'),
    onEntry: (cb: (entry: LogEntry) => void) => {
      const handler = (_: unknown, data: LogEntry) => cb(data)
      ipcRenderer.on('log:stream', handler)
      return () => ipcRenderer.removeListener('log:stream', handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
