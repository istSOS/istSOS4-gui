import { unrunSlots } from './checks'
import { rowValue } from './model'
import type { Drafts, QcRow } from './types'

export type CheckScope = 'selected' | 'all' | 'affected'

export function qcCheckTargets(
  scope: CheckScope,
  rows: QcRow[],
  selected: string[],
  drafts: Drafts,
  checkCount: number,
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
            : unrunSlots(rowValue(row, drafts), checkCount).some((slot) =>
                slots.includes(slot)
              )))
    )
    .map((row) => row.key)
}
