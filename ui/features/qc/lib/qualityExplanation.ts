import { checkStatus, fitsMask, parseMask, slotState } from './bitmask'
import type { Constraint, Draft, QcRow } from './types'

export function explainCheck(
  row: QcRow,
  draft: Draft | undefined,
  constraints: Constraint[],
  slot: number,
  encoded: boolean
) {
  if (!encoded)
    return { status: 'unknown', source: 'unconfirmed', reason: null }
  if (draft?.staleSlots.includes(slot))
    return { status: 'stale', source: 'pending', reason: null }
  const quality = draft ? draft.resultQuality : row.resultQuality
  if (!fitsMask(quality, constraints.length))
    return {
      status: 'unknown',
      source: draft ? 'draft' : 'recorded',
      reason: null,
    }
  const state = slotState(parseMask(quality)!, slot)
  const outcome = draft?.outcomes?.find(
    (item) => item.slot === slot && item.state === state
  )
  if (outcome)
    return {
      status: checkStatus(state),
      source: outcome.reason === 'Manual review' ? 'draft' : 'run',
      reason: outcome.reason || null,
    }
  const inherited =
    !draft ||
    (fitsMask(row.resultQuality, constraints.length) &&
      slotState(parseMask(row.resultQuality)!, slot) === state)
  return {
    status: checkStatus(state),
    source: inherited ? 'recorded' : 'draft',
    reason: null,
  }
}
