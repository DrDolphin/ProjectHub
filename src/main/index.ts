import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { getHubDir } from './config'
import { ensureManifestSchema } from './store'
import { initUpdater, registerUpdaterIpc } from './updater'

// Ensure the hub data dir exists on boot, and that the project-manifest schema
// is present so each project's `manifest.json` "$schema" reference resolves.
getHubDir()
ensureManifestSchema()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'ProjectHub',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the user's browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // electron-vite dev server / production build
  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  registerUpdaterIpc()
  createWindow()
  initUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
