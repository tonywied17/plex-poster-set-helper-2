import fs from 'fs'
import path from 'path'
import { isWebMode, isHeadlessMode } from './runtime'

let _userDataPath: string | null = null

/**
 * Resolves the per-install data directory (config, logs, browsers, bulk files).
 * Uses PLEX_HELPER_CONFIG_DIR when set; otherwise Electron userData.
 */
export function getUserDataPath(): string {
  if (_userDataPath) return _userDataPath

  const envDir = process.env.PLEX_HELPER_CONFIG_DIR?.trim()
  if (envDir) {
    _userDataPath = envDir
    fs.mkdirSync(_userDataPath, { recursive: true })
    return _userDataPath
  }

  if (isWebMode() || isHeadlessMode()) {
    const fallback = path.join(process.cwd(), 'data')
    fs.mkdirSync(fallback, { recursive: true })
    _userDataPath = fallback
    return _userDataPath
  }

  try {
    const { app } = require('electron') as typeof import('electron')
    _userDataPath = app.getPath('userData')
    return _userDataPath
  } catch {
    const fallback = path.join(process.cwd(), 'data')
    fs.mkdirSync(fallback, { recursive: true })
    _userDataPath = fallback
    return _userDataPath
  }
}

/** Log directory under userData. */
export function getLogPath(): string {
  const dir = path.join(getUserDataPath(), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Application root for resolving node_modules/playwright in web/headless mode.
 */
export function getAppRoot(): string {
  try {
    const { app } = require('electron') as typeof import('electron')
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked')
      const cliInUnpacked = path.join(unpacked, 'node_modules', 'playwright', 'cli.js')
      if (fs.existsSync(cliInUnpacked)) return unpacked
      return app.getAppPath().replace(/\.asar$/i, '.asar.unpacked')
    }
    return app.getAppPath()
  } catch {
    // server/dist/electron/runtime → repo root is four levels up
    return path.resolve(__dirname, '../../../..')
  }
}
