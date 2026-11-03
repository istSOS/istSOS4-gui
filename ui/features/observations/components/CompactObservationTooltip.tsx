'use client'

import { useTranslation } from 'react-i18next'

import ObservationQuality from './ObservationQuality'

import { phenomenonTimeEnd } from '../../../lib/phenomenonTime'
import { rawText } from '../../qc/lib/bitmask'
import { formatObservationTime } from '../../qc/lib/timezone'
import type { TooltipReading } from '../lib/observationTooltip'

export default function CompactObservationTooltip({
  readings,
  utcOffset,
  onExplainOpenChange,
}: {
  readings: TooltipReading[]
  utcOffset: number
  onExplainOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="max-w-[min(420px,calc(100vw-32px))] divide-y divide-default-200 text-xs leading-5 text-foreground"
      data-observation-tooltip
    >
      {readings.map(({ entry, row, tag }) => (
        <section key={entry.id} className="py-1 first:pt-0 last:pb-0">
          <div className="flex items-center gap-1.5 font-semibold">
            {tag && (
              <span
                className="rounded bg-default-100 px-1"
                title={
                  entry.asOf
                    ? `${t('as_of.chart.marker_snapshot')}: ${formatObservationTime(entry.asOf, utcOffset)}`
                    : undefined
                }
              >
                {tag}
              </span>
            )}
            <span
              className="truncate"
              title={entry.datastreamName ?? entry.name}
            >
              {entry.datastreamName ?? entry.name}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
            <time dateTime={phenomenonTimeEnd(row.time) ?? undefined}>
              {formatObservationTime(row.time, utcOffset)}
            </time>
            <span aria-hidden>·</span>
            <strong>
              {rawText(row.rawValue)}
              {entry.unit ? ` ${entry.unit}` : ''}
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t('qc.quality')}:</span>
            <ObservationQuality
              row={row}
              entry={entry}
              onExplainOpenChange={onExplainOpenChange}
            />
          </div>
        </section>
      ))}
    </div>
  )
}
