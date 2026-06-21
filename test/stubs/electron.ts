// Minimal `electron` stub so main-process modules (config.ts, and anything that
// transitively imports it) can be imported by Vitest under plain Node.
//
// Only the surface area the unit tests actually reach is implemented. The one
// piece that matters for real-filesystem tests: `app.getPath('userData')` is
// redirected to a per-test temp directory so config.ts's settings.json — and
// therefore getProjectsRoot() / getHubDir() — land in an isolated location the
// test controls. See test/helpers/fixture.ts (setUserDataDir) for how tests set it.
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Tests override this via setUserDataDir() before exercising config/store.
let userDataDir: string | undefined

/** Test helper: point app.getPath('userData') at a real temp dir. */
export function setUserDataDir(dir: string | undefined): void {
  userDataDir = dir
}

export const app = {
  getPath(name: string): string {
    if (name === 'userData') return userDataDir ?? join(tmpdir(), 'projecthub-test-userdata')
    // Everything else is unused by the modules under test.
    return join(tmpdir(), `projecthub-test-${name}`)
  },
  getAppPath(): string {
    return process.cwd()
  },
  isPackaged: false,
  getVersion(): string {
    return '0.0.0-test'
  }
}

// Stubs for symbols imported (but never exercised) by modules reachable from
// the code under test. ipc.ts/updater.ts pull these in, but the store/scan
// tests never touch them — present enough shape to keep imports from throwing.
export const BrowserWindow = Object.assign(function () {}, {
  fromWebContents: () => null,
  getAllWindows: () => []
})
export const ipcMain = { handle: () => {}, on: () => {} }
export const dialog = { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) }
export const shell = {
  openExternal: () => Promise.resolve(),
  openPath: () => Promise.resolve(''),
  showItemInFolder: () => {},
  trashItem: () => Promise.resolve()
}
