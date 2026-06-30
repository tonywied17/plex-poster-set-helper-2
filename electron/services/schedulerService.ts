import cron, { type ScheduledTask } from 'node-cron'
import fs from 'fs'
import path from 'path'
import type { BrowserWindow } from 'electron'
import { ConfigService } from './config'
import { Logger } from './logger'
import { PlexService } from './plexService'
import { ScraperFactory } from '../scrapers/scraperFactory'
import type { ScheduledJob, SchedulerEngineStatus } from '../ipc/types'
import { getUserDataPath } from '../runtime/paths'
import { appEvents } from '../runtime/events'
import { isWebMode } from '../runtime/runtime'

const ENGINE_FILE     = 'scheduler-engine.json'
const ENGINE_WRITE_MS = 30_000
const ENGINE_FRESH_MS = 90_000
const WATCH_MS        = 30_000

const tasks = new Map<string, ScheduledTask>()
let _win: BrowserWindow | null = null
let _isEngine = false
let _engineTimer: NodeJS.Timeout | null = null
let _watchTimer: NodeJS.Timeout | null = null
let _activeSignature = ''
let _lastSnapshot = ''

function emit(jobs: ScheduledJob[]) {
  _lastSnapshot = JSON.stringify(jobs)
  appEvents.emitEvent('scheduler:onChange', jobs)
  _win?.webContents.send('scheduler:onChange', jobs)
}

function enginePath(): string {
  return path.join(getUserDataPath(), ENGINE_FILE)
}

function cronSignature(jobs: ScheduledJob[]): string {
  return jobs.filter(j => j.enabled).map(j => `${j.id}@${j.cronExpr}`).sort().join('|')
}

function cleanupEngine() {
  if (_engineTimer) { clearInterval(_engineTimer); _engineTimer = null }
  try { fs.unlinkSync(enginePath()) } catch { /* already gone */ }
}

