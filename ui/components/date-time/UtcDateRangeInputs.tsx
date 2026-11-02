'use client'

import {
  UTC_OFFSETS,
  formatUtcOffset,
  fromOffsetInput,
  toOffsetInput,
} from '@/features/qc/lib/timezone'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Canonical values stay UTC; the offset changes only the displayed clock times. */
export default function UtcDateRangeInputs({
  start,
  end,
  utcOffset,
  onStartChange,
  onEndChange,
  onOffsetChange,
  disabled = false,
  actions,
  controlClassName = 'h-9 min-w-0 rounded border border-default-300 bg-content1 px-2 py-1.5 text-sm',
}: {
  start: string
  end: string
  utcOffset: number
  onStartChange: (utc: string) => void
  onEndChange: (utc: string) => void
  onOffsetChange: (minutes: number) => void
  actions?: ReactNode
  disabled?: boolean
  controlClassName?: string
}) {
  const { t } = useTranslation()
  const offset = formatUtcOffset(utcOffset)
  return (
    <div
      className={
        actions
          ? 'grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10.5rem_auto]'
          : 'grid gap-3 sm:grid-cols-3'
      }
    >
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        {t('qc.from_offset', { offset })}
        <input
          type="datetime-local"
          step="0.001"
          className={controlClassName}
          value={toOffsetInput(start, utcOffset)}
          disabled={disabled}
          onChange={(event) =>
            onStartChange(fromOffsetInput(event.target.value, utcOffset))
          }
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        {t('qc.to_offset', { offset })}
        <input
          type="datetime-local"
          step="0.001"
          className={controlClassName}
          value={toOffsetInput(end, utcOffset)}
          disabled={disabled}
          onChange={(event) =>
            onEndChange(fromOffsetInput(event.target.value, utcOffset))
          }
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        {t('qc.utc_offset')}
        <select
          className={controlClassName}
          value={utcOffset}
          disabled={disabled}
          title={t('qc.fixed_offset_hint')}
          onChange={(event) => onOffsetChange(Number(event.target.value))}
        >
          {UTC_OFFSETS.map((value) => (
            <option key={value} value={value}>
              UTC{formatUtcOffset(value)}
            </option>
          ))}
        </select>
      </label>
      {actions && (
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
          {actions}
        </div>
      )}
    </div>
  )
}
