import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, ProjectStatus, TrashEntry, CreateProjectResult, UpdateStatus, UpdateState } from '@shared/types'
import { ToastProvider, useToast } from './lib/toast'
import { Toolbar } from './components/Toolbar'
import { ProjectCard } from './components/ProjectCard'
import { DeleteModal } from './components/DeleteModal'
import { TrashModal } from './components/TrashModal'
import { CreateModal } from './components/CreateModal'
import { Loader2, FolderSearch } from 'lucide-react'

function Hub() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [root, setRoot] = useState('D:\\Projects')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [trash, setTrash] = useState<TrashEntry[]>([])
  const [trashOpen, setTrashOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const updatePrev = useRef<UpdateState>('idle')

  // Subscribe to auto-updater status from the main process.
  useEffect(() => {
    void window.projectHub.getUpdateStatus().then(setUpdate)
    const off = window.projectHub.onUpdateStatus(setUpdate)
    return off
  }, [])

  // Surface meaningful status transitions as toasts.
  useEffect(() => {
    if (!update || update.state === updatePrev.current) return
    updatePrev.current = update.state
    if (update.state === 'available') {
      toast('⤓', `Update ${update.version ? `v${update.version} ` : ''}found — downloading…`, 'info')
    } else if (update.state === 'downloaded') {
      toast('⤓', `Update ${update.version ? `v${update.version} ` : ''}ready — click to install`, 'success')
    } else if (update.state === 'error') {
      toast('⚠️', `Update check failed: ${update.message ?? 'unknown error'}`, 'error')
    }
  }, [update, toast])

  const checkUpdates = () => {
    void window.projectHub.checkForUpdates()
  }
  const installUpdate = () => {
    void window.projectHub.installUpdate()
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [scan, trashList] = await Promise.all([
        window.projectHub.scan(),
        window.projectHub.trashList()
      ])
      setProjects(scan.projects)
      setRoot(scan.root)
      setTrash(trashList)
    } catch (err) {
      toast('⚠️', `Scan failed: ${(err as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // ---- group parents (for the create modal dropdown) ----
  const parents = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) if (p.parent) set.add(p.parent)
    // also include top-level folders that are grouping dirs (have children)
    for (const p of projects) if (p.depth === 0 && !p.parent) set.add(p.folder)
    return Array.from(set).sort()
  }, [projects])

  // ---- filtering ----
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false
      if (!q) return true
      const hay = `${p.name} ${p.folder} ${p.meta.description || ''} ${p.meta.stack || ''} ${p.detected.stack.join(' ')} ${p.detected.kind} ${p.path}`.toLowerCase()
      return hay.includes(q)
    })
  }, [projects, query, filter])

  // ---- actions ----
  const launch = (p: Project) => window.projectHub.launch(p.path)
  const startServer = (p: Project) => window.projectHub.startServer(p.path)
  const openVSCode = (p: Project) => window.projectHub.openVSCode(p.path)
  const openExplorer = (p: Project) => window.projectHub.openExplorer(p.path)
  const copy = (p: Project) => window.projectHub.copyPath(p.path)

  const pin = async (p: Project) => {
    const res = await window.projectHub.pinnedToggle(p.path)
    toast(res.pinned ? '⭐' : '☆', res.pinned ? `Pinned ${p.name}` : `Unpinned ${p.name}`, 'success')
    void refresh()
  }

  const confirmDelete = async (p: Project) => {
    await window.projectHub.deleteProject(p.path)
    setDeleteTarget(null)
    void refresh()
  }

  const restore = async (id: string) => {
    await window.projectHub.trashRestore(id)
    void refresh()
  }

  const empty = async () => {
    await window.projectHub.trashEmpty()
    void refresh()
  }

  const move = async (p: Project) => {
    const res = await window.projectHub.moveProject({ sourcePath: p.path })
    if (res.moved) void refresh()
  }

  const archive = async (p: Project) => {
    await window.projectHub.moveToArchive(p.path)
    void refresh()
  }

  const onCreated = (result: CreateProjectResult, _openAfter: boolean) => {
    if (result.created) void refresh()
  }

  const pickRoot = async () => {
    const picked = await window.projectHub.selectFolder()
    if (picked) {
      // requires app restart to take effect (settings.json)
      toast('🔄', 'Root changed — restart ProjectHub to apply.', 'info')
    }
  }

  const pinned = visible.filter((p) => p.pinned)
  const rest = visible.filter((p) => !p.pinned)

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        query={query}
        onQuery={setQuery}
        filter={filter}
        onFilter={setFilter}
        view={view}
        onView={setView}
        total={projects.length}
        shown={visible.length}
        trashCount={trash.length}
        root={root}
        onRefresh={() => void refresh()}
        onNew={() => setCreateOpen(true)}
        onOpenTrash={() => setTrashOpen(true)}
        onPickRoot={pickRoot}
        update={update}
        onCheckUpdates={checkUpdates}
        onInstallUpdate={installUpdate}
      />

      <main className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-dim">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm">Scanning {root}…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-dim">
            <FolderSearch size={32} />
            <p className="text-sm">No projects match.</p>
            <button onClick={() => setCreateOpen(true)} className="btn btn-accent mt-1">
              Create your first project
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {pinned.length > 0 && (
              <Section title="Pinned" count={pinned.length} accent>
                <Grid view={view}>
                  {pinned.map((p) => (
                    <ProjectCard
                      key={p.path}
                      project={p}
                      onLaunch={launch}
                      onStartServer={startServer}
                      onOpenVSCode={openVSCode}
                      onOpenExplorer={openExplorer}
                      onCopy={copy}
                      onDelete={setDeleteTarget}
                      onPin={pin}
                      onMove={move}
                      onArchive={archive}
                    />
                  ))}
                </Grid>
              </Section>
            )}

            <Section title="Projects" count={rest.length}>
              <Grid view={view}>
                {rest.map((p) => (
                  <ProjectCard
                    key={p.path}
                    project={p}
                    onLaunch={launch}
                    onStartServer={startServer}
                    onOpenVSCode={openVSCode}
                    onOpenExplorer={openExplorer}
                    onCopy={copy}
                    onDelete={setDeleteTarget}
                    onPin={pin}
                    onMove={move}
                    onArchive={archive}
                  />
                ))}
              </Grid>
            </Section>
          </div>
        )}
      </main>

      <DeleteModal project={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        entries={trash}
        onRestore={restore}
        onEmpty={empty}
      />
      <CreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        parents={parents}
        onCreated={onCreated}
      />
    </div>
  )
}

function Section({
  title,
  count,
  accent,
  children
}: {
  title: string
  count: number
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className={`text-[13px] font-semibold uppercase tracking-wide ${accent ? 'text-accent' : 'text-text-muted'}`}>
          {title}
        </h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-dim">{count}</span>
      </div>
      {children}
    </section>
  )
}

function Grid({ view, children }: { view: 'grid' | 'list'; children: React.ReactNode }) {
  return (
    <div
      className={
        view === 'grid'
          ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
          : 'flex flex-col gap-3'
      }
    >
      {children}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Hub />
    </ToastProvider>
  )
}
