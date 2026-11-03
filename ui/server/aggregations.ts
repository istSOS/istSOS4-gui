import { canManageAggregations } from '@/features/aggregations/lib/access'
import type {
  AggregationDatastream,
  AggregationSource,
} from '@/features/aggregations/lib/types'

import { cookies } from 'next/headers'

import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'

export class AggregationError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string
  ) {
    super(message ?? code)
  }
}

export async function getAggregationSources(): Promise<AggregationSource[]> {
  const sources = await readDataSourcesConfigFile()
  const primary = getPrimaryDataSource(sources)
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    endpoint: source.apiRoot,
    authorizationEnabled: source.authorizationEnabled,
    isPrimary: source.id === primary?.id,
  }))
}

export async function aggregationContext(request: Request, sourceId: unknown) {
  const sources = await readDataSourcesConfigFile()
  const source = sources.find((item) => item.id === sourceId)
  if (!source) throw new AggregationError('unknownSource', 400)
  const primary = getPrimaryDataSource(sources)
  const authorization = request.headers.get('authorization')
  // A secondary source must never inherit the primary source's cookie token.
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : source.id === primary?.id
      ? (await cookies()).get('token')?.value
      : null
  if (!canManageAggregations(token, source.authorizationEnabled))
    throw new AggregationError('access', token ? 403 : 401)
  return {
    endpoint: source.apiRoot.replace(/\/+$/, ''),
    networkEnabled: source.networkEnabled === true,
    headers:
      source.authorizationEnabled && token
        ? { Authorization: `Bearer ${token}` }
        : {},
    signal: request.signal,
  }
}

type Context = Awaited<ReturnType<typeof aggregationContext>>

const COMPLETENESS_KEYS = new Set([
  'minObservations',
  'expectedObservationInterval',
  'maxConsecutiveMissing',
])

export async function aggregationUpstream(
  context: Context,
  path: string,
  method = 'GET',
  body?: unknown,
  options: { headers?: Record<string, string>; allowEmpty?: boolean } = {}
) {
  const response = await fetch(`${context.endpoint}/${path}`, {
    method,
    headers: {
      ...context.headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([context.signal, AbortSignal.timeout(30000)]),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const invalidKeys =
      typeof data?.message === 'string'
        ? /^Invalid keys in payload:\s*([\w,\s]+)\.?$/
            .exec(data.message)?.[1]
            .split(',')
            .map((key) => key.trim())
        : undefined
    const unsupportedCompleteness =
      method === 'POST' &&
      path === 'AggregationJobs' &&
      [400, 422].includes(response.status) &&
      invalidKeys?.length &&
      invalidKeys.every((key) => COMPLETENESS_KEYS.has(key))
    const code =
      response.status === 401 || response.status === 403
        ? 'access'
        : response.status === 404 || response.status === 503
          ? 'unsupported'
          : response.status === 409
            ? 'duplicate'
            : unsupportedCompleteness
              ? 'unsupportedCompleteness'
              : 'request'
    // Show controlled validation errors, never upstream stack traces or URLs.
    const detail =
      [400, 422].includes(response.status) && typeof data?.message === 'string'
        ? data.message.slice(0, 1000)
        : undefined
    throw new AggregationError(code, response.status, detail)
  }
  if (!data && options.allowEmpty)
    return { location: response.headers.get('location') }
  if (!data || typeof data !== 'object')
    throw new AggregationError('response', 502)
  return data
}

export async function aggregationDatastreams(
  context: Context
): Promise<AggregationDatastream[]> {
  // The route must authenticate through AggregationJobs before reading this
  // catalog; public Datastream reads alone do not verify administrator access.
  const rows = await aggregationCollection(
    context,
    'Datastreams',
    '$select=id,name,unitOfMeasurement&$expand=Thing($select=name)'
  )
  return rows
    .map((raw) => {
      if (raw?.['@iot.id'] == null || typeof raw.name !== 'string')
        throw new AggregationError('response', 502)
      const thing = raw.Thing as Record<string, unknown> | undefined
      const unit = raw.unitOfMeasurement as Record<string, unknown> | undefined
      return {
        id: String(raw['@iot.id']),
        name: raw.name,
        thing: typeof thing?.name === 'string' ? thing.name : '',
        unit: typeof unit?.symbol === 'string' ? unit.symbol : '',
      }
    })
    .sort(
      (a, b) => a.thing.localeCompare(b.thing) || a.name.localeCompare(b.name)
    )
}

export async function aggregationCollection(
  context: Context,
  collection:
    | 'Datastreams'
    | 'Things'
    | 'Sensors'
    | 'ObservedProperties'
    | 'Networks',
  query: string
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = []
  const visited = new Set<string>()
  const base = new URL(`${context.endpoint}/`)
  let path: string | null = `${collection}?${query}&$top=1000`
  while (path) {
    if (visited.has(path)) throw new AggregationError('response', 502)
    visited.add(path)
    const page = await aggregationUpstream(context, path)
    if (!Array.isArray(page.value)) throw new AggregationError('response', 502)
    rows.push(...page.value)
    if (rows.length > 20000) throw new AggregationError('catalogLimit', 422)
    if (!page['@iot.nextLink']) break
    const next = new URL(String(page['@iot.nextLink']), new URL(path, base))
    // Public hostnames can differ, but continuation paths must stay inside this
    // collection. Rebuild from the configured origin so credentials never leak.
    if (next.pathname !== `${base.pathname}${collection}`)
      throw new AggregationError('response', 502)
    const params = new URLSearchParams(next.search)
    new URLSearchParams(query).forEach((value, key) => params.set(key, value))
    path = `${collection}?${params}`
  }
  return rows
}

export function aggregationFailure(error: unknown) {
  return Response.json(
    error instanceof AggregationError
      ? {
          errorCode: error.code,
          ...(error.message !== error.code ? { error: error.message } : {}),
        }
      : { errorCode: 'unavailable' },
    { status: error instanceof AggregationError ? error.status : 503 }
  )
}

export async function aggregationBody(request: Request) {
  const origin = request.headers.get('origin')
  // Host can carry the public port when Next runs behind Docker or a proxy.
  if (
    origin &&
    ![new URL(request.url).host, request.headers.get('host')].includes(
      new URL(origin).host
    )
  )
    throw new AggregationError('access', 403)
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    throw new AggregationError('request', 400)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AggregationError('request', 400)
  return body as Record<string, unknown>
}
