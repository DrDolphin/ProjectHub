import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import type { Project } from '@shared/types'
import { Modal } from './Modal'

interface Props {
  project: Project | null
  onClose: () => void
  onConfirm: (p: Project) => void
}

export function DeleteModal({ project, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)
  if (!project) return null

  const confirm = async () => {
    setBusy(true)
    await onConfirm(project)
    setBusy(false)
  }

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title="Delete project"
      icon={<AlertTriangle size={18} className="text-red-400" />}
      maxWidth="max-w-md"
    >
      <p className="text-sm text-text">
        Move <span className="font-semibold text-text">{project.name}</span> to the Trash?
      </p>
      <div className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <p className="break-all font-mono text-[11.5px] text-text-dim">{project.path}</p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-dim">
        The folder will be moved into ProjectHub's Trash (same drive, instant). It will not be
        deleted from disk permanently until you <span className="text-text-muted">Empty Trash</span>.
        You can restore it any time.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost border border-border" disabled={busy}>
          Cancel
        </button>
        <button onClick={confirm} className="btn btn-danger" disabled={busy}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </Modal>
  )
}
