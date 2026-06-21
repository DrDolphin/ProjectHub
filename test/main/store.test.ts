import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as store from '../../src/main/store'
import type { ProjectMeta } from '@shared/types'
import { makeFixture, disposeFixture, resetHubData, type Fixture } from '../helpers/fixture'
import { setUserDataDir } from '../stubs/electron'

let f: Fixture

beforeAll(() => {
  f = makeFixture()
  setUserDataDir(f.userDataDir)
})

afterAll(() => {
  setUserDataDir(undefined)
  disposeFixture(f)
})

// Each test starts from a clean hub so file state never leaks between tests.
beforeEach(() => {
  resetHubData(f)
})

// ---------------------------------------------------------------
// Metadata persistence
// ---------------------------------------------------------------
describe('metadata', () => {
  test('saveMetadata → getMetadata round-trips the data', () => {
    const data: Record<string, ProjectMeta> = {
      [join(f.projectsRoot, 'app')]: { name: 'App', status: 'active' }
    }
    store.saveMetadata(data)
    const back = store.getMetadata()
    expect(back).toEqual(data)
  })

  test('normalizes forward-slash path keys to backslashes', () => {
    // Windows-normalized keys are the contract every consumer relies on.
    const fwd = 'D:/Projects/Foo'
    const expected = 'D:\\Projects\\Foo'
    store.saveMetadata({ [fwd]: { name: 'Foo' } })
    const keys = Object.keys(store.getMetadata())
    expect(keys).toContain(expected)
    expect(keys.some((k) => k.includes('/'))).toBe(false)
  })

  test('getMetadata returns what was saved (not a stale read)', () => {
    store.saveMetadata({ [join(f.projectsRoot, 'a')]: { note: 'first' } })
    store.saveMetadata({ [join(f.projectsRoot, 'b')]: { note: 'second' } })
    // Second save fully replaces the first (writeJson overwrites the file).
    const back = store.getMetadata()
    expect(back).toEqual({ [join(f.projectsRoot, 'b')]: { note: 'second' } })
  })
})

// ---------------------------------------------------------------
// Pinned list
// ---------------------------------------------------------------
describe('togglePinned', () => {
  test('toggling an unpinned path pins it and persists', () => {
    const path = join(f.projectsRoot, 'app')
    const res = store.togglePinned(path)
    expect(res.pinned).toBe(true)
    expect(store.getPinned()).toEqual([path])
  })

  test('toggling a pinned path unpins it', () => {
    const path = join(f.projectsRoot, 'app')
    store.togglePinned(path)
    const res = store.togglePinned(path)
    expect(res.pinned).toBe(false)
    expect(store.getPinned()).toEqual([])
  })

  test('normalizes path keys the same way metadata does', () => {
    store.togglePinned('D:/Projects/Foo')
    expect(store.getPinned()).toEqual(['D:\\Projects\\Foo'])
  })

  test('only toggles the exact path, leaving siblings untouched', () => {
    const a = join(f.projectsRoot, 'a')
    const b = join(f.projectsRoot, 'b')
    store.togglePinned(a)
    store.togglePinned(b)
    store.togglePinned(a) // unpin a
    expect(store.getPinned()).toEqual([b])
  })
})

// ---------------------------------------------------------------
// Manifest schema
// ---------------------------------------------------------------
describe('ensureManifestSchema', () => {
  test('writes a valid schema file when absent', () => {
    store.ensureManifestSchema()
    const file = join(f.hubDir, 'manifest.schema.json')
    expect(existsSync(file)).toBe(true)
    const schema = JSON.parse(readFileSync(file, 'utf8'))
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(schema.properties.name).toBeDefined()
    expect(schema.properties.scripts).toBeDefined()
  })

  test('is idempotent (does not overwrite an existing schema)', () => {
    store.ensureManifestSchema()
    const file = join(f.hubDir, 'manifest.schema.json')
    const first = readFileSync(file, 'utf8')
    // Mutate the file, then call again — it must be preserved.
    const mutated = JSON.stringify({ ...JSON.parse(first), marker: 'preserved' })
    writeFileSync(file, mutated)
    store.ensureManifestSchema()
    expect(JSON.parse(readFileSync(file, 'utf8')).marker).toBe('preserved')
  })
})

