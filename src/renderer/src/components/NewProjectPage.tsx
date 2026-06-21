import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  Plus,
  FolderTree,
  Boxes,
  FileCode2,
  Terminal,
  Globe,
  FileText,
  Sliders,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Lock,
  Zap,
  Check
} from 'lucide-react'
import type { ProjectTemplate, CreateProjectRequest, CreateProjectResult, ChatMessage } from '@shared/types'

interface Props {
  onBack: () => void
  parents: string[]
  apiKeySet: boolean
  onCreated: (result: CreateProjectResult) => void
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

type Mode = 'quick' | 'chat'

export function NewProjectPage({ onBack, parents, apiKeySet, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('quick')

  // ---- Quick Config state ----
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [template, setTemplate] = useState<ProjectTemplate>('empty')
  const [openAfter, setOpenAfter] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CreateProjectResult | null>(null)

  // ---- Chat state ----
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I can help you create a new project. Just tell me what you're building — for example, *\"Create a React app called my-portfolio\"* or *\"Set up a Python project named data-pipeline\"* — and I'll handle the rest."
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const valid = name.trim().length > 0 && !/[\\/:*?"<>|]/.test(name.trim())

  // ---- Quick Config submit ----
  const submitQuick = async () => {
    if (!valid) return
    setBusy(true)
    setResult(null)
    const req: CreateProjectRequest = {
      name: name.trim(),
      parent: parent || undefined,
      template,
      openAfter
    }
    const res = await window.projectHub.createProject(req)
    setResult(res)
    setBusy(false)
    if (res.created) {
      onCreated(res)
      setName('')
      setParent('')
      setTemplate('empty')
    }
  }

  // ---- Chat submit ----
  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await window.projectHub.deepseekChat({ messages: updated })
      const assistantMsg: ChatMessage = { role: 'assistant', content: res.content }
      setMessages((prev) => [...prev, assistantMsg])

      // If the AI produced a project action, execute it
      if (res.projectAction) {
        const createRes = await window.projectHub.createProject(res.projectAction)
        setResult(createRes)
        if (createRes.created) {
          onCreated(createRes)
          const successMsg: ChatMessage = {
            role: 'assistant',
            content: createRes.message === 'Created'
              ? `✅ Done! I created **${res.projectAction.name}**${res.projectAction.parent ? ` inside \`${res.projectAction.parent}/\`` : ''} using the **${res.projectAction.template}** template.${res.projectAction.openAfter !== false ? '\n\nOpening in VS Code…' : ''}`
              : `⚠️ ${createRes.message}`
          }
          setMessages((prev) => [...prev, successMsg])
        }
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${(err as Error).message}`
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setChatLoading(false)
    }
  }

  // ---- Apply project from chat to Quick Config (for user tweaking) ----
  const applyChatAction = (action: CreateProjectRequest) => {
    setName(action.name)
    if (action.parent) setParent(action.parent)
    setTemplate(action.template)
    setOpenAfter(action.openAfter !== false)
    setMode('quick')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <button onClick={onBack} className="btn btn-ghost border border-border" title="Back to projects">
          <ArrowLeft size={14} />
        </button>
        <h1 className="text-[15px] font-semibold text-text">New Project</h1>

        <div className="flex-1" />

        {/* Mode switcher */}
        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setMode('quick')}
            className={`flex items-center gap-1.5 rounded-none border-0 px-3 py-1.5 text-[13px] font-medium transition-all ${
              mode === 'quick'
                ? 'bg-surface-2 text-accent'
                : 'text-text-dim hover:text-text'
            }`}
          >
            <Sliders size={14} />
            Quick Config
          </button>
          <button
            onClick={() => setMode('chat')}
            disabled={!apiKeySet}
            className={`flex items-center gap-1.5 rounded-none border-0 px-3 py-1.5 text-[13px] font-medium transition-all ${
              !apiKeySet
                ? 'cursor-not-allowed opacity-40'
                : mode === 'chat'
                  ? 'bg-surface-2 text-accent'
                  : 'text-text-dim hover:text-text'
            }`}
            title={!apiKeySet ? 'Set your DeepSeek API key in Settings to use this feature.' : 'Chat with AI to create a project'}
          >
            {apiKeySet ? <Sparkles size={14} /> : <Lock size={14} />}
            Conversational
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden">
        {mode === 'quick' ? (
          <QuickConfig
            name={name}
            onNameChange={setName}
            parent={parent}
            onParentChange={setParent}
            template={template}
            onTemplateChange={setTemplate}
            openAfter={openAfter}
            onOpenAfterChange={setOpenAfter}
            valid={valid}
            busy={busy}
            result={result}
            parents={parents}
            onSubmit={submitQuick}
          />
        ) : (
          <ChatPanel
            messages={messages}
            input={chatInput}
            onInputChange={setChatInput}
            loading={chatLoading}
            onSend={sendChat}
            onApplyAction={applyChatAction}
            chatEndRef={chatEndRef}
          />
        )}
      </main>
    </div>
  )
}

// ============================================================
// Quick Config sub-component
// ============================================================

interface QuickConfigProps {
  name: string
  onNameChange: (v: string) => void
  parent: string
  onParentChange: (v: string) => void
  template: ProjectTemplate
  onTemplateChange: (v: ProjectTemplate) => void
  openAfter: boolean
  onOpenAfterChange: (v: boolean) => void
  valid: boolean
  busy: boolean
  result: CreateProjectResult | null
  parents: string[]
  onSubmit: () => void
}

function QuickConfig({
  name,
  onNameChange,
  parent,
  onParentChange,
  template,
  onTemplateChange,
  openAfter,
  onOpenAfterChange,
  valid,
  busy,
  result,
  parents,
  onSubmit
}: QuickConfigProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mx-auto w-full max-w-lg space-y-5">
        {/* API documentation note */}
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
          <p className="flex items-center gap-1.5 text-[12px] text-accent">
            <Zap size={13} />
            <span className="font-medium">Programmatic API:</span>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-accent">
              window.projectHub.createProject(params)
            </code>
          </p>
          <p className="mt-1 text-[11px] text-text-dim">
            An AI agent can create projects directly by calling the IPC API with the same fields shown below.
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
            <span className="text-accent">name</span> — Project name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) onSubmit()
            }}
            placeholder="my-cool-project"
            className="input w-full font-mono"
          />
          {!valid && name.length > 0 && (
            <p className="mt-1 text-[11px] text-red-400">
              Invalid characters. Avoid \ / : * ? &quot; &lt; &gt; |
            </p>
          )}
        </div>

        {/* Parent */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">
            <span className="text-accent">parent</span> — Grouping folder (optional)
          </label>
          <select value={parent} onChange={(e) => onParentChange(e.target.value)} className="input w-full">
            <option value="">Projects root (top level)</option>
            {parents.map((p) => (
              <option key={p} value={p}>
                {p}/
              </option>
            ))}
          </select>
        </div>

        {/* Template */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-dim">
            <span className="text-accent">template</span> — Project scaffold <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onTemplateChange(t.id)}
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
        </div>

        {/* openAfter */}
        <div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={openAfter}
              onChange={(e) => onOpenAfterChange(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="flex items-center gap-1.5 text-sm text-text-muted">
              <FileText size={14} />
              <span className="text-accent">openAfter</span> — Open in VS Code after creating
            </span>
          </label>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-3 text-[13px] ${
              result.created
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
            }`}
          >
            <p className="font-medium">{result.created ? '✅ Created' : '⚠️ Skipped'}</p>
            <p className="mt-0.5 text-[12px] text-text-dim font-mono">{result.path}</p>
            <p className="text-[12px] text-text-dim">{result.message}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onSubmit} className="btn btn-accent" disabled={busy || !valid}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create project
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Chat Panel sub-component
// ============================================================

interface ChatPanelProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  loading: boolean
  onSend: () => void
  onApplyAction: (action: CreateProjectRequest) => void
  chatEndRef: React.RefObject<HTMLDivElement>
}

function ChatPanel({ messages, input, onInputChange, loading, onSend, onApplyAction, chatEndRef }: ChatPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} onApplyAction={onApplyAction} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-text-dim">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[13px]">Thinking…</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Describe the project you want to create…"
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="btn btn-accent"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Chat Bubble sub-component
// ============================================================

interface ChatBubbleProps {
  message: ChatMessage
  onApplyAction: (action: CreateProjectRequest) => void
}

function ChatBubble({ message, onApplyAction }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  // Extract inline project-action JSON for quick-apply button
  const actionMatch = message.content.match(/```project-action\s*\n([\s\S]*?)```/)
  let action: CreateProjectRequest | null = null
  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1]!.trim())
      if (parsed && typeof parsed.name === 'string') {
        action = parsed as CreateProjectRequest
      }
    } catch {
      /* ignore */
    }
  }

  // Render markdown-like content (simple line breaks + bold)
  const renderContent = (text: string) => {
    // Remove the project-action block for display
    let clean = text
    if (actionMatch) {
      clean = text.replace(/```project-action\s*\n[\s\S]*?```/, '')
    }
    return clean.split('\n').map((line, i) => {
      // Bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <p key={i} className={line === '' ? 'h-3' : ''}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-semibold text-text">
                  {part.slice(2, -2)}
                </strong>
              )
            }
            return <span key={j}>{part}</span>
          })}
        </p>
      )
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-accent/20' : 'bg-surface-2'
        }`}
      >
        {isUser ? <User size={15} className="text-accent" /> : <Bot size={15} className="text-accent" />}
      </div>

      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
          isUser ? 'bg-accent/15 text-text' : 'glass border border-border'
        }`}
      >
        {renderContent(message.content)}

        {action && (
          <button
            onClick={() => onApplyAction(action!)}
            className="mt-2 flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[12px] text-accent hover:bg-accent/20 transition-all"
          >
            <Check size={13} />
            Apply &amp; create <strong className="font-mono">{action.name}</strong>
          </button>
        )}
      </div>
    </div>
  )
}
