import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { BrowserWindow } from 'electron'
import { Logger } from './logger'
import { getUserDataPath, getAppRoot } from '../runtime/paths'
import { appEvents } from '../runtime/events'

export interface BrowserStatus {
  installed: boolean
  executablePath: string
  browsersPath: string
}

let _win: BrowserWindow | null = null
let _installing: Promise<void> | null = null

function execName(headless: boolean): string {
  const base = headless ? 'chrome-headless-shell' : 'chrome'
  if (process.platform === 'win32') return `${base}.exe`
  if (process.platform === 'darwin' && !headless) return 'Chromium'
  return base
}

function findFile(dir: string, name: string, depth = 4): string | null {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return null }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isFile() && e.name === name) return full
    if (e.isDirectory() && depth > 0) {
      const hit = findFile(full, name, depth - 1)
      if (hit) return hit
    }
  }
  return null
}

export function findBrowserExec(browsersPath: string): string | null {
  if (!fs.existsSync(browsersPath)) return null
  const entries = fs.readdirSync(browsersPath)

  const shellDir = entries
    .filter(e => e.startsWith('chromium_headless_shell-') || e.startsWith('chromium-headless-shell-'))
    .sort()
    .slice(-1)[0]

  if (shellDir) {
    const exec = findFile(path.join(browsersPath, shellDir), execName(true))
    if (exec) return exec
  }

  const chromiumDir = entries
    .filter(e => e.startsWith('chromium-') && !e.includes('headless'))
    .sort()
    .slice(-1)[0]

  if (chromiumDir) {
    const exec = findFile(path.join(browsersPath, chromiumDir), execName(false))
    if (exec) return exec
  }

  return null
}

function sendProgress(line: string) {
  if (!line.trim()) return
  appEvents.emitEvent('browser:installProgress', line.trim())
  _win?.webContents.send('browser:installProgress', line.trim())
  Logger.info('Playwright', line.trim())
}

/** Manages the bundled Playwright Chromium: discovery, installation, and launch environment. */
export const PlaywrightService = {
  init(win: BrowserWindow | null) {
    _win = win
  },

  getBrowsersPath(): string {
    return path.join(getUserDataPath(), 'browsers')
  },

  async getStatus(): Promise<BrowserStatus> {
    const browsersPath = this.getBrowsersPath()
    const execPath = findBrowserExec(browsersPath)
    return {
      installed:      execPath !== null,
      executablePath: execPath ?? '',
      browsersPath,
    }
  },

  install(): Promise<void> {
    if (_installing) return _installing
    _installing = this._doInstall().finally(() => { _installing = null })
    return _installing
  },

  _doInstall(): Promise<void> {
    return new Promise((resolve, reject) => {
      const appRoot = getAppRoot()
      const cliPath = path.join(appRoot, 'node_modules', 'playwright', 'cli.js')
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: this.getBrowsersPath(),
        ELECTRON_RUN_AS_NODE: '1',
      }

      if (!fs.existsSync(cliPath)) {
        reject(new Error(`Playwright CLI not found at ${cliPath}`))
        return
      }

      Logger.info('Playwright', `Installing via ${cliPath}`)
      Logger.info('Playwright', `Browsers path: ${this.getBrowsersPath()}`)

      let settled = false
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        clearInterval(poll)
        if (err) reject(err)
        else resolve()
      }

      const onStdout = (d: Buffer) => String(d).split('\n').forEach(sendProgress)
      const onStderr = (d: Buffer) => String(d).split('\n').forEach(sendProgress)
      const onExit = (code: number | null) => {
        if (code === 0) {
          Logger.success('Playwright', 'Chromium installed')
          done()
        } else {
          done(new Error(`playwright install exited with code ${code ?? 'unknown'}`))
        }
      }

      const child = spawn(process.execPath, [cliPath, 'install', 'chromium'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      })
      child.stdout?.on('data', onStdout)
      child.stderr?.on('data', onStderr)
      child.on('error', err => done(err))
      child.on('exit', onExit)

      const browsersPath = this.getBrowsersPath()
      const preExisting = findBrowserExec(browsersPath)
      const poll = setInterval(() => {
        const found = findBrowserExec(browsersPath)
        if (found && found !== preExisting) {
          Logger.success('Playwright', 'Chromium detected on disk (exit event fallback)')
          done()
        }
      }, 3000)
    })
  },

  setupEnv() {
    const browsersPath = this.getBrowsersPath()
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath

    const exec = findBrowserExec(browsersPath)
    if (exec) {
      process.env.PLEX_BROWSER_EXEC = exec
      Logger.info('Playwright', `Browser: ${exec}`)
    } else {
      delete process.env.PLEX_BROWSER_EXEC
    }
  },
}
