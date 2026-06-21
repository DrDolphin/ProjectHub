import { useEffect, useState } from 'react'
import { Trash2, RotateCcw, FolderMinus } from 'lucide-react'
import type { TrashEntry } from '@shared/types'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  entries: TrashEntry[]
  onRestore: (id: string) => void
  onEmpty: () => void
}

export function TrashModal({ open, onClose, entries, onRestore, onEmpty }: Props) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => {
    if (!open) setConfirmEmpty(false)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Trash${entries.length ? ` · ${entries.length}` : ''}`}
      icon={<Trash2 size={18} className="text-text-muted" />}
      maxWidth="max-w-xl"
    >
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-full bg-surface-2 p-4">
            <Trash2 size={26} className="text-text-dim" />
          </div>
          <p className="text-sm text-text-muted">Trash is empty</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-text-dim">
              Items here still exist on disk. Restore to put them back, or Empty Trash to remove
              permanently.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
              >
                <FolderMinus size={16} className="shrink-0 text-text-dim" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{e.name}</p>
                  <p className="truncate font-mono text-[11px] text-text-dim">{e.originalPath}</p>
                </div>
                <span className="shrink-0 text-[11px] text-text-dim">
                  {new Date(e.trashedAt).toLocaleString()}
                </span>
                <button
                  onClick={() => onRestore(e.id)}
                  className="btn btn-ghost border border-border !px-2.5"
                  title="Restore to original location"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <p className="text-xs text-red-300/80">
              {confirmEmpty
                ? `Permanently delete all ${entries.length} item(s)? This cannot be undone.`
                : 'Permanently remove everything from Trash.'}
            </p>
            {confirmEmpty ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmEmpty(false)} className="btn btn-ghost !px-2.5">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onEmpty()
                    setConfirmEmpty(false)
                  }}
                  className="btn btn-danger !px-2.5"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmEmpty(true)} className="btn btn-danger !px-2.5">
                <Trash2 size={14} /> Empty Trash
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
