import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { Logger } from './logger'

/**
 * Returns the bulk-files directory under userData, creating it if needed.
 *
 * @returns Absolute path to the directory.
 */
function bulkDir(): string {
  const dir = path.join(app.getPath('userData'), 'bulk-files')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Resolves a sanitised absolute path for a bulk file.
 *
 * @param filename - User-supplied name; path separators are stripped and a
 *   .txt extension is enforced.
 * @returns Absolute path inside the bulk-files directory.
 */
function filePath(filename: string): string {
  const safe = path.basename(filename).replace(/[/\\]/g, '')
  return path.join(bulkDir(), safe.endsWith('.txt') ? safe : `${safe}.txt`)
}

/** Manages the plain-text bulk URL files stored in the app's userData directory. */
export const BulkService = {
  /**
   * Lists all bulk .txt filenames.
   *
   * @returns Sorted filenames, or an empty list on failure.
   */
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

  /**
   * Reads a bulk file.
   *
   * @param filename - File to read.
   * @returns Its non-empty trimmed lines, or an empty list when unreadable.
   */
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

  /**
   * Overwrites a bulk file with the given lines.
   *
   * @param filename - File to write.
   * @param lines - Replacement content, one URL per line.
   */
  write(filename: string, lines: string[]): void {
    try {
      fs.writeFileSync(filePath(filename), lines.join('\n'), 'utf8')
      Logger.info('Bulk', `Saved "${filename}" (${lines.length} lines)`)
    } catch (err) {
      Logger.error('Bulk', `write "${filename}" failed: ${err}`)
      throw err
    }
  },

  /**
   * Creates an empty bulk file; throws if it already exists.
   *
   * @param filename - Name for the new file.
   */
  create(filename: string): void {
    const fp = filePath(filename)
    if (fs.existsSync(fp)) throw new Error(`File "${filename}" already exists`)
    fs.writeFileSync(fp, '', 'utf8')
    Logger.info('Bulk', `Created "${filename}"`)
  },

  /**
   * Deletes a bulk file.
   *
   * @param filename - File to remove.
   */
  delete(filename: string): void {
    try {
      fs.unlinkSync(filePath(filename))
      Logger.info('Bulk', `Deleted "${filename}"`)
    } catch (err) {
      Logger.error('Bulk', `delete "${filename}" failed: ${err}`)
      throw err
    }
  },

  /**
   * Renames a bulk file; throws if the target name already exists.
   *
   * @param oldName - Existing file.
   * @param newName - New name to give it.
   */
  rename(oldName: string, newName: string): void {
    const oldPath = filePath(oldName)
    const newPath = filePath(newName)
    if (fs.existsSync(newPath)) throw new Error(`File "${newName}" already exists`)
    fs.renameSync(oldPath, newPath)
    Logger.info('Bulk', `Renamed "${oldName}" → "${newName}"`)
  },
}
