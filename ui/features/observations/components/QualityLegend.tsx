'use client'

import { useTranslation } from 'react-i18next'

import { formatSnapshotLabel } from '../lib/observationGraphUtils'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  type QualityTally,
  qualityLabel,
} from '../lib/resultQuality'

export type QualityLegendLane = {
  tag?: string
  label?: string
  tally: QualityTally
  asOf?: string | null
}
export default function QualityLegend({
  lanes,
}: {
  lanes: QualityLegendLane[]
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1 px-3 text-[11px] leading-tight">
      {lanes.map((lane, index) => (
        <div
          key={lane.tag ?? index}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          {(lane.tag || lane.label || lane.asOf) && (
            <span className="font-semibold">
              {lane.tag ? `${lane.tag} — ` : ''}
              {lane.label ?? ''}
              {lane.asOf ? ` ${formatSnapshotLabel(lane.asOf)}` : ''}
            </span>
          )}
          {QUALITY_CLASSES.filter((key) => lane.tally[key] > 0).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ background: QUALITY_COLORS[key] }}
              />
              {qualityLabel(key, t)}{' '}
              <span className="tabular-nums">
                {lane.tally[key].toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
