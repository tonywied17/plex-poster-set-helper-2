import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { AppConfig } from '../ipc/types'
import { getUserDataPath, getLogPath } from '../runtime/paths'
import { isWebMode, isHeadlessMode } from '../runtime/runtime'

const DEFAULTS: AppConfig = {
  baseUrl: 'http://localhost:32400',
  token: '',
  tvLibraries: [],
  movieLibraries: [],
  mediuxFilters: ['poster', 'backdrop', 'title_card'],
  titleMappings: {},
  maxWorkers: 4,
  bulkFiles: [],
  scraperMinDelay: 0.1,
  scraperMaxDelay: 0.5,
  scraperInitialDelay: 0.0,
  scraperBatchDelay: 2.0,
  scraperPageWaitMin: 0.0,
  scraperPageWaitMax: 0.5,
  logAppend: true,
  clientIdentifier: '',
  logDrawerHeight: 300,
  libraryPanelWidth: 560,
  plexServerName: '',
  scheduledJobs: [],
  tmdbApiKey: '',
  mediuxSubscriptions: [],
  appliedSetIds: [],
  appliedPosters: [],
  trayNotice: true,
  excludedLibraries: [],
}

function useJsonStore(): boolean {
  return isWebMode() || isHeadlessMode() || !!process.env.PLEX_HELPER_CONFIG_DIR
}

function jsonConfigPath(): string {
  return path.join(getUserDataPath(), 'config.json')
}

function readJsonStore(): Partial<AppConfig> {
  try {
    const raw = fs.readFileSync(jsonConfigPath(), 'utf8')
    return JSON.parse(raw) as Partial<AppConfig>
  } catch {
    return {}
  }
}

function writeJsonStore(data: Record<string, unknown>): void {
  const dir = getUserDataPath()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(jsonConfigPath(), JSON.stringify(data, null, 2), 'utf8')
}

let electronStore: { get: (k: string) => unknown; set: (k: string, v: unknown) => void; store: Record<string, unknown> } | null = null

function getElectronStore() {
  if (electronStore) return electronStore
  const Store = require('electron-store') as typeof import('electron-store').default
  electronStore = new Store<Record<string, unknown>>({ name: 'app-config' })
  return electronStore
}

function readRaw(): Partial<AppConfig> {
  if (useJsonStore()) return readJsonStore()
  return getElectronStore().store as Partial<AppConfig>
}

function writeKey(key: string, value: unknown): void {
  if (useJsonStore()) {
    const current = readJsonStore()
    writeJsonStore({ ...current, [key]: value })
  } else {
    getElectronStore().set(key, value)
  }
}

function decryptToken(stored: string): string {
  if (!stored) return ''
  if (useJsonStore()) return stored
  try {
    const { safeStorage } = require('electron') as typeof import('electron')
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(stored, 'base64')
      return safeStorage.decryptString(buf)
    }
  } catch { /* fall through */ }
  return stored
}

function encryptToken(token: string): string {
  if (useJsonStore()) return token
  try {
    const { safeStorage } = require('electron') as typeof import('electron')
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(token).toString('base64')
    }
  } catch { /* fall through */ }
  return token
}

/** Persistent app configuration with JSON file (web/Docker) or electron-store (desktop). */
export const ConfigService = {
  async init() {
    if (!readRaw().clientIdentifier) {
      writeKey('clientIdentifier', randomUUID())
    }
  },

  get(): AppConfig {
    const raw = readRaw()
    const config = { ...DEFAULTS, ...raw }
    if (config.token) {
      config.token = decryptToken(config.token as string)
    }
    return config
  },

  set(partial: Partial<AppConfig>) {
    const updates = { ...partial }
    if (updates.token !== undefined) {
      updates.token = encryptToken(updates.token)
    }
    Object.entries(updates).forEach(([key, value]) => {
      writeKey(key, value)
    })
  },

  getLogPath(): string {
    return getLogPath()
  },
}
