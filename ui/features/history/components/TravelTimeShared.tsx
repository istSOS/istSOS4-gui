import React from 'react'
import { ActionType } from './travelTimeTypes'

const BADGE: Record<ActionType, { bg: string; color: string }> = {
  INSERT: { bg: '#E6F9F1', color: '#0F6E56' },
  UPDATE: { bg: '#E6F1FB', color: '#185FA5' },
  DELETE: { bg: '#FCEBEB', color: '#A32D2D' },
}

export function ActionBadge({ action }: { action: ActionType }) {
  const { bg, color } = BADGE[action]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide"
      style={{ background: bg, color }}
    >
      {action}
    </span>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{children}</p>
}

export function DateTimeInput({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  label: string
  date: string
  time: string
  onDateChange: (v: string) => void
  onTimeChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#007668] focus:outline-none focus:ring-1 focus:ring-[#007668]"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#007668] focus:outline-none focus:ring-1 focus:ring-[#007668]"
        />
      </div>
    </div>
  )
}

export function SearchBtn({ onClick, label = 'Search' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-auto flex items-center justify-center rounded-lg bg-[#007668] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#007668] focus:ring-offset-2"
    >
      {label}
    </button>
  )
}

export function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
