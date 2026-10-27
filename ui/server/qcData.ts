import { bufferSize } from '@/features/qc/lib/bitmask'
import { checkIssue } from '@/features/qc/lib/checks'
import { QC_LIMITS } from '@/features/qc/lib/limits'
import { hasStoredConstraints } from '@/features/qc/lib/storedBitmask'
import type {
  Constraint,
  Draft,
  LoadedData,
  QcDatastream,
  QcRow,
} from '@/features/qc/lib/types'
import type { ConfiguredDataSource } from '@/types'
import { isDeepStrictEqual } from 'node:util'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'
import { getQcAccess, getSaqcServiceUrl } from '@/server/qc'

const MAX_ROWS = QC_LIMITS.observations
export class QcError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export function qcFailure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof QcError
          ? error.message
          : 'The request could not be completed. Please try again.',
    },
    { status: error instanceof QcError ? error.status : 503 }
  )
}

export async function qcContext(request: Request) {
  if (!getSaqcServiceUrl())
    throw new QcError('Quality control is disabled', 404)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object')
    throw new QcError('A JSON request is required')
  const sources = await readDataSourcesConfigFile()
  const primary = getPrimaryDataSource(sources)
  const source = sources.find(
    (s) => s.id === String(body.sourceId ?? primary.id)
  )
  if (!source) throw new QcError('Unknown data source')
  const token =
    typeof body.token === 'string' && body.token.length <= 16000
      ? body.token
      : source.id === primary.id
        ? (await cookies()).get('token')?.value
        : null
  const access = await getQcAccess({ source, token })
  if (access !== 200)
    throw new QcError(
      access === 503
        ? 'Editing access could not be verified'
        : 'Editing access is required for this source',
      access
    )
  const headers: Record<string, string> =
    source.authorizationEnabled && token
      ? { Authorization: `Bearer ${token}` }
      : {}
  return { source, headers, body }
}

async function readJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new QcError(
      `The data source refused the request (HTTP ${response.status})`,
      response.status === 401 || response.status === 403 ? response.status : 502
    )
  const body = await response.json()
  if (!body || typeof body !== 'object')
    throw new QcError('Invalid response from the data source', 502)
  return body
}

// A failed page must fail the entire load. Never present partial data as complete.
export async function readQcCollection(
  source: ConfiguredDataSource,
  headers: Record<string, string>,
  path: string,
  limit: number = MAX_ROWS,
  truncate = false
): Promise<Array<Record<string, unknown>>> {
  const base = new URL(source.apiRoot.replace(/\/+$/, '') + '/')
  let url: string | null = new URL(path, base).toString()
  const visited = new Set<string>()
  const rows: Array<Record<string, unknown>> = []
  while (url) {
    if (visited.has(url))
      throw new QcError('The data source returned a repeated page', 502)
    visited.add(url)
    const body = await readJson(url, headers)
    if (!Array.isArray(body.value))
      throw new QcError('Invalid collection response', 502)
    rows.push(...body.value)
    if (rows.length >= limit && truncate) return rows.slice(0, limit)
    if (rows.length > limit)
      throw new QcError(
        `This selection exceeds ${limit.toLocaleString()} observations. Choose a shorter period.`,
        422
      )
    if (!body['@iot.nextLink']) break
    const next = new URL(String(body['@iot.nextLink']), url)
    if (!next.pathname.startsWith(base.pathname))
      throw new QcError('Invalid pagination path', 502)
    // Some deployments advertise their public host; keep requests on the
    // configured source and never forward its credentials to another origin.
    next.protocol = base.protocol
    next.host = base.host
    url = next.toString()
  }
  return rows
}

export function qcDatastream(raw: Record<string, unknown>): QcDatastream {
  const properties = raw.properties as Record<string, unknown> | undefined
  const thing = raw.Thing as Record<string, unknown> | undefined
  const unit = raw.unitOfMeasurement as Record<string, unknown> | undefined
  let constraints = properties?.constraints
  if (typeof constraints === 'string') {
    try {
      constraints = JSON.parse(constraints)
    } catch {
      throw new QcError('Invalid constraints JSON', 422)
    }
  }
  if (constraints != null && !Array.isArray(constraints))
    throw new QcError('Datastream constraints must be an ordered list', 422)
  return {
    id: String(raw['@iot.id'] ?? raw.id ?? ''),
    name: String(raw.name ?? ''),
    thing: String(thing?.name ?? ''),
    unit: String(unit?.symbol ?? ''),
    phenomenonTime:
      typeof raw.phenomenonTime === 'string' ? raw.phenomenonTime : undefined,
    samplingFrequency:
      typeof properties?.samplingFrequency === 'string'
        ? properties.samplingFrequency
        : undefined,
    qualityEncoding:
      typeof properties?.resultQualityEncoding === 'string'
        ? properties.resultQualityEncoding
        : undefined,
    constraints: Array.isArray(constraints)
      ? (constraints as Constraint[])
      : [],
  }
}

