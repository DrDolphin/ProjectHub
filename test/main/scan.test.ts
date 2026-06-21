import { describe, test, expect } from 'vitest'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  readManifestMeta,
  mergeMeta,
  isGroupingManifest,
  statusBucket,
  guessDevPorts,
  resolveDevCommand,
  scaffoldTemplate
} from '../../src/main/scan'
import type { DetectedInfo, ProjectMeta } from '@shared/types'
import { makeTempProject, disposeTempProject } from '../helpers/fixture'

// Minimal DetectedInfo (only `.kind` is read by statusBucket).
function detected(kind: string): DetectedInfo {
  return {
    stack: [],
    manager: 'none',
    hasDevScript: false,
    isGitRepo: false,
    kind,
    devCommand: null
  }
}

// ---------------------------------------------------------------
// Pure: mergeMeta
// ---------------------------------------------------------------
describe('mergeMeta', () => {
  const base: ProjectMeta = {
    name: 'base',
    note: 'base-note',
    scripts: { dev: 'npm run dev', build: 'npm run build' }
  }

  test('returns base unchanged when override is null', () => {
    expect(mergeMeta(base, null)).toEqual(base)
  })

  test('override scalar fields win over base', () => {
    expect(mergeMeta(base, { name: 'override' }).name).toBe('override')
    // Untouched base fields survive.
    expect(mergeMeta(base, { name: 'override' }).note).toBe('base-note')
  })

  test('merges scripts key-by-key rather than replacing the whole object', () => {
    const merged = mergeMeta(base, { scripts: { build: 'override build' } })
    expect(merged.scripts).toEqual({ dev: 'npm run dev', build: 'override build' })
  })

  test('drops the scripts object entirely when both sides have none', () => {
    const merged = mergeMeta({ name: 'x' }, { name: 'y' })
    expect(merged.scripts).toBeUndefined()
  })
})

// ---------------------------------------------------------------
// Pure: isGroupingManifest
// ---------------------------------------------------------------
describe('isGroupingManifest', () => {
  test('true for the exact "Grouping folder" type', () => {
    expect(isGroupingManifest({ type: 'Grouping folder' })).toBe(true)
  })

  test('is case-insensitive and trims whitespace', () => {
    expect(isGroupingManifest({ type: '  grouping FOLDER  ' })).toBe(true)
  })

  test('false for a project whose type merely contains the word "group"', () => {
    // Regression guard: "Group chat app" must NOT be treated as a container.
    expect(isGroupingManifest({ type: 'Group chat app' })).toBe(false)
  })

  test('false for null / undefined type', () => {
    expect(isGroupingManifest(null)).toBe(false)
    expect(isGroupingManifest({})).toBe(false)
    expect(isGroupingManifest({ type: undefined })).toBe(false)
  })
})

// ---------------------------------------------------------------
// Pure: statusBucket
// ---------------------------------------------------------------
describe('statusBucket', () => {
  test('undefined status → unknown for normal projects', () => {
    expect(statusBucket(undefined, detected('Node project'))).toBe('unknown')
  })

  test('undefined status → empty for an empty folder', () => {
    expect(statusBucket(undefined, detected('Empty folder'))).toBe('empty')
  })

  test.each([
    ['Archived', 'archived'],
    ['shelved for now', 'archived']
  ])('%s → %s', (input, expected) => {
    expect(statusBucket(input, detected('Node project'))).toBe(expected)
  })

  test.each([
    ['Active', 'active'],
    ['early prototype', 'active'],
    ['in progress', 'active'],
    ['under active development', 'active']
  ])('%s → %s', (input, expected) => {
    expect(statusBucket(input, detected('Node project'))).toBe(expected)
  })

  test('planning keywords → planning', () => {
    expect(statusBucket('planning phase', detected('Node project'))).toBe('planning')
    expect(statusBucket('documentation site', detected('Node project'))).toBe('planning')
  })

  test('spec / complete / ready → spec', () => {
    expect(statusBucket('spec ready', detected('Node project'))).toBe('spec')
    expect(statusBucket('feature complete', detected('Node project'))).toBe('spec')
  })

  test('test / experimental → testing', () => {
    expect(statusBucket('experimental', detected('Node project'))).toBe('testing')
    expect(statusBucket('in testing', detected('Node project'))).toBe('testing')
  })

  test('one-off / spike → oneoff', () => {
    expect(statusBucket('one-off', detected('Node project'))).toBe('oneoff')
    expect(statusBucket('spike', detected('Node project'))).toBe('oneoff')
  })

  test('unrecognized free text → unknown', () => {
    expect(statusBucket('a mystery', detected('Node project'))).toBe('unknown')
  })
})

// ---------------------------------------------------------------
// Filesystem: readManifestMeta
// ---------------------------------------------------------------
describe('readManifestMeta', () => {
  test('returns null when no manifest.json is present', () => {
    const dir = makeTempProject()
    try {
      expect(readManifestMeta(dir)).toBeNull()
    } finally {
      disposeTempProject(dir)
    }
  })

  test('returns null for a JSON array (trash-manifest shape)', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'manifest.json'), '[]')
      expect(readManifestMeta(dir)).toBeNull()
    } finally {
      disposeTempProject(dir)
    }
  })

  test('maps all recognized string fields', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(
        join(dir, 'manifest.json'),
        JSON.stringify({
          name: 'My App',
          description: 'desc',
          stack: 'React, Vite',
          type: 'Web app',
          status: 'active',
          note: 'a note'
        })
      )
      expect(readManifestMeta(dir)).toEqual({
        name: 'My App',
        description: 'desc',
        stack: 'React, Vite',
        type: 'Web app',
        status: 'active',
        note: 'a note'
      })
    } finally {
      disposeTempProject(dir)
    }
  })

  test('filters out non-string values (keeps the schema honest)', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ name: 123, status: true }))
      expect(readManifestMeta(dir)).toEqual({})
    } finally {
      disposeTempProject(dir)
    }
  })

  test('maps recognized scripts and ignores empty scripts', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      expect(readManifestMeta(dir)).toEqual({ scripts: { dev: 'vite' } })
    } finally {
      disposeTempProject(dir)
    }
  })
})

