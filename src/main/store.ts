import { existsSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ProjectMeta, TrashEntry } from '@shared/types'
import {
  getMetadataPath,
  getPinnedPath,
  getManifestPath,
  getManifestSchemaPath,
  getTrashDir,
  getSeedMetadataPath,
  getProjectsRoot
} from './config'

function readJson<T>(file: string, fallback: T): T {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    /* ignore */
  }
  return fallback
}

function writeJson(file: string, data: unknown): void {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

const normalizeKey = (p: string) => p.replace(/\//g, '\\')

// ---------------- METADATA ----------------

export function getMetadata(): Record<string, ProjectMeta> {
  const file = getMetadataPath()
  if (!existsSync(file)) {
    // First run: seed from bundled seed file if present
    const seed = getSeedMetadataPath()
    if (existsSync(seed)) {
      try {
        const seeded = JSON.parse(readFileSync(seed, 'utf8')) as Record<string, ProjectMeta>
        // normalize keys to absolute paths under current root
        const root = getProjectsRoot()
        const out: Record<string, ProjectMeta> = {}
        for (const [k, v] of Object.entries(seeded)) {
          const abs = k.includes(':') ? k : join(root, k)
          out[normalizeKey(abs)] = v
        }
        writeJson(file, out)
        return out
      } catch {
        /* ignore */
      }
    }
    writeJson(file, {})
    return {}
  }
  return readJson<Record<string, ProjectMeta>>(file, {})
}

export function saveMetadata(data: Record<string, ProjectMeta>): void {
  const normalized: Record<string, ProjectMeta> = {}
  for (const [k, v] of Object.entries(data)) normalized[normalizeKey(k)] = v
  writeJson(getMetadataPath(), normalized)
}

// ---------------- MANIFEST SCHEMA ----------------

/**
 * The contract for a per-project `manifest.json`, kept in sync with the fields
 * ProjectHub reads in scan.ts (readManifestMeta). Mirrors ProjectMeta plus the
 * grouping-folder convention.
 */
const MANIFEST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'projecthub/manifest.schema.json',
  title: 'ProjectHub Project Manifest',
  description:
    'Per-project descriptor read by ProjectHub to identify a folder as a project and show its info.',
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    name: { type: 'string', description: 'Display name (defaults to the folder name).' },
    type: {
      type: 'string',
      description:
        'Human label for the kind of project, e.g. "Next.js app". Use "Grouping folder" to mark a container whose child folders are the real projects.'
    },
    description: { type: 'string' },
    stack: { type: 'string', description: 'Comma-separated tech stack, e.g. "TypeScript, React, Vite".' },
    status: {
      type: 'string',
      description:
        'Project status. Canonical buckets: active, planning, spec, testing, oneoff, empty, archived, unknown.'
    },
    note: { type: 'string', description: 'Short freeform note shown on the project card.' },
    scripts: {
      type: 'object',
      description: 'Commands surfaced by ProjectHub (overrides package.json detection).',
      properties: {
        dev: { type: 'string' },
        build: { type: 'string' },
        start: { type: 'string' },
        test: { type: 'string' }
      },
      additionalProperties: { type: 'string' }
    }
  },
  additionalProperties: true
} as const

/**
 * Write the manifest schema into the hub dir if absent, so the `$schema`
 * reference project manifests carry resolves. Idempotent; safe to call on boot.
 */
export function ensureManifestSchema(): void {
  const file = getManifestSchemaPath()
  if (existsSync(file)) return
  try {
    writeJson(file, MANIFEST_SCHEMA)
  } catch {
    /* non-fatal: schema is an editor convenience only */
  }
}

// ---------------- PINNED ----------------

export function getPinned(): string[] {
  return readJson<string[]>(getPinnedPath(), [])
}

export function togglePinned(path: string): { pinned: boolean } {
  const key = normalizeKey(path)
  const list = getPinned()
  const idx = list.indexOf(key)
  let pinned: boolean
  if (idx >= 0) {
    list.splice(idx, 1)
    pinned = false
  } else {
    list.push(key)
    pinned = true
  }
  writeJson(getPinnedPath(), list)
  return { pinned }
}

// ---------------- TRASH ----------------

function readManifest(): TrashEntry[] {
  return readJson<TrashEntry[]>(getManifestPath(), [])
}

function writeManifest(entries: TrashEntry[]): void {
  writeJson(getManifestPath(), entries)
}

export function listTrash(): TrashEntry[] {
  return readManifest().sort((a, b) => b.trashedAt - a.trashedAt)
}

/**
 * Move a project folder into the trash. Uses rename (instant on same
 * volume). The original path is recorded for one-click restore.
 */
export function trashProject(originalPath: string): TrashEntry {
  const key = normalizeKey(originalPath)
  if (!existsSync(key)) {
    throw new Error(`Folder does not exist: ${key}`)
  }
  const name = basename(key)
  const id = randomUUID()
  const trashedPath = join(getTrashDir(), `${id}__${name}`)
  renameSync(key, trashedPath)
  const entry: TrashEntry = {
    id,
    originalPath: key,
    name,
    trashedPath,
    trashedAt: Date.now()
  }
  const manifest = readManifest()
  manifest.push(entry)
  writeManifest(manifest)
  return entry
}

/** Restore a trashed project to its original path. */
export function restoreProject(id: string): TrashEntry {
  const manifest = readManifest()
  const entry = manifest.find((e) => e.id === id)
  if (!entry) throw new Error('Trash entry not found')
  // If original path is taken, restore beside it with a suffix
  let target = entry.originalPath
  if (existsSync(target)) {
    target = `${entry.originalPath}.restored-${Date.now()}`
  }
  renameSync(entry.trashedPath, target)
  entry.originalPath = target
  writeManifest(manifest.filter((e) => e.id !== id))
  return entry
}

/** Permanently delete a single trash entry. */
export function purgeEntry(id: string): void {
  const manifest = readManifest()
  const entry = manifest.find((e) => e.id === id)
  if (!entry) return
  if (existsSync(entry.trashedPath)) rmSync(entry.trashedPath, { recursive: true, force: true })
  writeManifest(manifest.filter((e) => e.id !== id))
}

/** Permanently delete ALL trashed items. Returns count removed. */
export function emptyTrash(): number {
  const manifest = readManifest()
  const count = manifest.length
  for (const entry of manifest) {
    if (existsSync(entry.trashedPath)) rmSync(entry.trashedPath, { recursive: true, force: true })
  }
  // Sweep any orphaned folders left in trash dir
  try {
    for (const name of readdirSync(getTrashDir())) {
      const p = join(getTrashDir(), name)
      try {
        rmSync(p, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  writeManifest([])
  return count
}

/** Move a project into the .archive grouping folder. */
export function moveToArchive(sourcePath: string): { toPath: string } {
  const key = normalizeKey(sourcePath)
  const name = basename(key)
  const archiveDir = join(getProjectsRoot(), '.archive')
  if (!existsSync(archiveDir)) {
    const { mkdirSync } = require('node:fs')
    mkdirSync(archiveDir, { recursive: true })
  }
  let target = join(archiveDir, name)
  if (existsSync(target)) target = join(archiveDir, `${name}-${Date.now()}`)
  renameSync(key, target)
  return { toPath: target }
}
