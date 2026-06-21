import { ipcMain, shell, clipboard, dialog, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { renameSync } from 'node:fs'
import { join, basename } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { IPC, type CreateProjectRequest } from '@shared/types'
import { scanProjects, guessDevPorts, scaffoldTemplate, resolveDevCommand } from './scan'
import {
  getMetadata,
  saveMetadata,
  getPinned,
  togglePinned,
  trashProject,
  listTrash,
  restoreProject,
  emptyTrash,
  moveToArchive
} from './store'
import { getProjectsRoot } from './config'

/** Quick TCP probe — resolves true if something is listening. */
function portAlive(port: number, host = '127.0.0.1', timeout = 350): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host })
    const t = setTimeout(() => {
      sock.destroy()
      resolve(false)
    }, timeout)
    sock.on('connect', () => {
      clearTimeout(t)
      sock.destroy()
      resolve(true)
    })
    sock.on('error', () => {
      clearTimeout(t)
      sock.destroy()
      resolve(false)
    })
  })
}

/** Try to detect a running dev server for a project and open it. */
async function launchDevServer(dir: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const ports = guessDevPorts(dir)
  for (const port of ports) {
    if (await portAlive(port)) {
      const url = `http://localhost:${port}`
      await shell.openExternal(url)
      return { ok: true, message: `Opened ${url}`, url }
    }
  }
  return { ok: false, message: 'No running dev server detected on common ports.' }
}