// ---------------------------------------------------------------
// Filesystem: guessDevPorts
// ---------------------------------------------------------------
describe('guessDevPorts', () => {
  test('returns the default port list when no config is present', () => {
    const dir = makeTempProject()
    try {
      const ports = guessDevPorts(dir)
      expect(ports).toContain(3000)
      expect(ports).toContain(5173)
      expect(ports[0]).toBe(3000)
    } finally {
      disposeTempProject(dir)
    }
  })

  test('prepends a port found in a vite config and dedupes', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'vite.config.ts'), 'export default { server: { port: 1420 } }')
      const ports = guessDevPorts(dir)
      // 1420 is already in the default list; it must be promoted to front and not duplicated.
      expect(ports[0]).toBe(1420)
      expect(ports.filter((p) => p === 1420)).toHaveLength(1)
    } finally {
      disposeTempProject(dir)
    }
  })

  test('surfaces a brand-new port not in the defaults', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'vite.config.mts'), 'server: { port: 9999 }')
      const ports = guessDevPorts(dir)
      expect(ports[0]).toBe(9999)
    } finally {
      disposeTempProject(dir)
    }
  })
})

// ---------------------------------------------------------------
// Filesystem: resolveDevCommand
// ---------------------------------------------------------------
describe('resolveDevCommand', () => {
  test('explicit metadata scripts.dev override wins', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      expect(resolveDevCommand(dir, { scripts: { dev: 'docker compose up' } })).toBe(
        'docker compose up'
      )
    } finally {
      disposeTempProject(dir)
    }
  })

  test('falls back to metadata scripts.start when no dev override', () => {
    const dir = makeTempProject()
    try {
      expect(resolveDevCommand(dir, { scripts: { start: 'node server.js' } })).toBe(
        'node server.js'
      )
    } finally {
      disposeTempProject(dir)
    }
  })

  test('Node + pnpm-lock → "pnpm run dev"', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
      expect(resolveDevCommand(dir)).toBe('pnpm run dev')
    } finally {
      disposeTempProject(dir)
    }
  })

  test('Node + yarn.lock → "yarn dev"', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      writeFileSync(join(dir, 'yarn.lock'), '')
      expect(resolveDevCommand(dir)).toBe('yarn dev')
    } finally {
      disposeTempProject(dir)
    }
  })

  test('Node + bun.lock → "bun run dev"', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      writeFileSync(join(dir, 'bun.lock'), '')
      expect(resolveDevCommand(dir)).toBe('bun run dev')
    } finally {
      disposeTempProject(dir)
    }
  })

  test('Node + no lockfile → "npm run dev"', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      expect(resolveDevCommand(dir)).toBe('npm run dev')
    } finally {
      disposeTempProject(dir)
    }
  })

  test('Node with only a start script → "npm start"', () => {
    const dir = makeTempProject()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'node .' } }))
      expect(resolveDevCommand(dir)).toBe('npm start')
    } finally {
      disposeTempProject(dir)
    }
  })

  test('returns null when nothing runnable can be determined', () => {
    const dir = makeTempProject()
    try {
      expect(resolveDevCommand(dir)).toBeNull()
    } finally {
      disposeTempProject(dir)
    }
  })
})

// ---------------------------------------------------------------
// Filesystem: scaffoldTemplate
// ---------------------------------------------------------------
describe('scaffoldTemplate', () => {
  test('"empty" writes nothing', () => {
    const dir = makeTempProject()
    try {
      scaffoldTemplate(dir, 'empty')
      expect(existsSync(join(dir, 'package.json'))).toBe(false)
      expect(existsSync(join(dir, 'index.html'))).toBe(false)
    } finally {
      disposeTempProject(dir)
    }
  })

  test('"node" writes a runnable package.json + index.js', () => {
    const dir = makeTempProject()
    try {
      scaffoldTemplate(dir, 'node')
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      expect(pkg.scripts.dev).toBe('node index.js')
      expect(pkg.name).toBe(join(dir).split(/[\\/]/).pop())
      expect(existsSync(join(dir, 'index.js'))).toBe(true)
    } finally {
      disposeTempProject(dir)
    }
  })

  test('"vite-react" writes package.json, index.html, and src/main.tsx', () => {
    const dir = makeTempProject()
    try {
      scaffoldTemplate(dir, 'vite-react')
      expect(existsSync(join(dir, 'package.json'))).toBe(true)
      expect(existsSync(join(dir, 'index.html'))).toBe(true)
      expect(existsSync(join(dir, 'src', 'main.tsx'))).toBe(true)
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      expect(pkg.scripts).toEqual({ dev: 'vite', build: 'vite build', preview: 'vite preview' })
    } finally {
      disposeTempProject(dir)
    }
  })

  test('"python" writes a pyproject.toml', () => {
    const dir = makeTempProject()
    try {
      scaffoldTemplate(dir, 'python')
      expect(existsSync(join(dir, 'pyproject.toml'))).toBe(true)
    } finally {
      disposeTempProject(dir)
    }
  })

  test('"static" writes an index.html', () => {
    const dir = makeTempProject()
    try {
      scaffoldTemplate(dir, 'static')
      expect(existsSync(join(dir, 'index.html'))).toBe(true)
    } finally {
      disposeTempProject(dir)
    }
  })
})
