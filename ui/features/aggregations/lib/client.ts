import { normalizedBasePath } from '@/config/paths'

export class AggregationRequestError extends Error {
  constructor(
    public code: string,
    public detail?: string
  ) {
    super(code)
  }
}

export async function aggregationRequest(
  sourceId: string,
  token: string | null,
  options: {
    method?: 'GET' | 'POST' | 'PATCH'
    body?: unknown
    catalog?: boolean
    signal?: AbortSignal
    resource?: 'target'
    datastreamId?: string
  } = {}
) {
  const method = options.method ?? 'GET'
  const params = new URLSearchParams({
    sourceId,
    ...(options.catalog ? { catalog: '1' } : {}),
    ...(options.datastreamId ? { datastreamId: options.datastreamId } : {}),
  })
  let response: Response
  try {
    response = await fetch(
      `${normalizedBasePath}/api/aggregations${options.resource ? '/target' : ''}${method === 'GET' ? `?${params}` : ''}`,
      {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method !== 'GET'
          ? { body: JSON.stringify({ ...(options.body as object), sourceId }) }
          : {}),
        cache: 'no-store',
        signal: options.signal,
      }
    )
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new AggregationRequestError(
      method === 'GET'
        ? 'unavailable'
        : options.resource
          ? 'targetUnknown'
          : 'mutationUnknown'
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new AggregationRequestError(data?.errorCode ?? 'request', data?.error)
  if (
    options.resource
      ? method === 'GET'
        ? !data?.template?.source?.id
        : !data?.datastream?.id
      : method === 'GET'
        ? !Array.isArray(data?.jobs) ||
          (options.catalog && !Array.isArray(data?.datastreams))
        : !Number.isSafeInteger(data?.job?.id)
  )
    throw new AggregationRequestError(
      method === 'GET'
        ? 'response'
        : options.resource
          ? 'targetUnknown'
          : 'mutationUnknown'
    )
  return data
}
