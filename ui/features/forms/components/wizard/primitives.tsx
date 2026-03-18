'use client'

import type { ReactNode } from 'react'

export function StepCard({
  active,
  complete,
  label,
  icon,
  onClick,
}: {
  active: boolean
  complete: boolean
  label: string
  icon?: ReactNode
  onClick: () => void
}) {
  const tone = active
    ? 'border-l-primary bg-primary/5 text-primary'
    : complete
      ? 'border-l-success text-success'
      : 'border-l-transparent text-default-500 hover:bg-default-50'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-l-2 px-3 py-2 text-left transition ${tone}`}
    >
      <div className="flex items-center gap-2">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <div className="text-sm font-medium">{label}</div>
      </div>
    </button>
  )
}

export function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-default-200 hover:border-default-300'
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-default-500">{description}</div>
    </button>
  )
}

export function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <div className="text-lg font-semibold">{title}</div>
      {description ? (
        <div className="mt-1 text-sm text-default-500">{description}</div>
      ) : null}
    </div>
  )
}
