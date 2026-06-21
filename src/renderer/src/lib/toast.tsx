import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ToastPayload } from '@shared/types'

interface ToastItem extends ToastPayload {
  expiring: boolean
}

interface ToastCtx {
  toast: (icon: string, message: string, type?: ToastPayload['type']) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, expiring: true } : t)))
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const push = useCallback(
    (icon: string, message: string, type: ToastPayload['type'] = 'info') => {
      const id = `t${counter++}`
      setItems((prev) => [...prev, { id, icon, message, type, expiring: false }])
      setTimeout(() => dismiss(id), 3600)
    },
    [dismiss]
  )

  // Subscribe to toasts pushed from the main process
  useEffect(() => {
    const off = window.projectHub.onToast((payload) => {
      push(payload.icon, payload.message, payload.type)
    })
    return off
  }, [push])

  return (
    <Ctx.Provider value={{ toast: push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-md transition-opacity duration-200 ${
              t.expiring ? 'opacity-0' : 'opacity-100'
            } ${
              t.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                : t.type === 'error'
                  ? 'border-red-500/30 bg-red-500/15 text-red-100'
                  : 'border-border bg-surface/90 text-text'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
