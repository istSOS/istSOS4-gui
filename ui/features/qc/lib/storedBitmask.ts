import { fitsMask } from './bitmask'
import type { QcDatastream, QcRow, Workspace } from './types'

export function hasStoredConstraints(
  stream: Pick<QcDatastream, 'constraints'>
) {
  return (
    Array.isArray(stream.constraints) &&
    stream.constraints.length > 0 &&
    stream.constraints.every(
      (constraint) =>
        constraint &&
        typeof constraint === 'object' &&
        typeof constraint.type === 'string' &&
        constraint.type.trim().length > 0
    )
  )
}

export function storedBitmaskIssue(stream: QcDatastream, rows: QcRow[]) {
  if (!hasStoredConstraints(stream)) return 'no_constraints' as const
  if (stream.constraints.length > 4) return 'too_many_checks' as const
  if (
    rows.some(
      (row) =>
        row.resultQuality != null &&
        !fitsMask(row.resultQuality, stream.constraints.length)
    )
  )
    return 'invalid_quality' as const
  return null
}

/** Choose interpretation only. Original values/flags are never initialized or tested. */
export function configureStoredBitmask(
  workspace: Workspace,
  stream: QcDatastream
): Workspace {
  const rows = Object.fromEntries(
    Object.entries(workspace.rows).map(([key, row]) => {
      if (row.draftBaseQuality === undefined) return [key, row]
      const original = { ...row }
      delete original.draftBaseQuality
      return [key, original]
    })
  )
  const issue = storedBitmaskIssue(stream, Object.values(rows))
  return {
    ...workspace,
    rows,
    qualitySchema:
      issue && issue !== 'invalid_quality'
        ? undefined
        : {
            mode: 'existing',
            constraints: structuredClone(stream.constraints),
          },
  }
}
