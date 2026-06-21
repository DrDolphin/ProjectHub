import { Search, Plus, Trash2, RefreshCw, LayoutGrid, List, FolderTree, Settings } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ProjectStatus } from '@shared/types'
import logo from '../assets/logo.svg'

interface Props {
  query: string
  onQuery: (q: string) => void
  filter: ProjectStatus | 'all'
  onFilter: (f: ProjectStatus | 'all') => void
  view: 'grid' | 'list'
  onView: (v: 'grid' | 'list') => void
  total: number
  shown: number
  trashCount: number
  root: string
  onRefresh: () => void
  onNew: () => void
  onOpenTrash: () => void
  onPickRoot: () => void
  onSettings: () => void
}

const FILTERS: { id: ProjectStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'planning', label: 'Planning' },
  { id: 'spec', label: 'Spec' },
  { id: 'testing', label: 'Testing' },
  { id: 'oneoff', label: 'One-offs' },
  { id: 'unknown', label: 'Other' },
  { id: 'empty', label: 'Empty' }
]

export function Toolbar({
  query,
  onQuery,
  filter,
  onFilter,
  view,
  onView,
  total,
  shown,
  trashCount,
  root,
  onRefresh,
  onNew,
  onOpenTrash,
  onPickRoot,
  onSettings
}: Props) {
  const searchRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <header className="z-20 flex flex-col gap-3 border-b border-border bg-surface/70 px-5 py-3 backdrop-blur-md">
      {/* Top row: title + actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="ProjectHub" className="h-8 w-8 rounded-lg shadow-glow" />
          <div>
            <h1 className="text-[15px] font-bold leading-tight text-text">ProjectHub</h1>
            <button
              onClick={onPickRoot}
              title="Change projects root"
              className="flex items-center gap-1 font-mono text-[11px] text-text-dim hover:text-accent"
            >
              <FolderTree size={11} /> {root}
            </button>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <button onClick={onRefresh} className="btn btn-ghost border border-border" title="Rescan">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onOpenTrash}
            className="btn btn-ghost relative border border-border"
            title="Trash"
          >
            <Trash2 size={14} />
            {trashCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {trashCount}
              </span>
            )}
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => onView('grid')}
              className={`btn !rounded-none border-0 ${view === 'grid' ? 'bg-surface-2 text-accent' : 'text-text-dim'}`}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => onView('list')}
              className={`btn !rounded-none border-0 ${view === 'list' ? 'bg-surface-2 text-accent' : 'text-text-dim'}`}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
          <button onClick={onSettings} className="btn btn-ghost border border-border" title="Settings">
            <Settings size={14} />
          </button>
          <button onClick={onNew} className="btn btn-accent">
            <Plus size={15} /> New project
          </button>
        </div>
      </div>

      {/* Bottom row: search + filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search projects by name, stack, or description…   ( / )"
            className="input w-full pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-all ${
                filter === f.id
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-border bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-[12px] text-text-dim">
          {shown === total ? `${total} projects` : `${shown} / ${total}`}
        </span>
      </div>
    </header>
  )
}
