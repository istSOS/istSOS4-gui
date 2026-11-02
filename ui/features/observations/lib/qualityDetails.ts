import { QUALITY_STATUS_COLORS, type QualityConstraint } from './resultQuality'

import {
  VERDICT_COLORS,
  checkStatus,
  dataStatus,
  fitsMask,
  humanStatus,
  parseMask,
  rawText,
  slotState,
} from '../../qc/lib/bitmask'

export const rawQualityText = rawText
export type QualityDetail = {
  label: string
  value: string
  color: string
  description?: string
}
type Translate = (
  key: string,
  options?: { defaultValue?: string; count?: number }
) => string

/** Decode each pair using the exact same helpers as the Edit/QC plot and table. */
export function qualityDetails(
  raw: unknown,
  constraints: QualityConstraint[] | null,
  t: Translate
): {
  rows: QualityDetail[]
  unavailable?: string
} {
  if (raw == null) return { rows: [] }
  if (!constraints)
    return {
      rows: [],
      unavailable: t('quality.bitmask.constraints_unreadable'),
    }
  const mask = parseMask(raw)
  if (mask === null || !fitsMask(raw, constraints.length))
    return {
      rows: [],
      unavailable: t('quality.bitmask.does_not_fit', {
        count: constraints.length,
      }),
    }
  const colors: Record<string, string> = {
    passed: QUALITY_STATUS_COLORS.passed,
    failed: QUALITY_STATUS_COLORS.failed,
    not_run: QUALITY_STATUS_COLORS.not_executed,
    reserved: QUALITY_STATUS_COLORS.unused,
  }
  const checks = constraints.map((constraint, i) => {
    const status = checkStatus(slotState(mask, i + 1))
    return {
      label: t(`qc.workflow.tests.${constraint.type}`, {
        defaultValue: constraint.type,
      }),
      description: Object.entries(constraint)
        .map(
          ([key, value]) =>
            `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`
        )
        .join(', '),
      value: t(`qc.${status}`),
      color: colors[status],
    }
  })
  const data = dataStatus(mask)
  const human = humanStatus(slotState(mask, constraints.length + 1))
  return {
    rows: [
      ...checks,
      {
        label: t('qc.data_state_label'),
        value: t(`qc.data_state.${data}`),
        color: QUALITY_STATUS_COLORS[data === 'missing' ? 'no_data' : data],
      },
      {
        label: t('qc.human_review'),
        value: t(`qc.${human}`),
        color:
          human === 'accepted'
            ? VERDICT_COLORS.accepted
            : human === 'rejected'
              ? VERDICT_COLORS.rejected
              : VERDICT_COLORS.none,
      },
    ],
  }
}
