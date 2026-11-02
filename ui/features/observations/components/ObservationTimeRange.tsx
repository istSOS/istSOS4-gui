'use client'

import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import UtcDateRangeInputs from '@/components/date-time/UtcDateRangeInputs'

import { utcTimestamp } from '../../qc/lib/timezone'

export default function ObservationTimeRange({
  start,
  end,
  utcOffset,
  onOffsetChange,
  onApply,
  onReset,
  loading,
  trailingAction,
}: {
  start?: string | null
  end?: string | null
  utcOffset: number
  onOffsetChange: (minutes: number) => void
  onApply?: (start: string, end: string) => void
  onReset?: () => void
  trailingAction?: ReactNode
  loading?: boolean
}) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState({ start, end })
  const [draft, setDraft] = useState({ start: start ?? '', end: end ?? '' })
  if (loaded.start !== start || loaded.end !== end) {
    setLoaded({ start, end })
    setDraft({ start: start ?? '', end: end ?? '' })
  }
  const from = utcTimestamp(draft.start),
    to = utcTimestamp(draft.end)
  const valid =
    !!draft.start &&
    !!draft.end &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    from < to
  return (
    <div className="space-y-2">
      <UtcDateRangeInputs
        start={draft.start}
        end={draft.end}
        utcOffset={utcOffset}
        onOffsetChange={onOffsetChange}
        disabled={loading}
        actions={
          <>
            <button
              type="button"
              disabled={!valid || loading}
              className="h-9 whitespace-nowrap rounded bg-primary px-3 text-sm text-white disabled:opacity-40"
              onClick={() =>
                onApply?.(
                  new Date(from).toISOString(),
                  new Date(to).toISOString()
                )
              }
            >
              {t('general.apply')}
            </button>
            <button
              type="button"
              disabled={loading}
              className="h-9 whitespace-nowrap rounded px-2 text-sm text-primary hover:bg-default-100 disabled:opacity-40"
              title={t('observations.reset_range')}
              onClick={onReset}
            >
              {t('general.reset')}
            </button>
            {trailingAction && (
              <span className="ml-auto flex items-center pl-2">
                {trailingAction}
              </span>
            )}
          </>
        }
        onStartChange={(start) => setDraft((draft) => ({ ...draft, start }))}
        onEndChange={(end) => setDraft((draft) => ({ ...draft, end }))}
      />
      {!!draft.start && !!draft.end && !valid && (
        <span role="alert" className="text-danger">
          {t('observations.invalid_range')}
        </span>
      )}
    </div>
  )
}
