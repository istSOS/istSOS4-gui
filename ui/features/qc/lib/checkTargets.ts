import { rowValue } from './model'
import type { Drafts, QcRow } from './types'

export type CheckScope = 'selected' | 'all' | 'affected'

export function qcCheckTargets(
  scope: CheckScope,
  rows: QcRow[],
  selected: string[],
  drafts: Drafts,
  slots: number[]
): string[] {
  const keys = new Set(selected)
  return rows
    .filter(
      (row) =>
        row.scope === 'window' &&
        (scope === 'all' ||
          (scope === 'selected'
            ? keys.has(row.key)
            : // Only checks an edit invalidated: the edited observations
              // and those whose window includes one. Checks never run in
              // the source data stay as they are.
              rowValue(row, drafts).staleSlots.some((slot) =>
                slots.includes(slot)
              )))
    )
    .map((row) => row.key)
}
