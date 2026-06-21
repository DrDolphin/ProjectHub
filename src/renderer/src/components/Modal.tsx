import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-lg' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`animate-pop glass flex max-h-[85vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {icon}
            <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost !px-2" title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
