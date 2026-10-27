import {
  bufferSize,
  fitsMask,
  isMissing,
  numericValue,
  parseMask,
  setSlot,
  slotState,
  windowMs,
} from './bitmask'
import { QUALITY_FLAGS } from './qualityFlags'
import type { Constraint, Draft, Drafts, QcRow, Workspace } from './types'

export const emptyWorkspace = (): Workspace => ({
  rows: {},
  drafts: {},
  undo: [],
  redo: [],
  audit: [],
})
export const rowValue = (row: QcRow, drafts: Drafts): Draft =>
  drafts[row.key] ?? {
    result: row.result,
    resultQuality: row.draftBaseQuality ?? row.resultQuality,
    staleSlots: [],
  }

export function changed(row: QcRow, draft: Draft): boolean {
  return (
    JSON.stringify(row.result) !== JSON.stringify(draft.result) ||
    JSON.stringify(row.resultQuality) !== JSON.stringify(draft.resultQuality) ||
    draft.staleSlots.length > 0 ||
    !!draft.qualityPending ||
    !!draft.converted
  )
}

export function commitDrafts(workspace: Workspace, drafts: Drafts): Workspace {
  const normalized = Object.fromEntries(
    Object.entries(drafts).map(([key, draft]) => {
      const original = workspace.rows[key]
      const mask = parseMask(draft.resultQuality)
      // Checking an unchanged numeric string must not turn it into a changed
      // numeric JSON value. Preserve the original representation when possible.
      return [
        key,
        original &&
        !draft.converted &&
        workspace.qualitySchema?.mode !== 'service' &&
        mask !== null &&
        mask === parseMask(original.resultQuality)
          ? { ...draft, resultQuality: original.resultQuality }
          : draft,
      ]
    })
  )
  const clean = Object.fromEntries(
    Object.entries(normalized).filter(
      ([key, draft]) =>
        workspace.rows[key] &&
        (changed(workspace.rows[key], draft) || draft.outcomes?.length)
    )
  )
  if (JSON.stringify(clean) === JSON.stringify(workspace.drafts))
    return workspace
  return {
    ...workspace,
    drafts: clean,
    undo: [...workspace.undo.slice(-49), workspace.drafts],
    redo: [],
  }
}

// Recalculate invalidation from *all* edits. This also handles edits being reverted
// and overlapping windows without accidentally restoring another edit's flags.
export function editValue(
  workspace: Workspace,
  key: string,
  value: number | null,
  constraints: Constraint[],
  sampling?: string,
  baseline: Constraint[] = constraints
): Workspace {
  return editValues(
    workspace,
    { [key]: value },
    constraints,
    sampling,
    baseline
  )
}

