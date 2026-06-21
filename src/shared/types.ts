// ============================================================
// Shared types + IPC contract
// These types are imported by main, preload, and renderer.
// The IPC channel names here are the single source of truth.
// ============================================================

/** Status buckets derived from metadata + detection. */
export type ProjectStatus =
  | 'active'
  | 'planning'
  | 'spec'
  | 'testing'
  | 'oneoff'
  | 'empty'
  | 'archived'
  | 'unknown'

/** Hand-curated metadata keyed by project path (metadata.json). */
export interface ProjectMeta {
  /** Display name override (defaults to folder name). */
  name?: string
  description?: string
  stack?: string
  type?: string
  status?: string
  note?: string
  /** Dev/build/start/test commands surfaced on the Launch tooltip. */
  scripts?: {
    dev?: string
    build?: string
    start?: string
    test?: string
  }
}

/** What we auto-detect from files on disk. */
export interface DetectedInfo {
  /** Stack markers found, e.g. ['TypeScript','React','Next.js']. */
  stack: string[]
  /** Manager if detectable: npm | pnpm | yarn | bun | uv | pip | cargo | go | none. */
  manager: string
  /** True if a dev script exists in package.json. */
  hasDevScript: boolean
  /** Has its own .git. */
  isGitRepo: boolean
  /** Human label for kind of project, e.g. "Next.js app". */
  kind: string
  /** Resolved dev-server command (e.g. "npm run dev"), or null if none. */
  devCommand: string | null
}

/** A folder discovered by the live scan, merged with metadata. */
export interface Project {
  /** Absolute filesystem path. Unique key. */
  path: string
  /** Folder name on disk. */
  folder: string
  /** Display name (metadata override or folder name). */
  name: string
  /** Parent folder name, if nested inside a grouping folder. */
  parent?: string
  /** Depth from the projects root (0 = top-level). */
  depth: number
  /** True if the folder still exists on disk. */
  exists: boolean
  /** True if pinned (persisted in metadata store, keyed by path). */
  pinned: boolean
  /** Curated metadata (may be partial / empty). */
  meta: ProjectMeta
  /** Auto-detected info. */
  detected: DetectedInfo
  /** Normalized status bucket. */
  status: ProjectStatus
  /** Human-readable status label. */
  statusLabel: string
}

/** A trashed project awaiting restore or permanent deletion. */
export interface TrashEntry {
  id: string
  /** Original absolute path. */
  originalPath: string
  /** Display name. */
  name: string
  /** Where it currently lives inside the .trash dir. */
  trashedPath: string
  /** Epoch ms. */
  trashedAt: number
}

export type ProjectTemplate =
  | 'empty'
  | 'node'
  | 'vite-react'
  | 'nextjs'
  | 'python'
  | 'static'

export interface CreateProjectRequest {
  name: string
  parent?: string
  template: ProjectTemplate
  openAfter?: boolean
}

export interface CreateProjectResult {
  path: string
  created: boolean
  message: string
}

export interface MoveProjectRequest {
  sourcePath: string
}

export interface MoveProjectResult {
  fromPath: string
  toPath: string
  moved: boolean
  message: string
}

export interface ScanResult {
  projects: Project[]
  root: string
  scannedAt: number
}

export interface TrashResult {
  entries: TrashEntry[]
}

export interface ToastPayload {
  id: string
  icon: string
  message: string
  type: 'success' | 'info' | 'error'
}

/** State machine for the auto-updater. */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/** Snapshot of the auto-updater, pushed to the renderer on every change. */
export interface UpdateStatus {
  state: UpdateState
  /** The new version, once one is known (available/downloading/downloaded). */
  version?: string
  /** Download percent 0–100 (downloading state). */
  progress?: number
  /** Error message (error state). */
  message?: string
}

// ------------------------------------------------------------
// IPC CHANNEL CONTRACT — keep in sync with main/index.ts and
// preload/index.ts.
// ------------------------------------------------------------

export const IPC = {
  SCAN: 'projects:scan',
  LAUNCH: 'projects:launch',
  START: 'projects:start',
  OPEN_VSCODE: 'projects:openVSCode',
  OPEN_EXPLORER: 'projects:openExplorer',
  COPY_PATH: 'projects:copyPath',
  REVEAL_IN_EXPLORER: 'projects:revealInExplorer',
  DELETE: 'projects:delete',
  TRASH_LIST: 'projects:trash:list',
  TRASH_RESTORE: 'projects:trash:restore',
  TRASH_EMPTY: 'projects:trash:empty',
  CREATE: 'projects:create',
  MOVE: 'projects:move',
  MOVE_TO_ARCHIVE: 'projects:moveToArchive',
  METADATA_GET: 'metadata:get',
  METADATA_SAVE: 'metadata:save',
  PINNED_GET: 'pinned:get',
  PINNED_TOGGLE: 'pinned:toggle',
  SELECT_FOLDER: 'dialog:selectFolder',
  // Auto-updater: status is main→renderer push; the rest are renderer→main.
  UPDATE_STATUS: 'update:status',
  UPDATE_GET_STATUS: 'update:getStatus',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install'
} as const

/** The typed API exposed on window.projectHub by the preload script. */
export interface ProjectHubApi {
  scan(): Promise<ScanResult>
  launch(path: string): Promise<{ ok: boolean; message: string; url?: string }>
  startServer(path: string): Promise<{ ok: boolean; message: string; url?: string }>
  openVSCode(path: string): Promise<{ ok: boolean; message: string }>
  openExplorer(path: string): Promise<{ ok: boolean; message: string }>
  revealInExplorer(path: string): Promise<{ ok: boolean; message: string }>
  copyPath(path: string): Promise<{ ok: boolean; message: string }>
  deleteProject(path: string): Promise<{ ok: boolean; message: string }>
  trashList(): Promise<TrashEntry[]>
  trashRestore(id: string): Promise<{ ok: boolean; message: string }>
  trashEmpty(): Promise<{ ok: boolean; message: string; count: number }>
  createProject(req: CreateProjectRequest): Promise<CreateProjectResult>
  moveProject(req: MoveProjectRequest): Promise<MoveProjectResult>
  moveToArchive(path: string): Promise<{ ok: boolean; message: string }>
  metadataGet(): Promise<Record<string, ProjectMeta>>
  metadataSave(data: Record<string, ProjectMeta>): Promise<{ ok: boolean }>
  pinnedGet(): Promise<string[]>
  pinnedToggle(path: string): Promise<{ pinned: boolean }>
  selectFolder(): Promise<string | null>
  onToast(cb: (t: ToastPayload) => void): () => void
  // Auto-updater
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateStatus(cb: (s: UpdateStatus) => void): () => void
}

declare global {
  interface Window {
    projectHub: ProjectHubApi
  }
}
