import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type {
  Project,
  ProjectMeta,
  DetectedInfo,
  ProjectStatus,
  ProjectTemplate
} from '@shared/types'
import { getProjectsRoot } from './config'

/** Minimal package.json shape used for dependency/script detection. */
interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Directory names never treated as projects / never descended into. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.projecthub',
  '.projecthub-trash',
  '.trash',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.vite',
  '.cache',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'target',
  '.svelte-kit',
  '.turbo',
  '.idea',
  '.vscode',
  '.archive',
  '.pi',
  '.parcel-cache'
])

function listDir(dir: string): { names: string[]; err: boolean } {
  try {
    return { names: readdirSync(dir), err: false }
  } catch {
    return { names: [], err: true }
  }
}

function tryRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function hasFile(dir: string, name: string): boolean {
  return existsSync(join(dir, name))
}

/** The per-project descriptor ProjectHub reads from each project folder. */
const MANIFEST_FILE = 'manifest.json'

/**
 * Read a project's own `manifest.json` (co-located in its folder) and map it
 * onto ProjectMeta. This is the per-project source of truth that drives both
 * which folders ProjectHub surfaces and the information it shows for them.
 *
 * Returns null when the folder has no manifest, or the file isn't a plain
 * object — notably the trash manifest under `.projecthub`, which is a JSON
 * array and must never be mistaken for a project descriptor.
 */
export function readManifestMeta(dir: string): ProjectMeta | null {
  const raw = safeJson<Record<string, unknown>>(tryRead(join(dir, MANIFEST_FILE)))
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  const meta: ProjectMeta = {}
  const name = str(raw.name)
  if (name !== undefined) meta.name = name
  const description = str(raw.description)
  if (description !== undefined) meta.description = description
  const stack = str(raw.stack)
  if (stack !== undefined) meta.stack = stack
  const type = str(raw.type)
  if (type !== undefined) meta.type = type
  const status = str(raw.status)
  if (status !== undefined) meta.status = status
  const note = str(raw.note)
  if (note !== undefined) meta.note = note

  const s = raw.scripts
  if (s && typeof s === 'object' && !Array.isArray(s)) {
    const so = s as Record<string, unknown>
    const scripts: NonNullable<ProjectMeta['scripts']> = {}
    const dev = str(so.dev)
    if (dev !== undefined) scripts.dev = dev
    const build = str(so.build)
    if (build !== undefined) scripts.build = build
    const start = str(so.start)
    if (start !== undefined) scripts.start = start
    const test = str(so.test)
    if (test !== undefined) scripts.test = test
    if (Object.keys(scripts).length > 0) meta.scripts = scripts
  }

  return meta
}

/**
 * Overlay an authoritative on-disk manifest onto the (fallback) centralized
 * metadata. Manifest fields win; scripts are merged key-by-key.
 */
export function mergeMeta(base: ProjectMeta, override: ProjectMeta | null): ProjectMeta {
  if (!override) return base
  const merged: ProjectMeta = { ...base, ...override }
  const scripts = { ...(base.scripts || {}), ...(override.scripts || {}) }
  if (Object.keys(scripts).length > 0) merged.scripts = scripts
  else delete merged.scripts
  return merged
}

/** The exact `type` sentinel that marks a folder as a sub-project container. */
const GROUPING_TYPE = 'grouping folder'

/**
 * True when a manifest marks its folder as a container for sub-projects via
 * the exact `"type": "Grouping folder"` sentinel. Such folders are descended
 * into rather than shown as a launchable project of their own. An exact match
 * (not a substring) avoids misclassifying real project kinds that merely
 * contain the word "group" (e.g. "Group chat app").
 */
export function isGroupingManifest(meta: ProjectMeta | null): boolean {
  return meta?.type?.trim().toLowerCase() === GROUPING_TYPE
}

/** Detect the dev server port from a project's config, if possible. */
export function guessDevPorts(dir: string): number[] {
  const ports = [3000, 5173, 5174, 4173, 8080, 1420, 4000, 8000]
  // vite config port
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
    const cfg = tryRead(join(dir, f))
    if (cfg) {
      const m = cfg.match(/port\s*:\s*(\d+)/)
      if (m && m[1]) ports.unshift(parseInt(m[1], 10))
    }
  }
  // next config
  const nextCfg = tryRead(join(dir, 'next.config.js')) || tryRead(join(dir, 'next.config.mjs'))
  if (nextCfg) {
    // Next default is 3000 (already in list)
  }
  // dedupe
  return Array.from(new Set(ports))
}

