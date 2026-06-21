import { CheckCircle2, DownloadCloud, Loader2, AlertCircle } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'

interface Props {
  version: string
  update: UpdateStatus | null
  onCheckUpdates: () => void
  onInstallUpdate: () => void
}

/**
 * Slim footer bar: app version on the left, auto-updater state on the right.
 * Consolidates update UX here so the toolbar stays focused on project actions.
 */
export function StatusBar({ version, update, onCheckUpdates, onInstallUpdate }: Props) {
  const state = update?.state ?? 'idle'
  const v = update?.version ? `v${update.version}` : ''

  return (
    <footer className="z-20 flex shrink-0 items-center justify-between border-t border-border bg-surface/70 px-5 py-1.5 backdrop-blur-md">
      {/* Version */}
      <span className="font-mono text-[11px] text-text-dim" title="Installed version">
        {version ? `v${version}` : '—'}
      </span>

      {/* Update status */}
      <div className="flex items-center">
        {state === 'downloaded' ? (
          <button
            onClick={onInstallUpdate}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
            title="Quit, install the update, and relaunch"
          >
            <DownloadCloud size={12} /> Install {v} → restart
          </button>
        ) : state === 'downloading' ? (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-muted"
            title="Downloading the update in the background"
          >
            <Loader2 size={12} className="animate-spin" />
            Downloading {v}
            {update?.progress != null ? ` · ${update.progress}%` : ''}
          </span>
        ) : state === 'checking' || state === 'available' ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-muted">
            <Loader2 size={12} className="animate-spin" /> Checking for updates…
          </span>
        ) : state === 'error' ? (
          <button
            onClick={onCheckUpdates}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
            title={update?.message ?? 'Update check failed — click to retry'}
          >
            <AlertCircle size={12} /> Couldn't check for updates · retry
          </button>
        ) : (
          // idle | not-available
          <button
            onClick={onCheckUpdates}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
            title="Check for updates"
          >
            <CheckCircle2 size={12} className="text-emerald-500/80" /> Up to date
          </button>
        )}
      </div>
    </footer>
  )
}
