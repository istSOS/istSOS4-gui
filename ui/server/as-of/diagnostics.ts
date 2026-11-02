import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

type ReadTiming = {
  durationMs: number
  requests: number
  rows: number
  errors: number
  aborted: number
  timeouts: number
}

/** Request-local timings: never record tokens, query URLs or response data. */
export class SnapshotTimings {
  readonly id = randomUUID()
  private readonly started = performance.now()
  private readonly reads = new Map<string, ReadTiming>()

  async measure<T>(
    name: string,
    read: () => Promise<T>,
    rows: (value: T) => number = () => 0
  ) {
    const started = performance.now()
    const timing = this.reads.get(name) ?? {
      durationMs: 0,
      requests: 0,
      rows: 0,
      errors: 0,
      aborted: 0,
      timeouts: 0,
    }
    this.reads.set(name, timing)
    timing.requests++
    try {
      const value = await read()
      timing.rows += rows(value)
      return value
    } catch (error) {
      const name = (error as Error)?.name
      if (name === 'AbortError') timing.aborted++
      else if (name === 'TimeoutError') timing.timeouts++
      else timing.errors++
      throw error
    } finally {
      timing.durationMs += performance.now() - started
    }
  }

  report() {
    return {
      requestId: this.id,
      durationMs: Math.round((performance.now() - this.started) * 10) / 10,
      reads: Object.fromEntries(
        [...this.reads].map(([name, timing]) => [
          name,
          { ...timing, durationMs: Math.round(timing.durationMs * 10) / 10 },
        ])
      ),
    }
  }
}

export type ReadDiagnostics = { timings: SnapshotTimings; name: string }

/** Expose timings in DevTools and one matching summary in the server logs. */
export async function diagnoseAsOfRequest(
  request: Request,
  route: string,
  handle: (timings: SnapshotTimings) => Promise<Response>
) {
  const timings = new SnapshotTimings()
  let response: Response | undefined
  try {
    request.signal?.throwIfAborted()
    response = await handle(timings)
    request.signal?.throwIfAborted()
    return response
  } catch (error) {
    if (!request.signal?.aborted) throw error
    response = new Response(null, { status: 499 })
    return response
  } finally {
    const report = timings.report()
    if (response) {
      response.headers.set('X-As-Of-Request-Id', report.requestId)
      response.headers.set(
        'Server-Timing',
        [
          `total;dur=${report.durationMs}`,
          ...Object.entries(report.reads).map(
            ([name, timing]) =>
              `${name};dur=${timing.durationMs};desc="${timing.requests} requests, ${timing.rows} rows"`
          ),
        ].join(', ')
      )
    }
    console.info(
      '[as-of]',
      JSON.stringify({
        route,
        status: response?.status ?? 500,
        ...report,
      })
    )
  }
}
