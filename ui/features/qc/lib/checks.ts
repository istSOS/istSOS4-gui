import { fitsMask, isMissing, parseMask, slotState } from './bitmask'
import type { Constraint, Draft } from './types'

const PARAMETERS: Record<string, string[]> = {
  flagRange: ['min', 'max'],
  flagConstants: ['window', 'thresh', 'min_periods'],
  flagZScore: [
    'window',
    'thresh',
    'method',
    'center',
    'min_periods',
    'min_residuals',
  ],
  flagNAN: [],
  flagJumps: ['window', 'thresh', 'min_periods'],
  flagByVariance: ['window', 'thresh', 'maxna', 'maxna_group'],
}

/** Definitions that cannot be reproduced unchanged must retain recorded flags. */
export function checkIssue(constraint: Constraint): string | null {
  const fields = PARAMETERS[constraint.type]
  if (!fields) return 'Unsupported test function'
  if (constraint.column && constraint.column !== 'result')
    return 'Only the result column is supported'
  const extra = Object.keys(constraint).filter(
    (key) => !['type', 'column', ...fields].includes(key)
  )
  if (extra.length) return `Unsupported parameters: ${extra.join(', ')}`
  if (constraint.type === 'flagZScore' && constraint.center !== false)
    return 'Historical checks require the stored center parameter to be false'
  return null
}

export const runnableSlots = (constraints: Constraint[]) =>
  constraints.flatMap((constraint, index) =>
    checkIssue(constraint) ? [] : [index + 1]
  )

export function unrunSlots(draft: Draft, count: number): number[] {
  if (isMissing(draft.result)) return []
  const mask = fitsMask(draft.resultQuality, count)
    ? parseMask(draft.resultQuality)
    : null
  return Array.from({ length: count }, (_, index) => index + 1).filter(
    (slot) => mask === null || slotState(mask, slot) < 2
  )
}