/** Detect the package manager from lockfiles (Node projects only). */
function detectManagerFromDir(dir: string): string {
  if (hasFile(dir, 'pnpm-lock.yaml')) return 'pnpm'
  if (hasFile(dir, 'yarn.lock')) return 'yarn'
  if (hasFile(dir, 'bun.lockb') || hasFile(dir, 'bun.lock')) return 'bun'
  return 'npm'
}

/**
 * Resolve the command used to start a project's dev server.
 * Priority: metadata scripts.dev/start (explicit override) → package.json
 * dev/start script run via the detected package manager. Returns null when
 * no runnable dev command can be determined.
 */
export function resolveDevCommand(dir: string, meta?: ProjectMeta): string | null {
  // 1. Explicit metadata override (power-user / non-Node projects).
  const explicit = meta?.scripts?.dev || meta?.scripts?.start
  if (explicit) return explicit

  // 2. Node project with a dev/start script.
  const pkg = safeJson<PackageJson>(tryRead(join(dir, 'package.json')))
  if (pkg && pkg.scripts) {
    const hasDev = Boolean(pkg.scripts.dev)
    const hasStart = Boolean(pkg.scripts.start)
    if (hasDev || hasStart) {
      const scriptName = hasDev ? 'dev' : 'start'
      switch (detectManagerFromDir(dir)) {
        case 'pnpm':
          return `pnpm run ${scriptName}`
        case 'yarn':
          return `yarn ${scriptName}`
        case 'bun':
          return `bun run ${scriptName}`
        default:
          return scriptName === 'start' ? 'npm start' : 'npm run dev'
      }
    }
  }

  // 3. Python / Rust / Go / static — too project-specific to guess safely;
  //    require an explicit metadata override.
  return null
}

function detectInfo(dir: string, meta?: ProjectMeta): DetectedInfo {
  const stack: string[] = []
  let manager = 'none'
  let hasDevScript = false
  const isGitRepo = hasFile(dir, '.git') || hasFile(join(dir, '.git'), 'HEAD')
  let kind: string

  const pkg = safeJson<PackageJson>(tryRead(join(dir, 'package.json')))

  if (pkg) {
    stack.push('Node.js')
    if (hasFile(dir, 'pnpm-lock.yaml')) manager = 'pnpm'
    else if (hasFile(dir, 'yarn.lock')) manager = 'yarn'
    else if (hasFile(dir, 'bun.lockb') || hasFile(dir, 'bun.lock')) manager = 'bun'
    else manager = 'npm'

    const deps: Record<string, string> = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    if (deps['next']) stack.push('Next.js')
    if (deps['react']) stack.push('React')
    if (deps['vue']) stack.push('Vue')
    if (deps['svelte']) stack.push('Svelte')
    if (deps['vite']) stack.push('Vite')
    if (deps['tailwindcss']) stack.push('TailwindCSS')
    if (deps['express']) stack.push('Express')
    if (deps['fastify']) stack.push('Fastify')
    if (deps['prisma']) stack.push('Prisma')
    if (deps['drizzle-orm']) stack.push('Drizzle')
    if (deps['electron']) stack.push('Electron')
    if (deps['typescript'] || hasFile(dir, 'tsconfig.json')) stack.push('TypeScript')

    const scripts = pkg.scripts || {}
    hasDevScript = Boolean(scripts.dev || scripts.start)

    if (deps['next']) kind = 'Next.js app'
    else if (deps['electron']) kind = 'Electron app'
    else if (deps['vite'] && deps['react']) kind = 'Vite + React app'
    else if (deps['vite']) kind = 'Vite app'
    else if (deps['express'] || deps['fastify']) kind = 'Node server'
    else if (deps['react']) kind = 'React app'
    else if (scripts.dev || scripts.start) kind = 'Node project'
    else kind = 'Node package'
  } else if (hasFile(dir, 'pyproject.toml') || hasFile(dir, 'requirements.txt')) {
    stack.push('Python')
    const py = tryRead(join(dir, 'pyproject.toml')) || ''
    if (hasFile(dir, 'uv.lock') || /tool\.uv/.test(py)) manager = 'uv'
    else manager = 'pip'
    if (/fastapi|FastAPI/.test(py)) stack.push('FastAPI')
    if (/typer|click/.test(py)) stack.push('Typer')
    kind = stack.includes('FastAPI') ? 'Python (FastAPI)' : 'Python project'
  } else if (hasFile(dir, 'Cargo.toml')) {
    stack.push('Rust')
    manager = 'cargo'
    const cargo = tryRead(join(dir, 'Cargo.toml')) || ''
    if (/tauri/i.test(cargo)) {
      stack.push('Tauri')
      kind = 'Tauri app'
    } else {
      kind = 'Rust project'
    }
  } else if (hasFile(dir, 'go.mod')) {
    stack.push('Go')
    manager = 'go'
    kind = 'Go project'
  } else if (listDir(dir).names.some((f) => f.endsWith('.csproj'))) {
    stack.push('C#', '.NET')
    manager = 'dotnet'
    kind = '.NET project'
  } else {
    // No code markers — maybe docs / static / empty
    const { names } = listDir(dir)
    const real = names.filter((n) => !n.startsWith('.'))
    if (real.length === 0) {
      kind = 'Empty folder'
    } else if (real.some((n) => n.endsWith('.html'))) {
      kind = 'Static HTML'
    } else if (real.every((n) => n.endsWith('.md'))) {
      kind = 'Documentation'
    } else if (real.some((n) => n.endsWith('.lua'))) {
      stack.push('Lua')
      kind = 'Addon / Script'
    } else {
      kind = 'Folder'
    }
  }

  return { stack, manager, hasDevScript, isGitRepo, kind, devCommand: resolveDevCommand(dir, meta) }
}

