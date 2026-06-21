import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ProjectHubApi } from '@shared/types'

const api: ProjectHubApi = {
  scan: () => ipcRenderer.invoke(IPC.SCAN),
  launch: (path) => ipcRenderer.invoke(IPC.LAUNCH, path),
  startServer: (path) => ipcRenderer.invoke(IPC.START, path),
  openVSCode: (path) => ipcRenderer.invoke(IPC.OPEN_VSCODE, path),
  openExplorer: (path) => ipcRenderer.invoke(IPC.OPEN_EXPLORER, path),
  revealInExplorer: (path) => ipcRenderer.invoke(IPC.REVEAL_IN_EXPLORER, path),
  copyPath: (path) => ipcRenderer.invoke(IPC.COPY_PATH, path),
  deleteProject: (path) => ipcRenderer.invoke(IPC.DELETE, path),
  trashList: () => ipcRenderer.invoke(IPC.TRASH_LIST),
  trashRestore: (id) => ipcRenderer.invoke(IPC.TRASH_RESTORE, id),
  trashEmpty: () => ipcRenderer.invoke(IPC.TRASH_EMPTY),
  createProject: (req) => ipcRenderer.invoke(IPC.CREATE, req),
  moveProject: (req) => ipcRenderer.invoke(IPC.MOVE, req),
  moveToArchive: (path) => ipcRenderer.invoke(IPC.MOVE_TO_ARCHIVE, path),
  metadataGet: () => ipcRenderer.invoke(IPC.METADATA_GET),
  metadataSave: (data) => ipcRenderer.invoke(IPC.METADATA_SAVE, data),
  pinnedGet: () => ipcRenderer.invoke(IPC.PINNED_GET),
  pinnedToggle: (path) => ipcRenderer.invoke(IPC.PINNED_TOGGLE, path),
  selectFolder: () => ipcRenderer.invoke(IPC.SELECT_FOLDER),
  getUpdateStatus: () => ipcRenderer.invoke(IPC.UPDATE_GET_STATUS),
  checkForUpdates: () => ipcRenderer.invoke(IPC.UPDATE_CHECK),
  installUpdate: () => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
  onUpdateStatus: (cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload)
    ipcRenderer.on(IPC.UPDATE_STATUS, listener)
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATUS, listener)
  },
  getVersion: () => ipcRenderer.invoke(IPC.GET_VERSION),
  settingsGet: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  settingsSet: (partial) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
  deepseekChat: (req) => ipcRenderer.invoke(IPC.DEEPSEEK_CHAT, req),
  onToast: (cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload)
    ipcRenderer.on('toast', listener)
    return () => ipcRenderer.removeListener('toast', listener)
  }
}

contextBridge.exposeInMainWorld('projectHub', api)
