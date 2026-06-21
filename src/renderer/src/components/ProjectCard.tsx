import { useState } from 'react'
import {
  Rocket,
  Play,
  Code2,
  FolderOpen,
  Copy,
  Trash2,
  Pin,
  PinOff,
  MoreHorizontal,
  FolderInput,
  Archive,
  Crosshair,
  Star,
  StickyNote
} from 'lucide-react'
import type { Project } from '@shared/types'
import { statusStyle } from '../lib/status'

interface Props {
  project: Project
  onLaunch: (p: Project) => void
  onStartServer: (p: Project) => void
  onOpenVSCode: (p: Project) => void
  onOpenExplorer: (p: Project) => void
  onCopy: (p: Project) => void
  onDelete: (p: Project) => void
  onPin: (p: Project) => void
  onMove: (p: Project) => void
  onArchive: (p: Project) => void
}

export function ProjectCard({
  project,
  onLaunch,
  onStartServer,
  onOpenVSCode,
  onOpenExplorer,
  onCopy,
  onDelete,
  onPin,
  onMove,
  onArchive
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const st = statusStyle(project.status)
  const longDesc = (project.meta.description?.length ?? 0) > 140
  const devCmd = project.meta.scripts?.dev || project.meta.scripts?.start
  const stackParts = (project.meta.stack || project.detected.stack.join(', ')).split(',').map((s) => s.trim()).filter(Boolean)
  // Prefer the manifest's declared type; fall back to what we auto-detect.
  const kindLabel = project.meta.type || project.detected.kind

  return (
    <div
      className={`card-hover animate-pop group relative flex flex-col rounded-xl border bg-surface p-4 ${
        project.pinned ? 'border-accent/40 shadow-glow' : 'border-border'
      }`}
    >
      {/* Pin indicator */}
      {project.pinned && (
        <Star
          size={14}
          className="absolute right-3 top-3 fill-amber-400 text-amber-400 drop-shadow"
        />
      )}

      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2 pr-6">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-text">{project.name}</h3>
          <button
            onClick={() => onCopy(project)}
            title={project.path}
            className="mt-0.5 block max-w-full truncate font-mono text-[11px] text-text-dim transition-colors hover:text-accent"
          >
            {project.path}
          </button>
        </div>
      </div>

      {/* Description */}
      {project.meta.description ? (
        <p
          className={`mb-2.5 text-[13px] leading-relaxed text-text-muted ${
            expanded ? '' : 'line-clamp-2'
          }`}
        >
          {project.meta.description}
        </p>
      ) : (
        <p className="mb-2.5 text-[13px] italic text-text-dim">No description</p>
      )}
      {longDesc && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mb-2 self-start text-[11px] font-medium text-accent hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Manifest note */}
      {project.meta.note && (
        <p className="mb-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-text-dim">
          <StickyNote size={12} className="mt-0.5 shrink-0 opacity-70" />
          <span className="line-clamp-2">{project.meta.note}</span>
        </p>
      )}

      {/* Meta tags */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.bg} ${st.border} ${st.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {project.statusLabel}
        </span>
        {kindLabel && kindLabel !== 'Project' && (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
            {kindLabel}
          </span>
        )}
        {project.detected.manager !== 'none' && (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
            {project.detected.manager}
          </span>
        )}
        {project.detected.isGitRepo && (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
            git
          </span>
        )}
      </div>

      {stackParts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {stackParts.slice(0, 4).map((s, i) => (
            <span
              key={i}
              className="rounded bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-medium text-accent/90"
            >
              {s}
            </span>
          ))}
          {stackParts.length > 4 && (
            <span className="text-[10.5px] text-text-dim">+{stackParts.length - 4}</span>
          )}
        </div>
      )}

      {/* Spacer pushes actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5 border-t border-border/60 pt-3">
        <button
          onClick={() => onLaunch(project)}
          title={devCmd ? `Run ${devCmd}` : 'Launch / open'}
          className="btn btn-accent flex-1"
        >
          <Rocket size={14} /> Launch
        </button>
        {project.detected.devCommand && (
          <IconAction
            label={`Start server · ${project.detected.devCommand}`}
            onClick={() => onStartServer(project)}
          >
            <Play size={15} />
          </IconAction>
        )}
        <IconAction label="Open in VS Code" onClick={() => onOpenVSCode(project)}>
          <Code2 size={15} />
        </IconAction>
        <IconAction label="Open folder" onClick={() => onOpenExplorer(project)}>
          <FolderOpen size={15} />
        </IconAction>
        <IconAction label="Copy path" onClick={() => onCopy(project)}>
          <Copy size={15} />
        </IconAction>
        <IconAction label="Pin to top" onClick={() => onPin(project)}>
          {project.pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </IconAction>
        <IconAction label="Delete (move to trash)" onClick={() => onDelete(project)} danger>
          <Trash2 size={15} />
        </IconAction>
        <div className="relative">
          <IconAction label="More" onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal size={15} />
          </IconAction>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="animate-pop absolute bottom-0 right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface-2 py-1 shadow-2xl">
                <MenuItem
                  icon={<FolderInput size={14} />}
                  label="Move…"
                  onClick={() => {
                    setMenuOpen(false)
                    onMove(project)
                  }}
                />
                <MenuItem
                  icon={<Archive size={14} />}
                  label="Archive"
                  onClick={() => {
                    setMenuOpen(false)
                    onArchive(project)
                  }}
                />
                <MenuItem
                  icon={<Crosshair size={14} />}
                  label="Reveal in Explorer"
                  onClick={() => {
                    setMenuOpen(false)
                    window.projectHub.revealInExplorer(project.path)
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function IconAction({
  children,
  label,
  onClick,
  danger
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`btn !px-2 ${
        danger
          ? 'text-text-muted hover:bg-red-500/15 hover:text-red-400'
          : 'text-text-muted hover:bg-surface-2 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

function MenuItem({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-surface hover:text-text"
    >
      {icon}
      {label}
    </button>
  )
}
