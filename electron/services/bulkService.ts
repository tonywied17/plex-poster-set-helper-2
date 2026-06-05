import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { Logger } from './logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bulkDir(): string {
  const dir = path.join(app.getPath('userData'), 'bulk-files')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function filePath(filename: string): string {
  // Sanitise — strip any path separators, ensure .txt extension
  const safe = path.basename(filename).replace(/[/\\]/g, '')
  return path.join(bulkDir(), safe.endsWith('.txt') ? safe : `${safe}.txt`)
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const BulkService = {
  list(): string[] {
    try {
      return fs
        .readdirSync(bulkDir())
        .filter(f => f.endsWith('.txt'))
        .sort((a, b) => a.localeCompare(b))
    } catch (err) {
      Logger.error('Bulk', `list failed: ${err}`)
      return []
    }
  },

  read(filename: string): string[] {
    try {
      const raw = fs.readFileSync(filePath(filename), 'utf8')
      return raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
    } catch (err) {
      Logger.warn('Bulk', `read "${filename}" failed: ${err}`)
      return []
    }
  },

  write(filename: string, lines: string[]): void {
    try {
      fs.writeFileSync(filePath(filename), lines.join('\n'), 'utf8')
      Logger.info('Bulk', `Saved "${filename}" (${lines.length} lines)`)
    } catch (err) {
      Logger.error('Bulk', `write "${filename}" failed: ${err}`)
      throw err
    }
  },

  create(filename: string): void {
    const fp = filePath(filename)
    if (fs.existsSync(fp)) throw new Error(`File "${filename}" already exists`)
    fs.writeFileSync(fp, '', 'utf8')
    Logger.info('Bulk', `Created "${filename}"`)
  },

  delete(filename: string): void {
    try {
      fs.unlinkSync(filePath(filename))
      Logger.info('Bulk', `Deleted "${filename}"`)
    } catch (err) {
      Logger.error('Bulk', `delete "${filename}" failed: ${err}`)
      throw err
    }
  },

  rename(oldName: string, newName: string): void {
    const oldPath = filePath(oldName)
    const newPath = filePath(newName)
    if (fs.existsSync(newPath)) throw new Error(`File "${newName}" already exists`)
    fs.renameSync(oldPath, newPath)
    Logger.info('Bulk', `Renamed "${oldName}" → "${newName}"`)
  },
}