/** Runs scheduled scrape-and-apply jobs via node-cron. */
export const SchedulerService = {
  init(win: BrowserWindow | null) {
    _win = win
    const jobs = ConfigService.get().scheduledJobs ?? []
    this._rescheduleAll(jobs)
    _lastSnapshot = JSON.stringify(jobs)
    this._startConfigWatcher()
    Logger.info('Scheduler', `Loaded ${jobs.length} job(s)`)
  },

  list(): ScheduledJob[] {
    return ConfigService.get().scheduledJobs ?? []
  },

  save(job: ScheduledJob): ScheduledJob {
    const jobs = this.list()
    const idx = jobs.findIndex(j => j.id === job.id)
    if (idx >= 0) jobs[idx] = job
    else jobs.push(job)
    ConfigService.set({ scheduledJobs: jobs })

    this._rescheduleAll(jobs)
    emit(jobs)
    return job
  },

  delete(id: string): void {
    const jobs = this.list().filter(j => j.id !== id)
    ConfigService.set({ scheduledJobs: jobs })
    this._rescheduleAll(jobs)
    emit(jobs)
  },

  async runNow(id: string): Promise<void> {
    const job = this.list().find(j => j.id === id)
    if (!job) throw new Error(`Job "${id}" not found`)
    await this._execute(job)
  },

  setAutoStart(enable: boolean): void {
    if (isWebMode()) {
      Logger.info('Scheduler', `Auto-start not available in web mode (${enable ? 'requested' : 'disabled'})`)
      return
    }
    const { app } = require('electron') as typeof import('electron')
    app.setLoginItemSettings({ openAtLogin: enable })
    Logger.info('Scheduler', `Auto-start ${enable ? 'enabled' : 'disabled'}`)
  },

  getAutoStart(): boolean {
    if (isWebMode()) return false
    const { app } = require('electron') as typeof import('electron')
    return app.getLoginItemSettings().openAtLogin
  },

  startEngineHeartbeat(): void {
    _isEngine = true
    const write = () => {
      try {
        fs.writeFileSync(enginePath(), JSON.stringify({ pid: process.pid, updatedAt: new Date().toISOString() }))
      } catch (err) {
        Logger.warn('Scheduler', `Could not write engine heartbeat: ${err instanceof Error ? err.message : err}`)
      }
    }
    write()
    _engineTimer = setInterval(write, ENGINE_WRITE_MS)

    if (isWebMode()) {
      process.once('SIGTERM', cleanupEngine)
      process.once('SIGINT', cleanupEngine)
    } else {
      const { app } = require('electron') as typeof import('electron')
      app.once('will-quit', cleanupEngine)
      process.once('SIGTERM', () => { cleanupEngine(); app.quit() })
      process.once('SIGINT',  () => { cleanupEngine(); app.quit() })
    }
    Logger.info('Scheduler', 'Running as the 24/7 engine - GUI instances on this config will defer to it')
  },

  engineStatus(): SchedulerEngineStatus {
    if (_isEngine) return { external: false }
    try {
      const raw = JSON.parse(fs.readFileSync(enginePath(), 'utf8')) as { updatedAt?: string }
      const ts = Date.parse(raw.updatedAt ?? '')
      if (!Number.isNaN(ts) && Date.now() - ts < ENGINE_FRESH_MS) {
        return { external: true, updatedAt: raw.updatedAt }
      }
    } catch { /* no heartbeat */ }
    return { external: false }
  },

  _startConfigWatcher(): void {
    if (_watchTimer) return
    _watchTimer = setInterval(() => {
      try {
        const jobs = ConfigService.get().scheduledJobs ?? []
        if (cronSignature(jobs) !== _activeSignature) {
          this._rescheduleAll(jobs)
          Logger.info('Scheduler', 'Schedules changed on disk - reloaded')
        }
        const snap = JSON.stringify(jobs)
        if (snap !== _lastSnapshot) emit(jobs)
      } catch { /* config mid-write */ }
    }, WATCH_MS)
  },

  _rescheduleAll(jobs: ScheduledJob[]): void {
    for (const t of tasks.values()) t.stop()
    tasks.clear()
    for (const job of jobs) {
      if (job.enabled) this._schedule(job)
    }
    _activeSignature = cronSignature(jobs)
  },

  _schedule(job: ScheduledJob): void {
    if (!cron.validate(job.cronExpr)) {
      Logger.warn('Scheduler', `Invalid cron for "${job.name}": ${job.cronExpr}`)
      return
    }
    const task = cron.schedule(job.cronExpr, () => {
      const fresh = this.list().find(j => j.id === job.id)
      if (!fresh?.enabled) return
      if (this.engineStatus().external) {
        Logger.info('Scheduler', `"${fresh.name}" is handled by the 24/7 engine - skipping local run`)
        return
      }
      void this._execute(fresh)
    })
    tasks.set(job.id, task)
    Logger.info('Scheduler', `Scheduled "${job.name}" [${job.cronExpr}]`)
  },

  _updateStatus(id: string, patch: Partial<ScheduledJob>): void {
    const jobs = this.list()
    const idx = jobs.findIndex(j => j.id === id)
    if (idx < 0) return
    jobs[idx] = { ...jobs[idx], ...patch }
    ConfigService.set({ scheduledJobs: jobs })
    emit(jobs)
  },

  async _execute(job: ScheduledJob): Promise<void> {
    Logger.session('Scheduler', `Running job "${job.name}"`)
    this._updateStatus(job.id, { lastRun: new Date().toISOString(), lastStatus: 'running' })

    try {
      let uploaded = 0
      let errors = 0
      const appliedItems = new Map<string, { key: string; title: string; year?: number; type: 'movie' | 'show' | 'collection'; libraryTitle: string; source: 'mediux' | 'posterdb'; thumb?: string; thumbIsMain: boolean; posterUrls: string[] }>()

      for (const url of job.urls) {
        try {
          const posters = await ScraperFactory.scrapeUrl(url, () => {})
          for (const poster of posters) {
            try {
              let itemKey: string
              let title: string
              let year: number | undefined
              let itemType: 'movie' | 'show' | 'collection'
              let libraryTitle: string

              if (poster.isCollection) {
                const coll = await PlexService.findCollection({ title: poster.title })
                if (!coll) continue
                itemKey = coll.key
                title = coll.title
                itemType = 'collection'
                libraryTitle = coll.libraryTitle
              } else {
                const item = await PlexService.findInLibrary({
                  title: poster.title,
                  year: poster.year,
                  libraries: [],
                  tmdbId: poster.tmdbId,
                })
                if (!item) continue
                itemKey = item.key
                title = item.title
                year = item.year
                itemType = item.type === 'movie' ? 'movie' : 'show'
                libraryTitle = item.libraryTitle
              }

              const res = await PlexService.uploadPoster({
                itemKey,
                imageUrl: poster.url,
                source: poster.source,
                season: poster.season,
                episode: poster.episode,
                isCollection: poster.isCollection,
              })
              if (res.success) {
                uploaded++
                const isMain = poster.season == null && poster.episode == null
                const thumb  = poster.thumbUrl ?? poster.url
                const existing = appliedItems.get(itemKey)
                if (existing) {
                  existing.posterUrls.push(poster.url)
                  if ((isMain && !existing.thumbIsMain) || !existing.thumb) {
                    existing.thumb = thumb
                    existing.thumbIsMain = existing.thumbIsMain || isMain
                  }
                } else {
                  appliedItems.set(itemKey, {
                    key: itemKey, title, year,
                    type: itemType,
                    libraryTitle, source: poster.source,
                    thumb, thumbIsMain: isMain, posterUrls: [poster.url],
                  })
                }
              }
            } catch { errors++ }
          }
        } catch (err) {
          errors++
          Logger.warn('Scheduler', `URL failed in job "${job.name}": ${err instanceof Error ? err.message : err}`)
        }
      }

      if (appliedItems.size) {
        const existing = ConfigService.get().appliedPosters ?? []
        const now = new Date().toISOString()
        const fresh = [...appliedItems.values()].map(i => ({
          itemKey: i.key, title: i.title, year: i.year, type: i.type,
          source: i.source, libraryTitle: i.libraryTitle,
          thumb: i.thumb, posterUrls: i.posterUrls, appliedAt: now,
        }))
        const keys = new Set(fresh.map(f => f.itemKey))
        ConfigService.set({ appliedPosters: [...fresh, ...existing.filter(r => !keys.has(r.itemKey))].slice(0, 2000) })
      }

      const summary = `${uploaded} poster${uploaded !== 1 ? 's' : ''} uploaded` + (errors ? `, ${errors} error${errors !== 1 ? 's' : ''}` : '')
      Logger.success('Scheduler', `Job "${job.name}" done - ${summary}`)
      this._updateStatus(job.id, { lastStatus: 'success', lastError: undefined })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      Logger.error('Scheduler', `Job "${job.name}" failed: ${msg}`)
      this._updateStatus(job.id, { lastStatus: 'error', lastError: msg })
    }
  },
}
