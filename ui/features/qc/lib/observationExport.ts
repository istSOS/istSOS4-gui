import * as XLSX from 'xlsx'

import { changed, rowValue } from './model'
import {
  formatObservationTime,
  formatUtcOffset,
  validUtcOffset,
} from './timezone'
import type { QcRow, Workspace } from './types'

export type ObservationExportOptions = {
  scope: 'loaded' | 'changed'
  utcOffset: number
  versioningEnabled: boolean
}

export function observationExportRows(
  workspace: Workspace,
  scope: ObservationExportOptions['scope']
) {
  return Object.values(workspace.rows)
    .filter((row) =>
      scope === 'loaded'
        ? row.scope === 'window'
        : !!workspace.drafts[row.key] && changed(row, workspace.drafts[row.key])
    )
    .sort((a, b) => a.ts - b.ts)
    .map((row) => ({ row, value: rowValue(row, workspace.drafts) }))
}

/** Text timestamps retain source precision and use the workbook's chosen offset. */
export function observationExportTime(time: string, utcOffset: number): string {
  return formatObservationTime(time, utcOffset)
    .split('/')
    .map((instant) =>
      instant.replace(/Z$/, '+0000').replace(/([+-]\d{2}):(\d{2})$/, '$1$2')
    )
    .join('/')
}

function scalar(value: unknown): string | number | boolean {
  return value == null
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : (value as string | number | boolean)
}

function sheetName(name: string, fallback: string, used: Set<string>) {
  const base =
    (name.trim() || fallback)
      .replace(/[\\/*?:[\]\x00-\x1f]/g, '_')
      .replace(/^'+|'+$/g, '')
      .slice(0, 31) || fallback
  let resolved = base.toLowerCase() === 'history' ? 'History_data' : base
  let index = 2
  while (used.has(resolved.toLowerCase())) {
    const suffix = `_${index++}`
    resolved = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(resolved.toLowerCase())
  return resolved
}

export function observationExportProblem(
  cache: Record<string, Workspace>,
  options: ObservationExportOptions
): 'message' | 'message_format' | 'pending' | null {
  const entries = Object.values(cache)
    .map((workspace) => ({
      workspace,
      rows: observationExportRows(workspace, options.scope),
    }))
    .filter((entry) => entry.rows.length)
  if (
    options.versioningEnabled &&
    entries.some(({ workspace }) => !workspace.commitMessage?.trim())
  )
    return 'message'
  if (
    entries.some(
      ({ workspace }) =>
        /[\r\n\x00]/.test(workspace.commitMessage ?? '') ||
        (workspace.commitMessage?.length ?? 0) > 32767
    )
  )
    return 'message_format'
  if (
    entries.some(({ rows }) =>
      rows.some(({ value }) => value.qualityPending || value.staleSlots.length)
    )
  )
    return 'pending'
  return null
}

/** The example's first three columns, followed by planned per-batch metadata. */
export function observationWorkbook(
  cache: Record<string, Workspace>,
  options: ObservationExportOptions
): XLSX.WorkBook | null {
  if (!validUtcOffset(options.utcOffset))
    throw new Error('Choose a valid UTC offset.')
  const problem = observationExportProblem(cache, options)
  if (problem === 'message')
    throw new Error(
      'A commit message is required for every included datastream when versioning is enabled.'
    )
  if (problem === 'message_format')
    throw new Error(
      'Use a single-line commit message of at most 32,767 characters.'
    )
  if (problem === 'pending')
    throw new Error(
      'Complete the pending checks or quality decisions, or export a detailed draft backup instead.'
    )
  const entries = Object.entries(cache)
    .map(([key, workspace]) => ({
      key,
      workspace,
      rows: observationExportRows(workspace, options.scope),
    }))
    .filter((entry) => entry.rows.length)
  if (!entries.length) return null
  const groups = new Set(
    entries.map(({ workspace }) =>
      JSON.stringify([
        workspace.sourceEndpoint ?? '',
        workspace.datastream?.thing ?? '',
      ])
    )
  )
  if (groups.size > 1)
    throw new Error('Export one station from one source per workbook.')
  const book = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const { key, workspace, rows } of entries) {
    const data = rows.map(({ row, value }) => ({
      time: observationExportTime(row.time, options.utcOffset),
      result: scalar(value.result),
      resultQuality: scalar(value.resultQuality),
      commitMessage: workspace.commitMessage?.trim() ?? '',
    }))
    const sheet = XLSX.utils.json_to_sheet(data, {
      header: ['time', 'result', 'resultQuality', 'commitMessage'],
    })
    sheet['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 70 }]
    sheet['!autofilter'] = { ref: `A1:D${data.length + 1}` }
    XLSX.utils.book_append_sheet(
      book,
      sheet,
      sheetName(
        workspace.datastream?.name ?? '',
        `Datastream_${workspace.datastream?.id ?? key.split('::').at(-1) ?? book.SheetNames.length + 1}`,
        used
      )
    )
  }
  return book
}

/** Same Thing + last-observation filename convention as the supplied workbook. */
export function observationWorkbookFilename(
  cache: Record<string, Workspace>,
  options: ObservationExportOptions
): string {
  const entries = Object.values(cache).filter(
    (workspace) => observationExportRows(workspace, options.scope).length
  )
  const rows = entries.flatMap((workspace) =>
    observationExportRows(workspace, options.scope).map(({ row }) => row)
  )
  if (!rows.length) throw new Error('No observations to export.')
  const last = rows.reduce((latest: QcRow, row) =>
    Date.parse(row.time.split('/').at(-1)!) >
    Date.parse(latest.time.split('/').at(-1)!)
      ? row
      : latest
  )
  const end = last.time.split('/').at(-1)!
  const milliseconds = Date.parse(end)
  if (!Number.isFinite(milliseconds))
    throw new Error('An observation has an invalid timestamp.')
  // A fractional final observation must not fall after the whole-second file
  // date; that causes the existing importer to skip the sheet.
  const fractional = /\.(\d+)/.exec(end)?.[1] ?? ''
  const rounded =
    Math.ceil(milliseconds / 1000) * 1000 +
    (milliseconds % 1000 === 0 && /[1-9]/.test(fractional) ? 1000 : 0)
  const display = observationExportTime(
    new Date(rounded).toISOString(),
    options.utcOffset
  )
  const stamp =
    display.slice(0, 19).replace(/[-:T]/g, '') +
    formatUtcOffset(options.utcOffset).replace(':', '')
  const station =
    (
      entries[0].datastream?.thing ||
      entries[0].datastream?.name ||
      'observations'
    )
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      .replace(/[. ]+$/, '') || 'observations'
  return `${station}_${stamp}.xlsx`
}

export function exportObservations(
  cache: Record<string, Workspace>,
  options: ObservationExportOptions
) {
  const book = observationWorkbook(cache, options)
  if (book) XLSX.writeFile(book, observationWorkbookFilename(cache, options))
}
