import { useState } from 'react'
import { Plus, FolderTree, Boxes, FileCode2, Terminal, Globe, FileText } from 'lucide-react'
import type { ProjectTemplate, CreateProjectResult } from '@shared/types'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  parents: string[]
  onCreated: (result: CreateProjectResult, openAfter: boolean) => void
}

interface TemplateOption {
  id: ProjectTemplate
  label: string
  desc: string
  icon: React.ReactNode
}

const TEMPLATES: TemplateOption[] = [
  { id: 'empty', label: 'Empty folder', desc: 'Just a folder', icon: <FolderTree size={16} /> },
  { id: 'node', label: 'Node.js', desc: 'package.json + index.js', icon: <FileCode2 size={16} /> },
  { id: 'vite-react', label: 'Vite + React', desc: 'TS/JSX scaffold', icon: <Boxes size={16} /> },
  { id: 'nextjs', label: 'Next.js', desc: 'app-ready scripts', icon: <FileCode2 size={16} /> },
  { id: 'python', label: 'Python', desc: 'pyproject.toml', icon: <Terminal size={16} /> },
  { id: 'static', label: 'Static HTML', desc: 'index.html', icon: <Globe size={16} /> }
]

export function CreateModal({ open, onClose, parents, onCreated }: Props) {
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [template, setTemplate] = useState<ProjectTemplate>('empty')
  const [openAfter, setOpenAfter] = useState(true)
  const [busy, setBusy] = useState(false)

  const valid = name.trim().length > 0 && !/[\\/:*?"<>|]/.test(name.trim())

  const submit = async () => {
    if (!valid) return
    setBusy(true)
    const result = await window.projectHub.createProject({
      name: name.trim(),
      parent: parent || undefined,
      template,
      openAfter
    })
    onCreated(result, openAfter)
    setBusy(false)
    setName('')
    setParent('')
    setTemplate('empty')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      icon={<Plus size={18} className="text-accent" />}
      maxWidth="max-w-lg"
    >
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
        Project name
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) submit()
        }}
        placeholder="my-cool-project"
        className="input w-full font-mono"
      />
      {!valid && name.length > 0 && (
        <p className="mt-1 text-[11px] text-red-400">
          Invalid characters. Avoid \ / : * ? &quot; &lt; &gt; |
        </p>
      )}

      <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
        Create inside (optional grouping folder)
      </label>
      <select value={parent} onChange={(e) => setParent(e.target.value)} className="input w-full">
        <option value="">Projects root (top level)</option>
        {parents.map((p) => (
          <option key={p} value={p}>
            {p}/
          </option>
        ))}
      </select>

      <label className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
        Template
      </label>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all ${
              template === t.id
                ? 'border-accent/60 bg-accent/10'
                : 'border-border bg-surface-2 hover:border-border hover:bg-surface'
            }`}
          >
            <span className={template === t.id ? 'text-accent' : 'text-text-muted'}>{t.icon}</span>
            <span className="text-[12.5px] font-medium text-text">{t.label}</span>
            <span className="text-[10.5px] text-text-dim">{t.desc}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={openAfter}
          onChange={(e) => setOpenAfter(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span className="flex items-center gap-1.5 text-sm text-text-muted">
          <FileText size={14} /> Open in VS Code after creating
        </span>
      </label>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost border border-border" disabled={busy}>
          Cancel
        </button>
        <button onClick={submit} className="btn btn-accent" disabled={busy || !valid}>
          <Plus size={14} /> Create project
        </button>
      </div>
    </Modal>
  )
}