/** Malformed/empty definitions are excluded without hiding other eligible streams. */
export function qcDatastreamsWithConstraints(
  rows: Array<Record<string, unknown>>
) {
  return rows.flatMap((raw) => {
    try {
      const stream = qcDatastream(raw)
      return hasStoredConstraints(stream) ? [stream] : []
    } catch (error) {
      if (error instanceof QcError && error.status === 422) return []
      throw error
    }
  })
}

export async function loadQcData(
  source: ConfiguredDataSource,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  requestedConstraints?: Constraint[]
): Promise<LoadedData> {
  const id = String(body.datastreamId ?? '')
  if (!/^\d+$/.test(id))
    throw new QcError('A numeric datastream ID is required')
  const start = Date.parse(String(body.start ?? ''))
  const end = Date.parse(String(body.end ?? ''))
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
    throw new QcError('Choose a valid UTC date range')
  const datastream = qcDatastream(
    await readJson(
      `${source.apiRoot}/Datastreams(${id})?$expand=Thing`,
      headers
    )
  )
  const constraints = requestedConstraints ?? datastream.constraints
  if (!hasStoredConstraints(datastream))
    throw new QcError(
      'Only datastreams with configured quality constraints can be opened in this editor.',
      422
    )
  if (
    !Array.isArray(constraints) ||
    constraints.some(
      (c) => !c || typeof c !== 'object' || typeof c.type !== 'string'
    )
  ) {
    throw new QcError(
      'Datastream constraints must be an ordered list of checks',
      422
    )
  }
  const n = bufferSize(constraints, datastream.samplingFrequency)
  if (n > QC_LIMITS.contextBuffer)
    throw new QcError(
      'The configured windows require too much context for an interactive preview',
      422
    )
  const query = (filter: string, order: string, top: number) =>
    `Datastreams(${id})/Observations?` +
    new URLSearchParams({
      $filter: filter,
      $orderby: `phenomenonTime ${order}`,
      $top: String(top),
      $select: 'id,phenomenonTime,result,resultQuality',
    })
  const [before, period, after] = await Promise.all([
    readQcCollection(
      source,
      headers,
      query(
        `phenomenonTime lt ${new Date(start).toISOString()}`,
        'desc',
        n - 1
      ),
      n - 1,
      true
    ),
    readQcCollection(
      source,
      headers,
      query(
        `phenomenonTime ge ${new Date(start).toISOString()} and phenomenonTime le ${new Date(end).toISOString()}`,
        'asc',
        10000
      )
    ),
    readQcCollection(
      source,
      headers,
      query(`phenomenonTime gt ${new Date(end).toISOString()}`, 'asc', n - 1),
      n - 1,
      true
    ),
  ])
  const rows = [
    ...before.map((row) => ({ raw: row, scope: 'history' as const })),
    ...period.map((row) => ({ raw: row, scope: 'window' as const })),
    ...after.map((row) => ({ raw: row, scope: 'following' as const })),
  ]
    .map(({ raw, scope }): QcRow => {
      const time = String(raw.phenomenonTime ?? '')
      const observationId = String(raw['@iot.id'] ?? raw.id ?? '')
      const ts = Date.parse(time.split('/')[0])
      if (!observationId || !Number.isFinite(ts))
        throw new QcError('An observation is missing its ID or timestamp', 422)
      return {
        key: `${observationId}@${time}`,
        id: observationId,
        time,
        ts,
        result: raw.result ?? null,
        resultQuality: raw.resultQuality ?? null,
        scope,
      }
    })
    .sort((a, b) => a.ts - b.ts)
  if (new Set(rows.map((row) => row.key)).size !== rows.length)
    throw new QcError(
      'Duplicate observation identities returned by the source',
      422
    )
  return { datastream, rows, bufferSize: n }
}

