/* eslint-disable @typescript-eslint/no-require-imports -- Run server reads with controlled upstream responses. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const instant = '2026-10-20T10:00:00Z'
const endpoint = 'https://upstream.test/v1.1'
function modules(fetch, overrides = {}) {
  const cache = new Map()
  const logs = []
  function load(file) {
    const filename = path.join(root, file)
    if (cache.has(filename)) return cache.get(filename).exports
    const loaded = { exports: {} }
    cache.set(filename, loaded)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    vm.runInNewContext(
      code,
      {
        module: loaded,
        exports: loaded.exports,
        fetch,
        AbortSignal,
        AbortController,
        Response,
        Request,
        URL,
        console: { info: (...args) => logs.push(args) },
        require(name) {
          if (Object.hasOwn(overrides, name)) return overrides[name]
          if (name === '@/config/versioning')
            return { isVersioningEnabled: true }
          if (name.startsWith('@/')) return load(name.slice(2) + '.ts')
          if (name.startsWith('.'))
            return load(
              path.relative(root, path.resolve(path.dirname(filename), name)) +
                '.ts'
            )
          return require(name)
        },
      },
      { filename }
    )
    return loaded.exports
  }
  return { load, logs }
}
const flush = () => new Promise(setImmediate)

test('pagination records request counts, rows and durations without logging credentials', async () => {
  const urls = []
  const { load } = modules(async (url) => {
    urls.push(url)
    return Response.json(
      urls.length === 1
        ? { value: [{ id: 1 }, { id: 2 }], '@iot.nextLink': 'ignored' }
        : { value: [{ id: 3 }] }
    )
  })
  const { SnapshotTimings } = load('server/as-of/diagnostics.ts')
  const timings = new SnapshotTimings()
  const rows = await load('server/as-of/snapshot.ts').readAll(
    endpoint,
    { Authorization: 'Bearer secret' },
    undefined,
    { timings, name: 'metadata' }
  )
  assert.equal(rows.length, 3)
  assert.match(urls[1], /\$skip=2$/)
  const report = timings.report()
  assert.equal(report.reads.metadata.requests, 2)
  assert.equal(report.reads.metadata.rows, 3)
  assert.ok(report.reads.metadata.durationMs >= 0)
  assert.doesNotMatch(JSON.stringify(report), /secret|upstream/)
})

test('cancelling a snapshot aborts every parallel read and does not return fallback data', async () => {
  const signals = []
  const { load } = modules(async (url, { signal }) => {
    if (url.includes('/Things?'))
      return Response.json({ value: [{ '@iot.id': 1 }] })
    signals.push(signal)
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      })
    })
  })
  const { SnapshotTimings } = load('server/as-of/diagnostics.ts')
  const timings = new SnapshotTimings()
  const controller = new AbortController()
  const pending = load('server/as-of/snapshot.ts').readThingsAsOf(
    endpoint,
    instant,
    {},
    undefined,
    { signal: controller.signal, timings }
  )
  await flush()
  assert.equal(signals.length, 4)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await flush()
  assert.ok(signals.every((signal) => signal.aborted))
  for (const name of ['metadata', 'readings', 'locations', 'placement']) {
    assert.equal(timings.report().reads[name].aborted, 1)
  }
})

test('cancellation between pages prevents another upstream fetch', async () => {
  const controller = new AbortController()
  let requests = 0
  const { load } = modules(async () => {
    requests++
    return {
      ok: true,
      async json() {
        controller.abort()
        return { value: [{ id: 1 }], '@iot.nextLink': 'more' }
      },
    }
  })
  await assert.rejects(
    load('server/as-of/snapshot.ts').readAll(endpoint, {}, controller.signal),
    { name: 'AbortError' }
  )
  assert.equal(requests, 1)
})

test('a readings timeout still returns historical metadata and is recorded separately', async () => {
  const { load } = modules(async (url) => {
    if (url.includes('Observations('))
      throw new DOMException('Readings timed out', 'TimeoutError')
    if (url.includes('/Things?'))
      return Response.json({ value: [{ '@iot.id': 1 }] })
    if (url.includes('/Datastreams?'))
      return Response.json({
        value: [{ '@iot.id': 2, Thing: { '@iot.id': 1 } }],
      })
    return Response.json({ value: [] })
  })
  const timings = new (load('server/as-of/diagnostics.ts').SnapshotTimings)()
  const result = await load('server/as-of/snapshot.ts').readThingsAsOf(
    endpoint,
    instant,
    {},
    undefined,
    { timings }
  )
  assert.equal(result.readingsAvailable, false)
  assert.equal(result.things[0].Datastreams.length, 1)
  assert.equal(
    Object.hasOwn(result.things[0].Datastreams[0], 'Observations'),
    false
  )
  assert.equal(timings.report().reads.readings.timeouts, 1)
})

test('map route forwards cancellation and exposes timings for each source', async () => {
  const controller = new AbortController()
  const seen = []
  const fixture = modules(
    async (_url, options) => {
      seen.push(options.signal)
      return Response.json({ value: [] })
    },
    {
      'next/headers': { cookies: async () => ({ get: () => undefined }) },
      '@/server/as-of/read': {
        normalizeApiRoot: (value) => value.replace(/\/+$/, ''),
      },
      '@/server/data-sources/config': {
        readDataSourcesConfigFile: async () => [
          { apiRoot: endpoint, id: 'test', name: 'Test' },
        ],
        getPrimaryDataSource: (sources) => sources[0],
      },
    }
  )
  const response = await fixture.load('app/api/as-of/things/route.ts').POST(
    new Request('http://gui/api/as-of/things', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ asOfDate: instant }),
    })
  )
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('Server-Timing'),
    /total;dur=.*source0_things;dur=/
  )
  assert.match(response.headers.get('Server-Timing'), /source0_readings;dur=/)
  assert.ok(response.headers.get('X-As-Of-Request-Id'))
  assert.equal((await response.json()).ok, true)
  assert.equal(seen.length, 5)
  assert.ok(seen.every((signal) => signal instanceof AbortSignal))
  assert.equal(fixture.logs.length, 1)
})

test('an aborted route is reported as cancellation instead of a source failure', async () => {
  const controller = new AbortController()
  const { load, logs } = modules(() => {
    throw new Error('Must not fetch')
  })
  const { diagnoseAsOfRequest } = load('server/as-of/diagnostics.ts')
  const response = await diagnoseAsOfRequest(
    new Request('http://gui/api/as-of/thing', { signal: controller.signal }),
    'thing',
    async () => {
      controller.abort()
      throw controller.signal.reason
    }
  )
  assert.equal(response.status, 499)
  assert.equal(JSON.parse(logs[0][1]).status, 499)
})

for (const method of ['resolveThing', 'resolveMapThings']) {
  test(`browser adapter ${method} forwards the abort signal to fetch`, async () => {
    const controller = new AbortController()
    const seen = []
    const { load } = modules(
      (_url, { signal }) => {
        seen.push(signal)
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        })
      },
      {
        '@/config/paths': { normalizedBasePath: '/gui' },
        '@/lib/dataSourceTokens': {
          getDataSourceToken: () => 'secret',
          getAllDataSourceTokens: () => ({}),
        },
      }
    )
    const { activeAdapter } = load('features/as-of/adapters/asOfAdapter.ts')
    const thing = { '@iot.id': 1, __sourceEndpoint: endpoint }
    const pending = activeAdapter[method](
      method === 'resolveThing' ? thing : [thing],
      instant,
      controller.signal
    )
    assert.equal(seen[0], controller.signal)
    controller.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  })
}

test('station route includes timings and forwards the request signal', async () => {
  const seen = []
  const { load, logs } = modules(
    async (url, { signal }) => {
      seen.push(signal)
      return Response.json(
        url.includes('/Things(1)?') ? { '@iot.id': 1 } : { value: [] }
      )
    },
    {
      '@/server/upstream': {
        resolveConfiguredEndpoint: async () => endpoint,
        resolveAuthHeaders: async () => ({}),
      },
    }
  )
  const request = new Request('http://gui/api/as-of/thing', {
    method: 'POST',
    body: JSON.stringify({ thingId: '1', asOfDate: instant }),
  })
  const response = await load('app/api/as-of/thing/route.ts').POST(request)
  assert.equal((await response.json()).ok, true)
  assert.match(response.headers.get('Server-Timing'), /things;dur=/)
  assert.match(response.headers.get('Server-Timing'), /metadata;dur=/)
  assert.equal(seen[0], request.signal)
  assert.equal(
    JSON.parse(logs[0][1]).requestId,
    response.headers.get('X-As-Of-Request-Id')
  )
})

test('aborting missing-Thing history stops pagination without starting the version-walk fallback', async () => {
  const controller = new AbortController()
  const urls = []
  const { load } = modules(
    (url, { signal }) => {
      urls.push(url)
      if (urls.length === 1)
        return Promise.resolve(new Response(null, { status: 404 }))
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        })
      })
    },
    { '@/server/upstream': {} }
  )
  const pending = load('server/as-of/read.ts').fetchThingAsOf(
    endpoint,
    '1',
    instant,
    {},
    { signal: controller.signal }
  )
  await flush()
  assert.equal(urls.length, 2)
  assert.ok(urls[1].includes('$from_to='))
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(urls.length, 2)
})