// Apply a whole interval in one transaction. Nearest-preceding positions keep
// invalidation linear in the row count even when thousands of values change.
export function editValues(
  workspace: Workspace,
  changes: Record<string, number | null>,
  constraints: Constraint[],
  sampling?: string,
  baseline: Constraint[] = constraints,
  filledKeys: string[] = []
): Workspace {
  const drafts = { ...workspace.drafts }
  const touchedKeys = new Set<string>()
  const filled = new Set(filledKeys)
  const service = workspace.qualitySchema?.mode === 'service'
  for (const [key, value] of Object.entries(changes)) {
    const row = workspace.rows[key]
    if (!row) continue
    if (value !== null && !Number.isFinite(value))
      throw new Error('Enter a finite number, or use missing data.')
    const current = rowValue(row, drafts)
    const result =
      value !== null && numericValue(row.result) === value ? row.result : value
    if (JSON.stringify(current.result) === JSON.stringify(result)) continue
    touchedKeys.add(key)
    drafts[key] = {
      ...current,
      result,
      ...(service
        ? {
            resultQuality: null,
            qualityPending: true,
            staleSlots: [],
            outcomes: undefined,
            recipe: undefined,
          }
        : {}),
      filled:
        filled.has(key) ||
        (JSON.stringify(result) !== JSON.stringify(row.result)
          ? current.filled
          : undefined),
    }
  }
  if (!touchedKeys.size) return workspace
  if (service) return commitDrafts(workspace, drafts)
  const rows = Object.values(workspace.rows).sort((a, b) => a.ts - b.ts)
  const n = bufferSize(constraints, sampling)
  const edited = rows.filter(
    (r) =>
      rowValue(r, drafts).filled ||
      JSON.stringify(rowValue(r, drafts).result) !== JSON.stringify(r.result)
  )
  const editedKeys = new Set(edited.map((r) => r.key))
  const dependsOn = (
    index: number,
    editIndex: number,
    constraint: Constraint
  ) => {
    if (editIndex < 0) return false
    const distance = index - editIndex
    if (distance < 0 || distance >= n) return false
    if (distance === 0) return true
    if (constraint.type === 'flagRange' || constraint.type === 'flagNAN')
      return false
    const span = windowMs(constraint.window)
    return span === null || rows[index].ts - rows[editIndex].ts < span
  }
  let nearestEdit = -1
  let nearestTouched = -1
  rows.forEach((current, index) => {
    if (editedKeys.has(current.key)) nearestEdit = index
    if (touchedKeys.has(current.key)) nearestTouched = index
    const existing = rowValue(current, drafts)
    const stale = new Set<number>()
    const invalidated = new Set<number>()
    constraints.slice(0, 4).forEach((constraint, i) => {
      const slot = i + 1
      const touched = dependsOn(index, nearestTouched, constraint)
      if (touched) invalidated.add(slot)
      const resolved =
        existing.outcomes?.some((outcome) => outcome.slot === slot) &&
        !existing.staleSlots.includes(slot) &&
        !touched
      if (!resolved && dependsOn(index, nearestEdit, constraint))
        stale.add(slot)
    })
    // Every value edit invalidates its data state as well, including streams
    // without configured constraints. Data state 01 means digital.
    if (touchedKeys.has(current.key)) invalidated.add(0)
    if (
      editedKeys.has(current.key) &&
      (touchedKeys.has(current.key) ||
        !existing.outcomes?.some((outcome) => outcome.slot === 0))
    )
      stale.add(0)
    if (!stale.size && !existing.staleSlots.length && !invalidated.size) return
    const quality = existing.resultQuality
    let mask = fitsMask(quality, constraints.length) ? parseMask(quality) : null
    const originalQuality = current.draftBaseQuality ?? current.resultQuality
    const originalMask = fitsMask(originalQuality, constraints.length)
      ? parseMask(originalQuality)
      : null
    const recipe = [...(existing.recipe ?? baseline)]
    for (const slot of new Set([...existing.staleSlots, ...invalidated])) {
      if (!stale.has(slot) && mask !== null && originalMask !== null) {
        mask = setSlot(mask, slot, slotState(originalMask, slot))
        if (slot > 0) recipe[slot - 1] = baseline[slot - 1]
      }
    }
    if (editedKeys.has(current.key) && (mask !== null || quality == null)) {
      mask = isMissing(existing.result) ? 0 : setSlot(mask ?? 0, 0, 2)
    } else if (
      touchedKeys.has(current.key) &&
      mask !== null &&
      originalMask !== null
    ) {
      // Returning to the exact original restores its raw/filled data state.
      mask = setSlot(mask, 0, slotState(originalMask, 0))
    }
    // Human approval belongs to the reviewed value. Only Undo can restore it.
    if (touchedKeys.has(current.key) && mask !== null)
      mask = setSlot(mask, constraints.length + 1, 0)
    if (mask !== null)
      for (const slot of stale) if (slot > 0) mask = setSlot(mask, slot, 0)
    drafts[current.key] = {
      ...existing,
      resultQuality: mask ?? quality,
      staleSlots: [...stale],
      outcomes: existing.outcomes?.filter(
        (outcome) => !invalidated.has(outcome.slot) && !stale.has(outcome.slot)
      ),
      recipe,
    }
  })
  return commitDrafts(workspace, drafts)
}

export function reviewHuman(
  workspace: Workspace,
  keys: string[],
  state: number,
  constraints: Constraint[]
): Workspace {
  if (![0, 2, 3].includes(state))
    throw new Error('Choose accept, reject or clear review.')
  const drafts = { ...workspace.drafts }
  for (const key of new Set(keys)) {
    const row = workspace.rows[key]
    if (!row) continue
    const draft = rowValue(row, drafts)
    if (
      draft.resultQuality != null &&
      !fitsMask(draft.resultQuality, constraints.length)
    )
      throw new Error(
        'Run the stored QC checks to repair this observation’s unknown quality before human review.'
      )
    // Initializing absent quality is allowed only as part of this explicit
    // review action, never merely by confirming the interpretation.
    const mask =
      draft.resultQuality == null
        ? isMissing(draft.result)
          ? 0
          : 3
        : parseMask(draft.resultQuality)!
    if (slotState(mask, constraints.length + 1) === state) continue
    drafts[key] = {
      ...draft,
      recipe: draft.recipe ?? constraints,
      resultQuality: setSlot(mask, constraints.length + 1, state),
    }
  }
  return commitDrafts(workspace, drafts)
}

