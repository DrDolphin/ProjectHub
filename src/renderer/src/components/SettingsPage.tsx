import { useState, useEffect } from 'react'
import { ArrowLeft, Key, Eye, EyeOff, Save, Trash2, Check, X } from 'lucide-react'
import type { AppSettings } from '@shared/types'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.projectHub.settingsGet().then((s) => {
      setSettings(s)
      setApiKey(s.deepseekApiKey)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await window.projectHub.settingsSet({ deepseekApiKey: apiKey.trim() })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    setApiKey('')
    setSaving(true)
    setError('')
    try {
      const updated = await window.projectHub.settingsSet({ deepseekApiKey: '' })
      setSettings(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const masked = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•'.repeat(key.length)
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <button onClick={onBack} className="btn btn-ghost border border-border" title="Back to projects">
          <ArrowLeft size={14} />
        </button>
        <h1 className="text-[15px] font-semibold text-text">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-xl space-y-6">
          {/* DeepSeek API Key */}
          <section className="glass rounded-xl p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
                <Key size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text">DeepSeek API Key</h2>
                <p className="text-[12px] text-text-dim">
                  Used for the AI-powered conversational project creation.
                </p>
              </div>
            </div>

            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  className="input w-full pr-10 font-mono text-[13px]"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={save}
                disabled={saving || apiKey === settings?.deepseekApiKey}
                className="btn btn-accent"
                title="Save API key"
              >
                {saved ? <Check size={14} /> : <Save size={14} />}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>

            {settings?.deepseekApiKey && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-text-dim">
                <Key size={11} />
                Current: {masked(settings.deepseekApiKey)}
                <button
                  onClick={clearKey}
                  className="ml-1 text-red-400 hover:text-red-300"
                  title="Remove API key"
                >
                  <Trash2 size={12} />
                </button>
              </p>
            )}

            {error && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-red-400">
                <X size={12} /> {error}
              </p>
            )}

            <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
              <h3 className="mb-1 text-[12px] font-semibold text-text-muted">How to get an API key</h3>
              <ol className="space-y-1 text-[12px] text-text-dim">
                <li>1. Go to{' '}
                  <span className="text-accent">platform.deepseek.com</span>
                </li>
                <li>2. Sign up or log in to your account</li>
                <li>3. Navigate to API Keys and create a new key</li>
                <li>4. Copy and paste it here</li>
              </ol>
            </div>
          </section>

          {/* Projects Root */}
          <section className="glass rounded-xl p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text">Projects Root</h2>
                <p className="text-[12px] text-text-dim">The directory where all projects live.</p>
              </div>
            </div>

            <div className="input flex items-center font-mono text-[13px] text-text-dim">
              {settings?.projectsRoot ?? 'Loading…'}
            </div>
            <p className="mt-2 text-[11px] text-text-dim">
              To change the root, use the folder button in the toolbar. Restart required.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