/** Map a free-text status string to a normalized bucket. */
export function statusBucket(statusStr: string | undefined, detected: DetectedInfo): ProjectStatus {
  if (!statusStr) {
    if (detected.kind === 'Empty folder') return 'empty'
    return 'unknown'
  }
  const s = statusStr.toLowerCase()
  if (s.includes('archived') || s.includes('shelved')) return 'archived'
  if (s.includes('active') || s.includes('early') || s.includes('in progress') || s.includes('development'))
    return 'active'
  if (s.includes('planning') || s.includes('documentation')) return 'planning'
  if (s.includes('spec') || s.includes('complete') || s.includes('ready')) return 'spec'
  if (s.includes('test') || s.includes('experimental')) return 'testing'
  if (s.includes('one-off') || s.includes('oneoff') || s.includes('spike')) return 'oneoff'
  if (s.includes('empty')) return 'empty'
  return 'unknown'
}

/**
 * Canonical status keywords manifests use verbatim. When the manifest just
 * carries one of these (e.g. "active"), we render the polished bucket label;
 * a descriptive status ("Active development") is shown exactly as written.
 */
const BUCKET_KEYWORDS = new Set([
  'active',
  'planning',
  'spec',
  'testing',
  'oneoff',
  'one-off',
  'empty',
  'archived',
  'unknown'
])

function humanLabel(status: ProjectStatus, meta: ProjectMeta): string {
  const raw = meta.status?.trim()
  if (raw && !BUCKET_KEYWORDS.has(raw.toLowerCase())) return raw
  switch (status) {
    case 'active':
      return 'Active'
    case 'planning':
      return 'Planning'
    case 'spec':
      return 'Spec / Ready'
    case 'testing':
      return 'Testing'
    case 'oneoff':
      return 'One-off'
    case 'empty':
      return 'Empty'
    case 'archived':
      return 'Archived'
    default:
      return '—'
  }
}

function buildProject(
  path: string,
  depth: number,
  parent: string | undefined,
  meta: ProjectMeta,
  pinned: boolean
): Project {
  const folder = basename(path)
  const detected = detectInfo(path, meta)
  const status = statusBucket(meta.status, detected)
  return {
    path,
    folder,
    name: meta.name || folder,
    parent,
    depth,
    exists: true,
    pinned,
    meta,
    detected,
    status,
    statusLabel: humanLabel(status, meta)
  }
}

/** Does a directory look like a project? */
function isProjectDir(dir: string): boolean {
  const markers = [
    MANIFEST_FILE, // an explicit ProjectHub manifest always marks a project
    'package.json',
    'pyproject.toml',
    'requirements.txt',
    'Cargo.toml',
    'go.mod',
    '.git',
    'composer.json',
    'Gemfile',
    'pom.xml'
  ]
  if (markers.some((m) => hasFile(dir, m))) return true
  const { names } = listDir(dir)
  if (names.some((n) => n.endsWith('.csproj'))) return true
  if (names.some((n) => n.endsWith('.html'))) return true // static html "project"
  return false
}

export interface ScanOptions {
  metadata: Record<string, ProjectMeta>
  pinned: string[]
}

/** Guard against pathological nesting / symlink loops while descending groups. */
const MAX_SCAN_DEPTH = 6

/**
 * Walk the projects root. A folder is surfaced as a project card when its
 * manifest (or, failing that, its on-disk markers) identifies it as one.
 * Folders whose manifest declares them a "Grouping folder" are never shown
 * themselves — they're descended into so their child projects appear instead,
 * to any depth (e.g. ---/Story Generators/AI CYOA).
 */