export function reconcileRecipes(
  workspace: Workspace,
  constraints: Constraint[],
  baseline: Constraint[]
): Workspace {
  if (workspace.qualitySchema?.mode === 'service') return workspace
  const drafts = { ...workspace.drafts }
  for (const row of Object.values(workspace.rows)) {
    if (row.scope === 'history' && !drafts[row.key]) continue
    const draft = rowValue(row, drafts)
    let mask = fitsMask(draft.resultQuality, constraints.length)
      ? parseMask(draft.resultQuality)
      : null
    const stale = new Set(draft.staleSlots)
    constraints.forEach((constraint, i) => {
      if (
        JSON.stringify(constraint) !==
        JSON.stringify(draft.recipe?.[i] ?? baseline[i])
      ) {
        stale.add(i + 1)
        if (mask !== null) mask = setSlot(mask, i + 1, 0)
      }
    })
    if (stale.size !== draft.staleSlots.length) {
      drafts[row.key] = {
        ...draft,
        resultQuality: mask ?? draft.resultQuality,
        staleSlots: [...stale],
      }
    }
  }
  return { ...workspace, drafts }
}

/** A service code is assigned explicitly; it is never interpreted as a mask. */
export function reviewServiceQuality(
  workspace: Workspace,
  keys: string[],
  code: number | null
): Workspace {
  if (workspace.qualitySchema?.mode !== 'service')
    throw new Error('Confirm service quality-code mode first.')
  if (code !== null && !QUALITY_FLAGS.some((flag) => flag.code === code))
    throw new Error('Choose a flag from the supplied service catalog.')
  const drafts = { ...workspace.drafts }
  for (const key of new Set(keys)) {
    const row = workspace.rows[key]
    if (!row || row.scope !== 'window') continue
    const draft = rowValue(row, drafts)
    const corrected =
      JSON.stringify(draft.result) !== JSON.stringify(row.result)
    if (code === 110 && !isMissing(draft.result))
      throw new Error('Flag 110 requires a missing value.')
    if ((code === 320 || code === 321) && !corrected)
      throw new Error(
        'Flags 320 and 321 require a value correction. Use 330 to accept an unchanged value.'
      )
    if (code === 330 && corrected)
      throw new Error(
        'Flag 330 is for unchanged values. Use 320 to accept a correction.'
      )
    drafts[key] = {
      ...draft,
      resultQuality: code,
      qualityPending: code === null,
      staleSlots: [],
    }
  }
  return commitDrafts(workspace, drafts)
}

export function reviewSlot(
  workspace: Workspace,
  key: string,
  slot: number,
  state: number,
  constraints: Constraint[],
  baseline: Constraint[]
): Workspace {
  const row = workspace.rows[key]
  if (!row) return workspace
  const draft = rowValue(row, workspace.drafts)
  if (isMissing(draft.result)) return workspace
  const previous = parseMask(draft.resultQuality)
  if (previous === null && draft.resultQuality != null) return workspace
  const mask = previous ?? 3
  const recipe = [...(draft.recipe ?? baseline)]
  recipe[slot - 1] = constraints[slot - 1]
  return commitDrafts(workspace, {
    ...workspace.drafts,
    [key]: {
      ...draft,
      resultQuality: setSlot(
        slotState(mask, 0) ? mask : setSlot(mask, 0, 3),
        slot,
        state
      ),
      staleSlots: draft.staleSlots.filter((s) => s !== slot),
      recipe,
      outcomes: [
        ...(draft.outcomes ?? []).filter((outcome) => outcome.slot !== slot),
        { slot, state, reason: 'Manual review' },
      ],
    },
  })
}

export function undo(workspace: Workspace): Workspace {
  if (!workspace.undo.length) return workspace
  return {
    ...workspace,
    drafts: workspace.undo.at(-1)!,
    undo: workspace.undo.slice(0, -1),
    redo: [...workspace.redo, workspace.drafts],
  }
}
export function redo(workspace: Workspace): Workspace {
  if (!workspace.redo.length) return workspace
  return {
    ...workspace,
    drafts: workspace.redo.at(-1)!,
    redo: workspace.redo.slice(0, -1),
    undo: [...workspace.undo, workspace.drafts],
  }
}
