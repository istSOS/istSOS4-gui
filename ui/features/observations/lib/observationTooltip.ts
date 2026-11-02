import type { GraphRow, GraphSeriesEntry } from './observationGraphUtils'
import { compactQuality } from './observationQuality'

import { VERDICT_COLORS, rawText } from '../../qc/lib/bitmask'
import { qualityFlagDescription } from '../../qc/lib/qualityFlags'
import { formatObservationTime } from '../../qc/lib/timezone'

export type TooltipReading = {
  entry: GraphSeriesEntry
  row: GraphRow
  tag?: string
}
export const escapeTooltipHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  )

/** Static fallback for non-React consumers; the app renders the same data with QC info popups. */
export function compactTooltipHtml(
  readings: TooltipReading[],
  utcOffset: number,
  t: (key: string) => string
): string {
  const escape = escapeTooltipHtml
  return readings
    .map(({ entry, row, tag }) => {
      const quality = compactQuality(
        row.rawQuality,
        entry.qualityConstraints,
        entry.qualityMode
      )
      const status = quality.verdict
        ? `<span style="color:${VERDICT_COLORS[quality.verdict]}">${escape(t(`qc.verdict.${quality.verdict}`))}</span> · `
        : ''
      const description = qualityFlagDescription(row.rawQuality, t)
      const title = description ? ` title="${escape(description)}"` : ''
      return `<section style="padding:3px 0"><div style="font-weight:600">${tag ? `${escape(tag)} · ` : ''}${escape(entry.datastreamName ?? entry.name)}</div><div><time>${escape(formatObservationTime(row.time ?? new Date(row.ts).toISOString(), utcOffset))}</time> · <strong>${escape(rawText(row.rawValue))}${entry.unit ? ` ${escape(entry.unit)}` : ''}</strong></div><div>${escape(t('qc.quality'))}: ${quality.code === null ? '—' : `${status}<code${title}>${escape(quality.code)}</code> <span aria-label="${escape(t('observations.quality_info'))}">ⓘ</span>`}</div></section>`
    })
    .join('<hr style="margin:4px 0;opacity:0.25"/>')
}