// ---------------------------------------------------------------
// Trash lifecycle (rename-based moves on the same volume)
// ---------------------------------------------------------------
describe('trash', () => {
  // Helper: create a real throwaway project folder under the projects root.
  function makeProject(name: string): string {
    const dir = join(f.projectsRoot, name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'file.txt'), 'hello')
    return dir
  }

  test('trashProject moves the folder into the trash dir and records an entry', () => {
    const path = makeProject('doomed')
    const entry = store.trashProject(path)
    expect(existsSync(path)).toBe(false) // moved away
    expect(existsSync(entry.trashedPath)).toBe(true) // ...and into trash
    expect(entry.trashedPath.startsWith(f.trashDir)).toBe(true)
    expect(entry.name).toBe('doomed')
    expect(entry.originalPath).toBe(path)
    const list = store.listTrash()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(entry.id)
  })

  test('trashProject throws when the folder does not exist', () => {
    expect(() => store.trashProject(join(f.projectsRoot, 'nope'))).toThrow()
  })

  test('restoreProject moves the folder back and removes the entry', () => {
    const path = makeProject('restore-me')
    const entry = store.trashProject(path)
    const restored = store.restoreProject(entry.id)
    expect(existsSync(path)).toBe(true) // back where it was
    expect(restored.id).toBe(entry.id)
    expect(store.listTrash()).toEqual([])
  })

  test('restoreProject restores beside the original when the path is taken', () => {
    const path = makeProject('collision')
    const entry = store.trashProject(path)
    // Re-create a folder at the original path before restoring.
    makeProject('collision')
    const restored = store.restoreProject(entry.id)
    expect(existsSync(path)).toBe(true) // the blocker
    expect(existsSync(restored.originalPath)).toBe(true) // restored beside it
    expect(restored.originalPath).not.toBe(path)
    expect(restored.originalPath.startsWith(`${path}.restored-`)).toBe(true)
  })

  test('restoreProject throws on an unknown id', () => {
    expect(() => store.restoreProject('does-not-exist')).toThrow()
  })

  test('purgeEntry permanently deletes the trashed folder', () => {
    const path = makeProject('purge-me')
    const entry = store.trashProject(path)
    store.purgeEntry(entry.id)
    expect(existsSync(entry.trashedPath)).toBe(false)
    expect(store.listTrash()).toEqual([])
  })

  test('purgeEntry is a no-op for an unknown id', () => {
    expect(() => store.purgeEntry('ghost')).not.toThrow()
    expect(store.listTrash()).toEqual([])
  })

  test('emptyTrash removes all items and returns the count', () => {
    store.trashProject(makeProject('a'))
    store.trashProject(makeProject('b'))
    store.trashProject(makeProject('c'))
    const count = store.emptyTrash()
    expect(count).toBe(3)
    expect(store.listTrash()).toEqual([])
    expect(readdirSync(f.trashDir)).toEqual([])
  })

  test('listTrash sorts newest-first by trashedAt', async () => {
    store.trashProject(makeProject('first'))
    // Separate the entries in time so trashedAt differs reliably.
    await new Promise((r) => setTimeout(r, 5))
    store.trashProject(makeProject('second'))
    const list = store.listTrash()
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('second')
    expect(list[0].trashedAt).toBeGreaterThanOrEqual(list[1].trashedAt)
  })
})

// ---------------------------------------------------------------
// Archive
// ---------------------------------------------------------------
describe('moveToArchive', () => {
  test('moves the folder into projectsRoot/.archive', () => {
    const src = join(f.projectsRoot, 'archivable')
    mkdirSync(src, { recursive: true })
    const { toPath } = store.moveToArchive(src)
    expect(existsSync(src)).toBe(false)
    expect(existsSync(toPath)).toBe(true)
    expect(toPath.startsWith(join(f.projectsRoot, '.archive'))).toBe(true)
  })

  test('suffixed target when an archived folder of the same name exists', () => {
    const src1 = join(f.projectsRoot, 'dup')
    const src2 = join(f.projectsRoot, 'dup')
    mkdirSync(src1, { recursive: true })
    const first = store.moveToArchive(src1)
    // Second move with the same folder name must not clobber the first.
    mkdirSync(src2, { recursive: true })
    const second = store.moveToArchive(src2)
    expect(existsSync(first.toPath)).toBe(true)
    expect(existsSync(second.toPath)).toBe(true)
    expect(first.toPath).not.toBe(second.toPath)
  })
})
