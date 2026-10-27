import * as XLSX from 'xlsx'

import { unrunSlots } from './checks'
import { changed } from './model'
import { QUALITY_FLAGS, qualityFlagDescription } from './qualityFlags'
import type { Workspace } from './types'

const cell = (value: unknown) =>
  value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value

export function draftWorkbook(cache: Record<string, Workspace>) {
  const workbook = XLSX.utils.book_new()
  let index = 1
  for (const [streamKey, workspace] of Object.entries(cache)) {
    const rows = Object.entries(workspace.drafts)
      .filter(
        ([key, draft]) =>
          workspace.rows[key] && changed(workspace.rows[key], draft)
      )
      .map(([key, draft]) => {
        const row = workspace.rows[key]
        return {
          sourceAndDatastream: streamKey,
          observationId: row.id,
          time: row.time,
          result: cell(draft.result),
          resultQuality: cell(draft.resultQuality),
          commitMessage: workspace.commitMessage?.trim() ?? '',
          originalResult: cell(row.result),
          originalQuality: cell(row.resultQuality),
          qualityEncoding:
            workspace.qualitySchema?.mode === 'service'
              ? 'service-quality-code'
              : workspace.qualitySchema
                ? 'istsos-two-bit'
                : 'unconfirmed',
          qualityDescription:
            workspace.qualitySchema?.mode === 'service'
              ? qualityFlagDescription(draft.resultQuality)
              : '',
          qualityPending: draft.qualityPending === true,
          qualityMode: workspace.qualitySchema?.mode ?? '',
          orderedRecipe: workspace.qualitySchema
            ? JSON.stringify(
                draft.recipe ?? workspace.qualitySchema.constraints
              )
            : '',
          humanPair:
            workspace.qualitySchema &&
            workspace.qualitySchema.mode !== 'service'
              ? workspace.qualitySchema.constraints.length + 1
              : '',
          pendingChecks: [
            ...new Set([
              ...draft.staleSlots,
              ...(workspace.qualitySchema?.mode === 'service'
                ? []
                : unrunSlots(
                    draft,
                    workspace.qualitySchema?.constraints.length ?? 0
                  )),
            ]),
          ].join(','),
          checks: draft.recipe ? JSON.stringify(draft.recipe) : '',
          outcomes: draft.outcomes ? JSON.stringify(draft.outcomes) : '',
        }
      })
      .sort((a, b) => a.time.localeCompare(b.time))
    if (rows.length)
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(rows),
        `Datastream_${index++}`
      )
  }
  const audit = Object.values(cache)
    .flatMap((workspace) => workspace.audit ?? [])
    .sort((a, b) => a.time.localeCompare(b.time))
  if (index === 1 && !audit.length) return null
  const metadata = Object.entries(cache)
    .filter(([, ws]) => ws.datastream || ws.commitMessage)
    .map(([key, ws]) => ({
      sourceAndDatastream: key,
      sourceEndpoint: ws.sourceEndpoint ?? '',
      datastreamId: ws.datastream?.id ?? '',
      datastreamName: ws.datastream?.name ?? '',
      thing: ws.datastream?.thing ?? '',
      commitMessage: ws.commitMessage?.trim() ?? '',
    }))
  if (metadata.length)
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(metadata),
      'Export metadata'
    )
  if (Object.values(cache).some((ws) => ws.qualitySchema?.mode === 'service'))
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([...QUALITY_FLAGS]),
      'Service quality flags'
    )
  if (audit.length) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        audit.map((entry) => ({
          eventId: entry.id,
          time: entry.time,
          actor: entry.actor,
          source: entry.source,
          datastream: entry.datastream,
          action: entry.action,
          affectedObservations: entry.changes.length,
        }))
      ),
      'Audit log'
    )
    const changes = audit.flatMap((entry) =>
      entry.changes.map((change) => ({
        eventId: entry.id,
        action: entry.action,
        eventTime: entry.time,
        actor: entry.actor,
        source: entry.source,
        datastream: entry.datastream,
        observationId: change.observationId,
        observationKey: change.key,
        time: change.time,
        beforeResult: cell(change.before.result),
        afterResult: cell(change.after.result),
        beforeQuality: cell(change.before.resultQuality),
        afterQuality: cell(change.after.resultQuality),
        beforeState: JSON.stringify(change.before),
        afterState: JSON.stringify(change.after),
      }))
    )
    if (changes.length)
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(changes),
        'Audit changes'
      )
    // Excel limits each cell to 32,767 characters. Split large anchor/target lists
    // without dropping details; concatenate value parts in their numbered order.
    const parameters = audit.flatMap((entry) =>
      Object.entries(entry.parameters).flatMap(([parameter, value]) => {
        const encoded = JSON.stringify(value) ?? 'null'
        return Array.from(
          { length: Math.max(1, Math.ceil(encoded.length / 30000)) },
          (_, part) => ({
            eventId: entry.id,
            parameter,
            part: part + 1,
            json: encoded.slice(part * 30000, (part + 1) * 30000),
          })
        )
      })
    )
    if (parameters.length)
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(parameters),
        'Audit parameters'
      )
  }
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Draft export — no data has been written to istSOS4'],
      ['Times retain their original UTC offset and precision.'],
      [
        'Quality encoding',
        'istSOS two-bit pairs: 0 data state, 1..N ordered tests, N+1 human review. Decode with orderedRecipe.',
      ],
      [
        'Check states',
        'Checks: 3 passed, 2 failed, 0 not run, 1 unused. Data: 3 raw, 2 filled/corrected, 0 missing, 1 digital. Human: 3 accepted, 2 rejected, 0 not reviewed, 1 unused.',
      ],
      [
        'pendingChecks',
        'Results in these slots need checking; do not treat them as validated. Slot 0 is data-state validation.',
      ],
      [
        'checks',
        'Stored parameters used for check runs. Legacy exports may contain temporary parameters; consult orderedRecipe and audit history.',
      ],
      [
        'Service quality codes',
        'Use the supplied sosraw catalog, not bit operations. qualityPending=true means a quality flag still needs an explicit decision.',
      ],
      [
        'Audit',
        'Append-only browser draft history, including undo, redo, discard and check runs. This is not a server commit log.',
      ],
      [
        'Commit message',
        'Planned message for a future write request (commit-message HTTP header). Export does not create a server commit.',
      ],
      [
        'Audit parameters',
        'Values are JSON. Concatenate json fields by eventId and parameter in ascending part order before decoding.',
      ],
    ]),
    'Read me'
  )
  return workbook
}

export function exportDrafts(cache: Record<string, Workspace>) {
  const workbook = draftWorkbook(cache)
  if (!workbook) return
  XLSX.writeFile(
    workbook,
    `istsos-qc-drafts_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`
  )
}
