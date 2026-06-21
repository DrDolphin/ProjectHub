import type { ProjectStatus } from '@shared/types'

interface StatusStyle {
  dot: string
  text: string
  bg: string
  border: string
  label: string
}

export const STATUS_STYLES: Record<ProjectStatus, StatusStyle> = {
  active: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    label: 'Active'
  },
  spec: {
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    label: 'Spec'
  },
  planning: {
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    label: 'Planning'
  },
  testing: {
    dot: 'bg-orange-400',
    text: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    label: 'Testing'
  },
  oneoff: {
    dot: 'bg-pink-400',
    text: 'text-pink-300',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    label: 'One-off'
  },
  unknown: {
    dot: 'bg-slate-400',
    text: 'text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    label: 'Project'
  },
  empty: {
    dot: 'bg-zinc-500',
    text: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    label: 'Empty'
  },
  archived: {
    dot: 'bg-violet-400',
    text: 'text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    label: 'Archived'
  }
}

export function statusStyle(s: ProjectStatus): StatusStyle {
  return STATUS_STYLES[s] ?? STATUS_STYLES.unknown
}
