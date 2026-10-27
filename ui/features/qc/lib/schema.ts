import { isMissing } from './bitmask'
import { rowValue } from './model'
import type { Constraint, QualitySchema, Workspace } from './types'

// Conversion is workspace setup. Subsequent Undo operations return to this
// baseline; discarding the draft returns to the untouched source encoding.
export function establishSchema(
  workspace: Workspace,
  schema: QualitySchema
): Workspace {
  if (schema.mode === 'service') {
    if (workspace.qualitySchema)
      throw new Error(
        'Discard this draft before changing its quality encoding.'
      )
    return {
      ...workspace,
      qualitySchema: { mode: 'service', constraints: [] },
      undo: [],
      redo: [],
    }
  }
  if (schema.constraints.length > (schema.mode === 'converted' ? 3 : 4))
    throw new Error('New recipes support at most three tests.')
  if (workspace.qualitySchema)
    throw new Error(
      'Discard this draft before changing its quality encoding or test order.'
    )
  if (schema.mode === 'converted' && Object.keys(workspace.drafts).length)
    throw new Error(
      'Export and discard existing drafts before choosing a new recipe.'
    )
  return prepareSchemaRows({
    ...workspace,
    qualitySchema: structuredClone(schema),
    undo: [],
    redo: [],
  })
}

export function prepareSchemaRows(workspace: Workspace): Workspace {
  const schema = workspace.qualitySchema
  // Choosing an existing layout preserves unknown flags for explicit repair
  // by QC. Merely loading data never rewrites source quality or draft outcomes.
  if (
    schema?.mode === 'existing' &&
    Object.values(workspace.rows).some(
      (row) => row.draftBaseQuality !== undefined
    )
  )
    return {
      ...workspace,
      rows: Object.fromEntries(
        Object.entries(workspace.rows).map(([key, row]) => {
          const original = { ...row }
          delete original.draftBaseQuality
          return [key, original]
        })
      ),
    }
  if (schema?.mode !== 'converted') return workspace
  const rows = Object.fromEntries(
    Object.entries(workspace.rows).map(([key, row]) => [
      key,
      { ...row, draftBaseQuality: isMissing(row.result) ? 0 : 3 },
    ])
  )
  const drafts = { ...workspace.drafts }
  for (const row of Object.values(rows)) {
    if (row.scope !== 'window') continue
    const draft = rowValue(row, drafts)
    drafts[row.key] = {
      ...draft,
      converted: true,
      recipe: draft.recipe ?? schema.constraints,
    }
  }
  return { ...workspace, rows, drafts }
}

export function discardSchema(workspace: Workspace): Workspace {
  return {
    ...workspace,
    drafts: {},
    undo: [],
    redo: [],
    qualitySchema: undefined,
    commitMessage: '',
    rows: Object.fromEntries(
      Object.entries(workspace.rows).map(([key, row]) => {
        const original = { ...row }
        delete original.draftBaseQuality
        return [key, original]
      })
    ),
  }
}

export const TEST_DEFAULTS: Record<string, Constraint> = {
  flagRange: { type: 'flagRange', min: 0, max: 100 },
  flagConstants: { type: 'flagConstants', window: '3h', thresh: 0.1 },
  flagZScore: {
    type: 'flagZScore',
    window: '3h',
    thresh: 3,
    method: 'modified',
    center: false,
  },
  flagNAN: { type: 'flagNAN' },
  flagJumps: { type: 'flagJumps', window: '30min', thresh: 10 },
  flagByVariance: { type: 'flagByVariance', window: '3h', thresh: 0.01 },
}
