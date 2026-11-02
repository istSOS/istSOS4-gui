'use client'

import { useTranslation } from 'react-i18next'

import QcExplanation from '../../qc/components/QcExplanation'
import { QualityDetails } from '../../qc/components/QcQualityDetails'
import { VERDICT_COLORS, fitsMask, rawText } from '../../qc/lib/bitmask'
import { qualityFlagDescription } from '../../qc/lib/qualityFlags'
import type { QcRow } from '../../qc/lib/types'
import type { GraphRow, GraphSeriesEntry } from '../lib/observationGraphUtils'
import { compactQuality } from '../lib/observationQuality'

/** The same compact badge and QC explanation in the table and hover tooltip. */
export default function ObservationQuality({
  row,
  entry,
  onExplainOpenChange,
}: {
  row: GraphRow
  entry: GraphSeriesEntry
  onExplainOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const quality = compactQuality(
    row.rawQuality,
    entry.qualityConstraints,
    entry.qualityMode
  )
  if (quality.code === null) return <span className="text-default-500">—</span>
  const constraints = entry.qualityConstraints ?? []
  const encoded =
    entry.qualityMode === 'bitmask' && entry.qualityConstraints !== null
  const recognized = encoded
    ? fitsMask(row.rawQuality, constraints.length)
    : entry.qualityMode === 'service' &&
      !!qualityFlagDescription(row.rawQuality)
  const qcRow: QcRow = {
    key: row.key,
    id: row.key,
    ts: row.ts,
    time: row.time,
    result: row.rawValue,
    resultQuality: row.rawQuality,
    scope: 'window',
  }
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 align-middle"
      data-observation-quality
    >
      <QcExplanation
        icon
        onOpenChange={onExplainOpenChange}
        title={`${t('qc.quality')}: ${quality.code}`}
        content={
          recognized ? (
            <QualityDetails
              row={qcRow}
              constraints={constraints}
              encoded={encoded}
              serviceMode={entry.qualityMode === 'service'}
              unit={entry.unit}
            />
          ) : (
            <div className="space-y-2">
              <p>{t('observations.quality_unknown')}</p>
              <pre className="whitespace-pre-wrap break-all rounded bg-default-100 p-2 text-xs">
                {rawText(row.rawQuality)}
              </pre>
            </div>
          )
        }
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs">
          {quality.verdict && (
            <>
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: VERDICT_COLORS[quality.verdict] }}
              />
              <span>{t(`qc.verdict.${quality.verdict}`)}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <code className="max-w-40 truncate" title={quality.code}>
            {quality.code}
          </code>
        </span>
      </QcExplanation>
    </span>
  )
}
