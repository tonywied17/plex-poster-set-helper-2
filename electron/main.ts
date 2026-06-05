import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { ConfigService } from './services/config'
import { Logger } from './services/logger'
import { PlexService } from './services/plexService'
import { registerPlexHandlers } from './ipc/plexHandlers'
import { registerScrapeHandlers } from './ipc/scrapeHandlers'
import { registerBulkHandlers } from './ipc/bulkHandlers'
import { registerAuthHandlers } from './ipc/authHandlers'
import { registerAppHandlers } from './ipc/appHandlers'
import { registerLogHandlers } from './ipc/logHandlers'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d0f14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../../resources/icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../src/dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Auto-reconnect from saved credentials once the renderer is interactive
  mainWindow.webContents.once('did-finish-load', () => {
    PlexService.tryRestoreFromConfig().then(connected => {
      if (connected) {
        mainWindow?.webContents.send('auth:statusChange', { status: 'authorized' })
        Logger.info('App', 'Auto-reconnected to Plex from saved config')
      }
    }).catch(() => {})
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  return mainWindow
}

async function initServices() {
  await ConfigService.init()
  Logger.init(mainWindow)
}

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', info => {
    mainWindow?.webContents.send('app:updateAvailable', info)
  })

  autoUpdater.on('download-progress', progress => {
    mainWindow?.webContents.send('app:downloadProgress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('app:updateReady')
  })
}

function registerIpcHandlers() {
  registerPlexHandlers(ipcMain)
  registerScrapeHandlers(ipcMain, mainWindow!)
  registerBulkHandlers(ipcMain)
  registerAuthHandlers(ipcMain, mainWindow!)
  registerAppHandlers(ipcMain)
  registerLogHandlers(ipcMain)
}

app.whenReady().then(async () => {
  createWindow()
  await initServices()
  registerIpcHandlers()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('open-url', (_event, url) => {
  shell.openExternal(url)
})

export { mainWindow }
