import { bufferSize, samplingMs } from './bitmask'
import { checkIssue } from './checks'
import { QC_LIMITS } from './limits'
import { changed } from './model'
import type { LoadedData, QcDatastream, Workspace } from './types'

export function qcWorkload({
  loaded,
  stream,
  workspace,
  selected,
  slots,
  start,
  end,
}: {
  loaded: LoadedData | null
  stream?: QcDatastream
  workspace: Workspace
  selected: string[]
  slots: number[]
  start: string
  end: string
}) {
  const rows = loaded?.rows ?? []
  const period = rows.filter((row) => row.scope === 'window').length
  const context = rows.length - period
  const buffer =
    loaded?.bufferSize ??
    (stream ? bufferSize(stream.constraints, stream.samplingFrequency) : 0)
  const checks =
    workspace.qualitySchema?.mode === 'existing'
      ? [...new Set(slots)].filter(
          (slot) =>
            Number.isInteger(slot) &&
            slot > 0 &&
            slot <= (stream?.constraints.length ?? 0) &&
            !checkIssue(stream!.constraints[slot - 1])
        )
      : []
  const requested = new Set(selected)
  let targets = 0
  let bufferValues = 0
  // The QC engine also includes invalidated dependent observations. This is an
  // upper estimate: eligibility, missing values and buffer fallbacks affect work.
  rows.forEach((row, index) => {
    if (
      (selected.length ? requested.has(row.key) : row.scope === 'window') ||
      workspace.drafts[row.key]?.staleSlots.length
    ) {
      targets++
      bufferValues += Math.min(buffer, index + 1) * checks.length
    }
  })
  const limits: Array<
    'observations' | 'contextBuffer' | 'previewRows' | 'targets'
  > = []
  if (period > QC_LIMITS.observations) limits.push('observations')
  if (buffer > QC_LIMITS.contextBuffer) limits.push('contextBuffer')
  if (rows.length > QC_LIMITS.previewRows) limits.push('previewRows')
  if (
    workspace.qualitySchema?.mode === 'existing' &&
    targets > QC_LIMITS.observations
  )
    limits.push('targets')
  const interval = samplingMs(stream?.samplingFrequency)
  const duration = Date.parse(`${end}Z`) - Date.parse(`${start}Z`)
  const expected =
    !loaded && interval && Number.isFinite(duration) && duration >= 0
      ? Math.floor(duration / interval) + 1
      : null
  return {
    period,
    context,
    loaded: rows.length,
    modified: Object.entries(workspace.drafts).filter(
      ([key, draft]) =>
        workspace.rows[key] && changed(workspace.rows[key], draft)
    ).length,
    checks: checks.length,
    targets: workspace.qualitySchema?.mode === 'existing' ? targets : 0,
    buffer,
    bufferValues: checks.length ? bufferValues : 0,
    expected,
    limits,
    // Large-workload warnings use the existing engine batch budget, rather than
    // inventing a percentage of the user's unknown available RAM.
    status: limits.length
      ? 'limit'
      : bufferValues > QC_LIMITS.batchValues ||
          (expected !== null && expected > QC_LIMITS.observations)
        ? 'heavy'
        : loaded
          ? 'normal'
          : 'empty',
  }
}
