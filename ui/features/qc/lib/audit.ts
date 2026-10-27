import { rowValue } from './model'
import type { AuditEntry, Workspace } from './types'

export type AuditContext = Pick<AuditEntry, 'actor' | 'source' | 'datastream'>

// Append-only draft history: undo/discard describe a new event rather than
// deleting the event that originally changed the observations.
export function appendAudit(
  before: Workspace,
  after: Workspace,
  context: AuditContext,
  action: string,
  parameters: Record<string, unknown> = {},
  force = false
): Workspace {
  const changes: AuditEntry['changes'] = []
  for (const key of new Set([
    ...Object.keys(before.drafts),
    ...Object.keys(after.drafts),
  ])) {
    const row = after.rows[key] ?? before.rows[key]
    if (!row) continue
    const beforeRow = before.rows[key] ?? row
    // Context can have a virtual baseline without an observation draft. Its
    // first recorded change must retain the actual source quality.
    const previous = rowValue(
      before.drafts[key]
        ? beforeRow
        : { ...beforeRow, draftBaseQuality: undefined },
      before.drafts
    )
    const next = rowValue(row, after.drafts)
    if (JSON.stringify(previous) !== JSON.stringify(next))
      changes.push({
        key,
        observationId: row.id,
        time: row.time,
        before: previous,
        after: next,
      })
  }
  if (!changes.length && !force) return after
  const entry: AuditEntry = {
    ...context,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    action,
    parameters: {
      qualitySchemaBefore: before.qualitySchema ?? null,
      qualitySchemaAfter: after.qualitySchema ?? null,
      ...parameters,
    },
    changes,
  }
  // Snapshot nested parameter/recipe objects independently from later edits.
  return {
    ...after,
    audit: [
      ...(before.audit ?? []),
      JSON.parse(JSON.stringify(entry)) as AuditEntry,
    ],
  }
}
