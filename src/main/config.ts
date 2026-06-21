import { app } from 'electron'
import { join, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * All persistent app state lives under <projectsRoot>\.projecthub\ so it
 * stays on the SAME volume as the projects (instant rename-based trash)
 * and is easy to find / back up.
 *
 *   <root>\.projecthub\
 *     ├── settings.json     (projectsRoot override)
 *     ├── metadata.json     (curated notes keyed by path)
 *     ├── pinned.json       (pinned paths)
 *     ├── manifest.json     (trash manifest)
 *     └── trash\<items>     (trashed folders)
 */

export interface Settings {
  projectsRoot: string
  deepseekApiKey: string
}

const DEFAULT_ROOT = 'D:\\Projects'

function readSettings(): Settings {
  // settings.json always lives in userData so we can find the root before
  // knowing the root.
  const file = join(app.getPath('userData'), 'settings.json')
  try {
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const settings: Settings = { projectsRoot: DEFAULT_ROOT, deepseekApiKey: '' }
      if (typeof raw.projectsRoot === 'string' && raw.projectsRoot.trim()) {
        settings.projectsRoot = raw.projectsRoot
      }
      if (typeof raw.deepseekApiKey === 'string') {
        settings.deepseekApiKey = raw.deepseekApiKey
      }
      return settings
    }
  } catch {
    /* fall through to default */
  }
  return { projectsRoot: DEFAULT_ROOT, deepseekApiKey: '' }
}

let cached: Settings | null = null

export function getSettings(): Settings {
  if (!cached) cached = readSettings()
  return cached
}

export function setProjectsRoot(root: string): void {
  const s = getSettings()
  cached = { ...s, projectsRoot: root }
  writeSettings()
}

function writeSettings(): void {
  const file = join(app.getPath('userData'), 'settings.json')
  writeFileSync(file, JSON.stringify(getSettings(), null, 2), 'utf8')
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const current = getSettings()
  cached = { ...current, ...partial }
  writeSettings()
  return cached
}

export function getProjectsRoot(): string {
  return getSettings().projectsRoot
}

/** The hidden app-data dir, on the same volume as the projects root. */
export function getHubDir(): string {
  const root = getProjectsRoot()
  const dir = join(root, '.projecthub')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const trash = join(dir, 'trash')
  if (!existsSync(trash)) mkdirSync(trash, { recursive: true })
  return dir
}

export function getTrashDir(): string {
  return join(getHubDir(), 'trash')
}

export function getMetadataPath(): string {
  return join(getHubDir(), 'metadata.json')
}

export function getPinnedPath(): string {
  return join(getHubDir(), 'pinned.json')
}

export function getManifestPath(): string {
  return join(getHubDir(), 'manifest.json')
}

/**
 * JSON Schema describing a per-project `manifest.json`. Lives in the hub dir so
 * the `"$schema": "../.projecthub/manifest.schema.json"` reference that
 * project manifests carry resolves for editor validation.
 */
export function getManifestSchemaPath(): string {
  return join(getHubDir(), 'manifest.schema.json')
}

/** Resolve a bundled seed file from the app source/resources. */
export function getSeedMetadataPath(): string {
  // In dev: <app>/resources/metadata.seed.json
  // In prod: packaged under resources/
  return resolve(app.getAppPath(), 'resources', 'metadata.seed.json')
}
