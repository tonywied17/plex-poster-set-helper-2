import winston from 'winston'
import path from 'path'
import fs from 'fs'
import type { BrowserWindow } from 'electron'
import type { LogEntry } from '../ipc/types'
import { getLogPath } from '../runtime/paths'
import { appEvents } from '../runtime/events'

const CUSTOM_LEVELS = {
  levels: { error: 0, warn: 1, info: 2, success: 3, session: 4, scrape: 5, debug: 6, verbose: 7 },
  colors: { error: 'red', warn: 'yellow', info: 'cyan', success: 'green', session: 'magenta', scrape: 'blue', debug: 'white', verbose: 'gray' },
}

let logger: winston.Logger
let mainWindowRef: BrowserWindow | null = null
const buffer: LogEntry[] = []
const MAX_BUFFER = 600

function streamToClients(entry: LogEntry) {
  appEvents.emitEvent('log:stream', entry)
  const win = mainWindowRef
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('log:stream', entry)
  }
}

/** Winston-backed logger that streams entries to clients and keeps a bounded in-memory history. */
export const Logger = {
  init(win: BrowserWindow | null) {
    mainWindowRef = win
    const logDir = getLogPath()

    logger = winston.createLogger({
      levels: CUSTOM_LEVELS.levels,
      level: 'verbose',
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 3,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ colors: CUSTOM_LEVELS.colors }),
            winston.format.simple()
          ),
        }),
      ],
    })

    logger.on('data', (chunk: LogEntry) => {
      streamToClients(chunk)
    })
  },

  log(level: LogEntry['level'], module: string, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = { ts: new Date().toISOString(), level, module, message, meta }
    const write = logger as unknown as Record<string, ((msg: string, meta?: object) => void) | undefined> | undefined
    write?.[level]?.(message, { module, ...meta })
    buffer.push(entry)
    if (buffer.length > MAX_BUFFER) buffer.shift()
    streamToClients(entry)
  },

  getHistory(): LogEntry[] {
    return [...buffer]
  },

  clear() {
    buffer.length = 0
    try {
      fs.truncateSync(path.join(getLogPath(), 'app.log'), 0)
    } catch {
      /* file may not exist yet */
    }
    Logger.info('logger', 'Logs cleared')
  },

  error: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('error', module, msg, meta),
  warn: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('warn', module, msg, meta),
  info: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('info', module, msg, meta),
  success: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('success', module, msg, meta),
  debug: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('debug', module, msg, meta),
  scrape: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('scrape', module, msg, meta),
  session: (module: string, msg: string, meta?: Record<string, unknown>) => Logger.log('session', module, msg, meta),
}