export async function runQcPreview(
  source: ConfiguredDataSource,
  headers: Record<string, string>,
  body: Record<string, unknown>
) {
  const constraints = body.constraints as Constraint[]
  if (!Array.isArray(constraints) || !Array.isArray(body.slots))
    throw new QcError('Choose the checks to run')
  if (body.qualityMode !== 'existing')
    throw new QcError(
      'Only confirmed bitmasks with stored checks can be rechecked.',
      422
    )
  if (constraints.length > 4)
    throw new QcError(
      'This bitmask has more than four checks and cannot be rechecked by this editor.',
      422
    )
  const scope = body.scope
  if (scope !== 'selected' && scope !== 'all' && scope !== 'affected')
    throw new QcError(
      'Choose selected, all loaded, or affected observations',
      422
    )
  if (
    !Array.isArray(body.targetKeys) ||
    body.targetKeys.some((key) => typeof key !== 'string') ||
    (scope !== 'affected' && !body.targetKeys.length)
  )
    throw new QcError('Select observations to check', 422)
  if (scope !== 'affected' && !body.slots.length)
    throw new QcError('Choose the checks to run', 422)
  const data = await loadQcData(source, headers, body)
  const eligibleKeys = new Set(
    data.rows
      .filter((row) => scope === 'affected' || row.scope === 'window')
      .map((row) => row.key)
  )
  // Use the exact identities shown when the user chose the action, even if
  // more observations have arrived inside the period since it was loaded.
  const targetKeys = [...new Set(body.targetKeys as string[])]
  if (targetKeys.some((key) => !eligibleKeys.has(key)))
    throw new QcError(
      'Selected observations are outside the loaded scope. Reload and select again.',
      422
    )
  if (scope !== 'affected' && !targetKeys.length)
    throw new QcError('No observations are available to check', 422)
  if (!isDeepStrictEqual(constraints, data.datastream.constraints)) {
    throw new QcError(
      'Check types, order and parameters must match the stored constraints. Reload if the source definition changed.',
      422
    )
  }
  if (
    body.slots.some(
      (slot) =>
        !Number.isInteger(slot) ||
        slot < 1 ||
        slot > constraints.length ||
        checkIssue(constraints[slot - 1])
    )
  )
    throw new QcError(
      'Only supported stored checks can be selected. Recorded results for unavailable checks are retained.',
      422
    )
  const edits = Array.isArray(body.edits) ? body.edits : []
  if (edits.length > QC_LIMITS.previewRows)
    throw new QcError('Too many draft changes', 422)
  const rows = new Map(data.rows.map((row) => [row.key, { ...row }]))
  const editedKeys: string[] = []
  for (const edit of edits) {
    if (!edit || typeof edit !== 'object') throw new QcError('Invalid draft')
    const original = rows.get(edit.key)
    if (!original) {
      const instant = Date.parse(
        String(edit.key).split('@').slice(1).join('@').split('/')[0]
      )
      const first = Math.min(
        Date.parse(String(body.start)),
        data.rows[0]?.ts ?? Infinity
      )
      const last = Math.max(
        Date.parse(String(body.end)),
        data.rows.at(-1)?.ts ?? -Infinity
      )
      if (Number.isFinite(instant) && instant >= first && instant <= last) {
        throw new QcError(
          'A drafted observation was removed or its access changed. Export your draft and reload.',
          409
        )
      }
      continue // Drafts outside this window and its context stay in the browser.
    }
    if (
      !isDeepStrictEqual(original.result, edit.originalResult) ||
      !isDeepStrictEqual(original.resultQuality, edit.originalQuality)
    ) {
      throw new QcError(
        'Server data changed since these edits were made. Export your draft and reload before checking.',
        409
      )
    }
    const draft = edit.draft as Draft
    if (
      !draft ||
      (draft.result !== null &&
        typeof draft.result !== 'number' &&
        !isDeepStrictEqual(draft.result, original.result))
    ) {
      throw new QcError('Draft results must be finite numbers or empty', 422)
    }
    if (typeof draft.result === 'number' && !Number.isFinite(draft.result))
      throw new QcError('Draft results must be finite', 422)
    if (
      !Array.isArray(draft.staleSlots) ||
      draft.staleSlots.some(
        (slot) =>
          !Number.isInteger(slot) || slot < 0 || slot > constraints.length
      ) ||
      (draft.outcomes !== undefined && !Array.isArray(draft.outcomes))
    )
      throw new QcError('Invalid draft check states', 422)
    if (!isDeepStrictEqual(draft.result, original.result) || draft.filled)
      editedKeys.push(original.key)
    const resolvedSlots = (draft.outcomes ?? [])
      .filter(
        (outcome) =>
          !draft.staleSlots.includes(outcome.slot) &&
          outcome.slot > 0 &&
          outcome.slot <= constraints.length &&
          isDeepStrictEqual(
            draft.recipe?.[outcome.slot - 1],
            constraints[outcome.slot - 1]
          )
      )
      .map((outcome) => outcome.slot)
    rows.set(edit.key, {
      ...original,
      result: draft.result,
      resultQuality: draft.resultQuality,
      ...{ staleSlots: draft.staleSlots ?? [], resolvedSlots },
    })
  }
  let response: Response
  try {
    response = await fetch(`${getSaqcServiceUrl()}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        rows: [...rows.values()],
        constraints,
        slots: body.slots,
        qualityMode: 'existing',
        repairUnknownQuality: true,
        samplingFrequency: data.datastream.samplingFrequency,
        editedKeys,
        targetKeys,
        includeAffected: scope === 'affected',
      }),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new QcError(
      timedOut
        ? 'SaQC checks timed out. Choose a shorter period or fewer observations and try again.'
        : 'The SaQC service could not be reached. Check that the service is running and its connection is configured correctly.',
      timedOut ? 504 : 503
    )
  }
  const result = await response.json().catch(() => null)
  if (!response.ok)
    throw new QcError(
      typeof result?.detail === 'string'
        ? result.detail
        : 'SaQC could not evaluate this preview',
      response.status === 422 ? 422 : 503
    )
  if (!Array.isArray(result?.results))
    throw new QcError('Invalid response from SaQC', 502)
  // Enforce the chosen scope even if an older service expands its results.
  const targets = new Set(targetKeys)
  return {
    ...data,
    ...result,
    results:
      scope === 'affected'
        ? result.results
        : result.results.filter((row: { key: string }) => targets.has(row.key)),
  }
}