/** Metadata store keys are normalized to Windows-style backslash paths. */
function normalizeKey(p: string): string {
  return p.replace(/\//g, '\\')
}

/**
 * Spawn a dev command in its own independent terminal window so the user can
 * see logs and stop it with Ctrl+C. The launched terminal is detached from
 * ProjectHub and survives the app closing.
 */
function spawnDevTerminal(command: string, cwd: string, title: string): void {
  if (process.platform === 'win32') {
    // `cmd /s /c "<line>"` + windowsVerbatimArguments is the robust pattern
    // for running a complex line via cmd.exe without Node re-quoting it.
    // `start "title" /D "cwd" cmd /k <command>` opens a new console window,
    // cds into the project, runs the command, and stays open (/k).
    const line = `start "${title}" /D "${cwd}" cmd /k ${command}`
    spawn('cmd.exe', ['/d', '/s', '/c', line], {
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsVerbatimArguments: true
    }).unref()
  } else if (process.platform === 'darwin') {
    const inner = `cd ${shellQuote(cwd)} && ${command}; exec $SHELL`
    const escaped = inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    spawn(
      'osascript',
      ['-e', 'tell application "Terminal" to activate', '-e', `tell application "Terminal" to do script "${escaped}"`],
      { detached: true, stdio: 'ignore' }
    ).unref()
  } else {
    // Linux: try the common terminal emulators in turn.
    const inner = `cd ${shellQuote(cwd)} && ${command}; exec $SHELL`
    const sh = `gnome-terminal -- bash -lc ${shellQuote(inner)} 2>/dev/null || konsole -e bash -lc ${shellQuote(inner)} 2>/dev/null || xterm -e ${shellQuote(inner)}`
    spawn('sh', ['-c', sh], { detached: true, stdio: 'ignore' }).unref()
  }
}

/** POSIX-style quoting for embedding a single arg inside a shell line. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\''`)}'`
}

/**
 * Poll a project's likely ports in the background; once a dev server answers,
 * open the browser and toast. Fires-and-forgets — never blocks the IPC call.
 */
function pollAndOpen(win: BrowserWindow | null, ports: number[], name: string): void {
  const deadline = Date.now() + 20_000
  const tick = async () => {
    if (!win || win.isDestroyed()) return
    for (const port of ports) {
      if (await portAlive(port)) {
        const url = `http://localhost:${port}`
        await shell.openExternal(url)
        toast(win, '🚀', `${name} is ready — opening ${url}`, 'success')
        return
      }
    }
    if (Date.now() < deadline) {
      setTimeout(tick, 700)
    } else {
      toast(win, '▶️', `${name} is still starting — use Launch once it's ready.`, 'info')
    }
  }
  setTimeout(tick, 1200)
}

function toast(win: BrowserWindow | null, icon: string, message: string, type: 'success' | 'info' | 'error' = 'info') {
  if (!win || win.isDestroyed()) return
  win.webContents.send('toast', { id: `${Date.now()}-${Math.random()}`, icon, message, type })
}

export function registerIpc(): void {
  ipcMain.handle(IPC.SCAN, async () => {
    const metadata = getMetadata()
    const pinned = getPinned()
    const projects = scanProjects({ metadata, pinned })
    return { projects, root: getProjectsRoot(), scannedAt: Date.now() }
  })

  ipcMain.handle(IPC.LAUNCH, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await launchDevServer(path)
    if (!res.ok) {
      // fall back to opening VS Code so the user can start it
      toast(win, '🚀', 'No dev server found — opening in VS Code.', 'info')
      spawn('code', [path], { detached: true, shell: true, stdio: 'ignore' }).unref()
      return { ok: true, message: 'Opened VS Code (no dev server detected).' }
    }
    toast(win, '🚀', res.message, 'success')
    return res
  })

  ipcMain.handle(IPC.START, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const meta = getMetadata()[normalizeKey(path)] || {}
    const command = resolveDevCommand(path, meta)
    if (!command) {
      toast(
        win,
        '▶️',
        "No dev command found — add scripts.dev to this project's metadata.",
        'error'
      )
      return { ok: false, message: 'No dev command found' }
    }
    const name = meta.name || basename(path)
    const ports = guessDevPorts(path)

    // Already running? Just open the browser.
    for (const port of ports) {
      if (await portAlive(port)) {
        const url = `http://localhost:${port}`
        await shell.openExternal(url)
        toast(win, '🚀', `${name} is already running — opening ${url}`, 'success')
        return { ok: true, message: `Already running at ${url}`, url }
      }
    }

    spawnDevTerminal(command, path, `${name} — dev`)
    toast(win, '▶️', `Starting ${name} (running \u201c${command}\u201d)…`, 'info')
    pollAndOpen(win, ports, name)
    return { ok: true, message: `Starting ${name}` }
  })

  ipcMain.handle(IPC.OPEN_VSCODE, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    try {
      spawn('code', [path], { detached: true, shell: true, stdio: 'ignore' }).unref()
      toast(win, '💻', 'Opening in VS Code…', 'info')
      return { ok: true, message: 'Opened VS Code' }
    } catch (err: any) {
      toast(win, '💻', `Failed: ${err.message}`, 'error')
      return { ok: false, message: err.message }
    }
  })

  ipcMain.handle(IPC.OPEN_EXPLORER, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const err = await shell.openPath(path)
    if (err) {
      toast(win, '📂', `Failed: ${err}`, 'error')
      return { ok: false, message: err }
    }
    toast(win, '📂', 'Opening folder…', 'info')
    return { ok: true, message: 'Opened folder' }
  })

  ipcMain.handle(IPC.REVEAL_IN_EXPLORER, async (e, path: string) => {
    shell.showItemInFolder(path)
    return { ok: true, message: 'Revealed in Explorer' }
  })

  ipcMain.handle(IPC.COPY_PATH, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    clipboard.writeText(path)
    toast(win, '📋', 'Path copied to clipboard', 'success')
    return { ok: true, message: 'Copied' }
  })

  ipcMain.handle(IPC.DELETE, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    try {
      const entry = trashProject(path)
      toast(win, '🗑️', `“${entry.name}” moved to Trash`, 'info')
      return { ok: true, message: `Moved to trash: ${entry.name}` }
    } catch (err: any) {
      toast(win, '🗑️', `Failed: ${err.message}`, 'error')
      return { ok: false, message: err.message }
    }
  })

  ipcMain.handle(IPC.TRASH_LIST, async () => listTrash())

  ipcMain.handle(IPC.TRASH_RESTORE, async (e, id: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    try {
      const entry = restoreProject(id)
      toast(win, '↩️', `Restored “${entry.name}”`, 'success')
      return { ok: true, message: `Restored ${entry.name}` }
    } catch (err: any) {
      toast(win, '↩️', `Failed: ${err.message}`, 'error')
      return { ok: false, message: err.message }
    }
  })

  ipcMain.handle(IPC.TRASH_EMPTY, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const count = emptyTrash()
    toast(win, '🗑️', `Permanently deleted ${count} item(s)`, 'info')
    return { ok: true, message: `Emptied ${count}`, count }
  })

  ipcMain.handle(IPC.CREATE, async (e, req: CreateProjectRequest) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const root = getProjectsRoot()
    const parent = req.parent && req.parent.trim() ? join(root, req.parent) : root
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
    const target = join(parent, req.name)
    if (existsSync(target)) {
      toast(win, '✨', `“${req.name}” already exists`, 'error')
      return { path: target, created: false, message: 'Already exists' }
    }
    mkdirSync(target, { recursive: true })
    scaffoldTemplate(target, req.template)
    if (req.openAfter) {
      spawn('code', [target], { detached: true, shell: true, stdio: 'ignore' }).unref()
    }
    toast(win, '✨', `Created “${req.name}”`, 'success')
    return { path: target, created: true, message: 'Created' }
  })

  ipcMain.handle(IPC.MOVE, async (e, req: { sourcePath: string }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      title: 'Move project to…',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) {
      return { fromPath: req.sourcePath, toPath: '', moved: false, message: 'Cancelled' }
    }
    const dest = res.filePaths[0]
    const name = basename(req.sourcePath)
    const target = join(dest, name)
    if (existsSync(target)) {
      toast(win, '📦', `Destination already has “${name}”`, 'error')
      return { fromPath: req.sourcePath, toPath: target, moved: false, message: 'Destination exists' }
    }
    try {
      renameSync(req.sourcePath, target)
      toast(win, '📦', `Moved to ${dest}`, 'success')
      return { fromPath: req.sourcePath, toPath: target, moved: true, message: 'Moved' }
    } catch (err: any) {
      toast(win, '📦', `Failed: ${err.message}`, 'error')
      return { fromPath: req.sourcePath, toPath: '', moved: false, message: err.message }
    }
  })

  ipcMain.handle(IPC.MOVE_TO_ARCHIVE, async (e, path: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    try {
      const { toPath } = moveToArchive(path)
      toast(win, '📦', `Archived “${basename(path)}”`, 'success')
      return { ok: true, message: toPath }
    } catch (err: any) {
      toast(win, '📦', `Failed: ${err.message}`, 'error')
      return { ok: false, message: err.message }
    }
  })

  ipcMain.handle(IPC.METADATA_GET, async () => getMetadata())
  ipcMain.handle(IPC.METADATA_SAVE, async (_e, data) => {
    saveMetadata(data)
    return { ok: true }
  })

  ipcMain.handle(IPC.PINNED_GET, async () => getPinned())
  ipcMain.handle(IPC.PINNED_TOGGLE, async (_e, path: string) => togglePinned(path))

  ipcMain.handle(IPC.SELECT_FOLDER, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose a projects root…',
      properties: ['openDirectory']
    })
    if (res.canceled) return null
    return res.filePaths[0] ?? null
  })
}
