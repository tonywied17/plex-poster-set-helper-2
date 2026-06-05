export interface ConnectReq {
  baseUrl: string
  token: string
}

export interface ConnectRes {
  success: boolean
  serverName?: string
  libraryCount?: number
  error?: string
}

export interface Library {
  key: string
  title: string
  type: 'movie' | 'show' | 'artist' | 'photo'
}

export interface FindItemReq {
  title: string
  year?: number
  libraries: string[]
}

export interface PlexItem {
  key: string
  title: string
  year?: number
  type: 'movie' | 'show' | 'season' | 'episode'
  libraryTitle: string
  thumb?: string
  labels: string[]
  season?: number
  episode?: number
}

export interface UploadReq {
  itemKey: string
  imageUrl: string
  source: 'mediux' | 'posterdb'
}

export interface UploadRes {
  success: boolean
  error?: string
}

export interface LabelReq {
  label: string
}

export interface ResetReq {
  itemKey: string
  hierarchical?: boolean
}

export interface ScrapeReq {
  url: string
  workerId?: number
}

export interface PosterInfo {
  title: string
  url: string            // full-res / download URL
  thumbUrl?: string      // thumbnail for UI display (may differ from url on PosterDB)
  source: 'mediux' | 'posterdb'
  year?: number
  season?: number | 'Cover' | 'Backdrop'
  episode?: number
}

export interface ScrapeProgress {
  url: string
  status: 'idle' | 'scraping' | 'uploading' | 'done' | 'error'
  posterCount?: number
  uploadedCount?: number
  error?: string
  workerId?: number
}

export interface BulkWriteReq {
  filename: string
  lines: string[]
}

export interface AppConfig {
  baseUrl: string
  token: string
  tvLibraries: string[]
  movieLibraries: string[]
  mediuxFilters: Array<'poster' | 'backdrop' | 'title_card'>
  titleMappings: Record<string, string>
  maxWorkers: number
  bulkFiles: string[]
  scraperMinDelay: number
  scraperMaxDelay: number
  scraperInitialDelay: number
  scraperBatchDelay: number
  scraperPageWaitMin: number
  scraperPageWaitMax: number
  logAppend: boolean
  clientIdentifier: string
  plexAccountName?: string
  plexAccountEmail?: string
  plexAccountThumb?: string
  logDrawerHeight: number
}

export interface LogEntry {
  ts: string
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'session' | 'success' | 'scrape'
  module: string
  message: string
  meta?: Record<string, unknown>
}

export interface UpdateInfo {
  available: boolean
  version?: string
  releaseNotes?: string
}

export interface PlexAuthStatus {
  status: 'idle' | 'waiting' | 'authorized' | 'timeout' | 'error'
  pin?: string
  token?: string
  error?: string
}

export type IpcChannels = {
  'plex:connect': { req: ConnectReq; res: ConnectRes }
  'plex:getLibraries': { req: void; res: Library[] }
  'plex:findItem': { req: FindItemReq; res: PlexItem | null }
  'plex:uploadPoster': { req: UploadReq; res: UploadRes }
  'plex:getLabeledItems': { req: LabelReq; res: PlexItem[] }
  'plex:resetPoster': { req: ResetReq; res: void }
  'plex:getStats': { req: void; res: Record<string, number> }
  'scrape:url': { req: ScrapeReq; res: PosterInfo[] }
  'scrape:cancel': { req: void; res: void }
  'config:get': { req: void; res: AppConfig }
  'config:set': { req: Partial<AppConfig>; res: void }
  'bulk:listFiles': { req: void; res: string[] }
  'bulk:readFile': { req: string; res: string[] }
  'bulk:writeFile': { req: BulkWriteReq; res: void }
  'bulk:newFile': { req: string; res: void }
  'bulk:deleteFile': { req: string; res: void }
  'bulk:renameFile': { req: { oldName: string; newName: string }; res: void }
  'auth:plexSignIn': { req: void; res: string }
  'auth:plexStatus': { req: void; res: PlexAuthStatus }
  'auth:disconnect': { req: void; res: void }
  'app:getVersion': { req: void; res: string }
  'app:checkUpdate': { req: void; res: UpdateInfo }
  'app:installUpdate': { req: void; res: void }
  'app:openLogFolder': { req: void; res: void }
  'log:getHistory': { req: void; res: LogEntry[] }
  'log:stream': { event: LogEntry }
  'scrape:progress': { event: ScrapeProgress }
  'auth:statusChange': { event: PlexAuthStatus }
}