export function scanProjects(opts: ScanOptions): Project[] {
  const root = getProjectsRoot()
  const { metadata, pinned } = opts
  const out: Project[] = []

  const normalizeKey = (p: string) => p.replace(/\//g, '\\')
  const isPinned = (p: string) => pinned.includes(normalizeKey(p))

  // Per-project manifest (authoritative) overlaid on centralized metadata (fallback).
  const centralizedFor = (p: string): ProjectMeta => metadata[normalizeKey(p)] || {}

  /**
   * Surface the projects reachable from `dir`. Returns true if it (or anything
   * beneath it) produced a card. `parent` is the root-relative path of the
   * containing folder (undefined at the top level), so it round-trips through
   * IPC.CREATE's `join(root, parent)` even when groups are nested or share a
   * name (e.g. `---/Story Generators`).
   */
  const visit = (dir: string, name: string, depth: number, parent: string | undefined): boolean => {
    const manifest = readManifestMeta(dir)
    const meta = mergeMeta(centralizedFor(dir), manifest)
    const grouping = isGroupingManifest(manifest)

    // A real project (declared and/or detected) that isn't a grouping container
    // is a leaf — surface it and don't descend into its internals.
    if (!grouping && isProjectDir(dir)) {
      out.push(buildProject(dir, depth, parent, meta, isPinned(dir)))
      return true
    }

    // Otherwise it's a container: a declared grouping folder, or a plain
    // organizational folder that may hold projects. Descend one level (deeper
    // for declared groups) and let children surface themselves. Children carry
    // this folder's root-relative path as their parent.
    const dirRel = parent ? join(parent, name) : name
    let added = false
    if (depth < MAX_SCAN_DEPTH) {
      for (const child of listDir(dir).names) {
        if (IGNORED_DIRS.has(child) || child.startsWith('.')) continue
        const childPath = join(dir, child)
        if (!isDir(childPath)) continue
        if (visit(childPath, child, depth + 1, dirRel)) added = true
      }
    }

    // Legacy fallback: a non-grouping top-level folder with no surfaced children
    // but real contents still shows as a single depth-0 card (e.g. a loose docs
    // or spec folder with no code markers).
    if (!grouping && !added && depth === 0) {
      const real = listDir(dir).names.filter((n) => !n.startsWith('.'))
      if (real.length > 0) {
        out.push(buildProject(dir, 0, undefined, meta, isPinned(dir)))
        return true
      }
    }

    return added
  }

  const { names, err } = listDir(root)
  if (err) return out

  for (const name of names) {
    if (IGNORED_DIRS.has(name)) continue
    const fullPath = join(root, name)
    if (!isDir(fullPath)) continue
    visit(fullPath, name, 0, undefined)
  }

  // Sort: pinned first, then active, then by name
  const statusRank: Record<ProjectStatus, number> = {
    active: 0,
    spec: 1,
    planning: 2,
    testing: 3,
    oneoff: 4,
    unknown: 5,
    empty: 6,
    archived: 7
  }
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status]
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  return out
}

/** Template scaffolding for "New Project". */
export function scaffoldTemplate(dir: string, template: ProjectTemplate): void {
  switch (template) {
    case 'empty':
      break
    case 'node':
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify(
          { name: basename(dir), version: '0.0.0', private: true, scripts: { dev: 'node index.js' } },
          null,
          2
        )
      )
      writeFileSync(join(dir, 'index.js'), `console.log('hello from ${basename(dir)}')\n`)
      break
    case 'vite-react':
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify(
          {
            name: basename(dir),
            private: true,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }
          },
          null,
          2
        )
      )
      mkdirSync(join(dir, 'src'), { recursive: true })
      writeFileSync(join(dir, 'index.html'), `<!doctype html><title>${basename(dir)}</title>\n`)
      writeFileSync(join(dir, 'src', 'main.tsx'), `export default function App(){return <h1>${basename(dir)}</h1>}\n`)
      break
    case 'nextjs':
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify(
          {
            name: basename(dir),
            private: true,
            version: '0.0.0',
            scripts: { dev: 'next dev', build: 'next build', start: 'next start' }
          },
          null,
          2
        )
      )
      break
    case 'python':
      writeFileSync(join(dir, 'pyproject.toml'), `[project]\nname = "${basename(dir)}"\nversion = "0.0.0"\n`)
      break
    case 'static':
      writeFileSync(
        join(dir, 'index.html'),
        `<!doctype html>\n<html><head><title>${basename(dir)}</title></head><body><h1>${basename(dir)}</h1></body></html>\n`
      )
      break
  }
}
