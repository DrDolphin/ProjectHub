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

/** Detect the dev server port from a project's config, if possible. */
export function guessDevPorts(dir: string): number[] {
  const ports = [3000, 5173, 5174, 4173, 8080, 1420, 4000, 8000]
  // vite config port
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
    const cfg = tryRead(join(dir, f))
    if (cfg) {
      const m = cfg.match(/port\s*:\s*(\d+)/)
      if (m) ports.unshift(parseInt(m[1], 10))
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
  const pkg = safeJson<any>(tryRead(join(dir, 'package.json')))
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
  let isGitRepo = hasFile(dir, '.git') || hasFile(join(dir, '.git'), 'HEAD')
  let kind = 'Project'

  const pkg = safeJson<any>(tryRead(join(dir, 'package.json')))

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
  } else if (readdirSync(dir).some((f) => f.endsWith('.csproj'))) {
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

function humanLabel(status: ProjectStatus, meta: ProjectMeta): string {
  if (meta.status) return meta.status
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

/** Walk the projects root: depth-0 projects + depth-1 sub-projects. */
export function scanProjects(opts: ScanOptions): Project[] {
  const root = getProjectsRoot()
  const { metadata, pinned } = opts
  const out: Project[] = []

  const normalizeKey = (p: string) => p.replace(/\//g, '\\')

  const metaFor = (p: string): ProjectMeta => metadata[normalizeKey(p)] || {}

  const { names, err } = listDir(root)
  if (err) return out

  for (const name of names) {
    if (name.startsWith('.') && IGNORED_DIRS.has(name)) continue
    if (IGNORED_DIRS.has(name)) continue
    const fullPath = join(root, name)
    if (!isDir(fullPath)) continue

    if (isProjectDir(fullPath)) {
      // depth-0 leaf project; don't descend
      out.push(buildProject(fullPath, 0, undefined, metaFor(fullPath), pinned.includes(normalizeKey(fullPath))))
    } else {
      // potential grouping dir — look one level deeper
      const children = listDir(fullPath)
      let addedChild = false
      for (const child of children.names) {
        if (IGNORED_DIRS.has(child) || child.startsWith('.')) continue
        const childPath = join(fullPath, child)
        if (!isDir(childPath)) continue
        if (isProjectDir(childPath)) {
          out.push(
            buildProject(
              childPath,
              1,
              name,
              metaFor(childPath),
              pinned.includes(normalizeKey(childPath))
            )
          )
          addedChild = true
        }
      }
      // If the grouping dir has no child projects but still looks like
      // something (e.g. a docs/spec project at depth 0), surface it.
      if (!addedChild) {
        const { names: inner } = listDir(fullPath)
        const real = inner.filter((n) => !n.startsWith('.'))
        if (real.length > 0) {
          out.push(
            buildProject(fullPath, 0, undefined, metaFor(fullPath), pinned.includes(normalizeKey(fullPath)))
          )
        }
      }
    }
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
