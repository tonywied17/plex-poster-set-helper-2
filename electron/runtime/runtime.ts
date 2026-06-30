import fs from 'fs'
import path from 'path'

export function isWebMode(): boolean {
  return process.env.PLEX_HELPER_WEB === '1'
}

export function isHeadlessMode(): boolean {
  return process.env.PLEX_HELPER_HEADLESS === '1'
}

export function isDockerEnv(): boolean {
  return process.env.PLEX_HELPER_DOCKER === '1'
}

export function isProdUnpackaged(): boolean {
  return process.env.PLEX_HELPER_PROD === '1'
}

function readPackageVersion(): string {
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { name?: string; version?: string }
      if (pkg.name === 'plex-poster-set-helper-2' && pkg.version) return pkg.version
    }
    dir = path.dirname(dir)
  }
  return '0.0.0'
}

/** True when not a packaged Electron desktop app. */
export function isContainerEnv(): boolean {
  if (isWebMode() || isHeadlessMode() || isDockerEnv() || isProdUnpackaged()) return true
  try {
    const { app } = require('electron') as typeof import('electron')
    return !app.isPackaged
  } catch {
    return false
  }
}

/** App version from package.json (works without Electron). */
export function getAppVersion(): string {
  if (isWebMode() || isHeadlessMode()) return readPackageVersion()
  try {
    const { app } = require('electron') as typeof import('electron')
    return app.getVersion()
  } catch {
    return readPackageVersion()
  }
}
