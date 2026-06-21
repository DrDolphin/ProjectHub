import { app, BrowserWindow, ipcMain } from 'electron'
// electron-updater is CommonJS and exports `autoUpdater` via an
// Object.defineProperty getter, which Node's ESM loader cannot statically
// detect as a named export. Importing it as `import { autoUpdater }` crashes
// the packaged ESM main process at launch ("Named export 'autoUpdater' not
// found"). Default-import the namespace and destructure at runtime instead.
import electronUpdater from 'electron-updater'
import { IPC, type UpdateStatus } from '@shared/types'

const { autoUpdater } = electronUpdater

/**
 * Auto-update via GitHub Releases.
 *
 * electron-builder embeds a `app-update.yml` (owner/repo from electron-builder.yml's
 * `publish` block) into the packaged app, which electron-updater reads to know where
 * to look. In dev there is no such file, so every path here is a no-op unless
 * `app.isPackaged` — letting `electron-vite dev` run without throwing.
 */

/** Re-check interval while the app is open (1 hour). */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

let current: UpdateStatus = { state: 'idle' }
let initialized = false

/** Broadcast the latest status to every renderer window. */
function broadcast(status: UpdateStatus): void {
  current = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATE_STATUS, status)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return current
}

/** Wire up autoUpdater events + kick off the first check. Safe to call once. */
export function initUpdater(): void {
  if (initialized) return
  initialized = true

  // No app-update.yml in dev — nothing to do.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({ state: 'available', version: info.version ?? current.version })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({ state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      state: 'downloading',
      progress: Math.round(progress.percent),
      version: current.version
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ state: 'downloaded', version: info.version ?? current.version })
  })

  autoUpdater.on('error', (err) => {
    broadcast({ state: 'error', message: err?.message ?? String(err) })
  })

  // First check shortly after launch, then periodically.
  setTimeout(() => void checkForUpdates(), 5_000)
  setInterval(
    () => {
      if (current.state !== 'downloaded' && current.state !== 'downloading') {
        void checkForUpdates()
      }
    },
    CHECK_INTERVAL_MS
  )
}

/** Manually trigger a check (toolbar button). No-op in dev. */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    broadcast({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

/** Quit, run the NSIS updater, and relaunch. Only valid once downloaded. */
export function installUpdate(): void {
  if (current.state !== 'downloaded') return
  // setImmediate so the IPC handler returns before the app tears down.
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}

/** IPC registration for the renderer-facing update API. */
export function registerUpdaterIpc(): void {
  ipcMain.handle(IPC.UPDATE_GET_STATUS, () => getUpdateStatus())
  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    await checkForUpdates()
  })
  ipcMain.handle(IPC.UPDATE_INSTALL, () => {
    installUpdate()
  })
}
