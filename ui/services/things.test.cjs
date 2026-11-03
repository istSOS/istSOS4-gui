/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TypeScript loaders with mocked upstream pages. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

const endpoint = 'http://internal.test/tsdb/v1.1'
const source = { id: '0', name: 'IST', apiRoot: endpoint }

function load(relative) {
  const cache = new Map()
  const overrides = {
    '@/config/site': { siteConfig: { api_root: endpoint } },
    '@/lib/dataSourceTokens': { getDataSourceToken: () => null },
    '@/server/data-sources/config': {
      readDataSourcesConfigFile: async () => [source],
      getPrimaryDataSource: () => source,
    },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'test-token' }) }) },
    'next/server': { NextResponse: Response },
  }
  function compile(file) {
    const filename = path.resolve(__dirname, '..', file)
    if (cache.has(filename)) return cache.get(filename).exports
    const loaded = new Module(filename, module)
    loaded.filename = filename
    loaded.paths = module.paths
    cache.set(filename, loaded)
    loaded.require = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name.startsWith('@/')) return compile(`${name.slice(2)}.ts`)
      return Module.prototype.require.call(loaded, name)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename)
    return loaded.exports
  }
  return compile(relative)
}

// Reproduce the live discrepancy: first 100 Things contain 550 expanded streams;
// FIGINO has 20 more, and the other 63 Things have another 207.
function fixture() {
  let id = 0
  return Array.from({ length: 163 }, (_, index) => ({
    '@iot.id': index + 1,
    name: index === 17 ? 'FIGINO' : `Station ${index + 1}`,
    Locations: [],
    Datastreams: Array.from({
      length: index === 17 ? 120 : index < 100 ? (index < 55 ? 5 : 4) : index < 118 ? 4 : 3,
    }, () => ({
      '@iot.id': ++id,
      Sensor: { name: 'Sensor' },
      ObservedProperty: { name: 'Temperature' },
      Observations: [{ result: id }],
    })),
  }))
}

for (const mode of ['initial', 'refresh']) {
  test(`${mode} loader retrieves all 777 streams, retaining expansions and authentication on later pages`, async (context) => {
    const things = fixture()
    const calls = []
    context.mock.method(globalThis, 'fetch', async (input, options) => {
      const url = new URL(input)
      calls.push(url)
      assert.equal(url.origin, 'http://internal.test')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      const skip = Number(url.searchParams.get('$skip') ?? 0)
      if (url.pathname.endsWith('/Things')) {
        assert.match(url.searchParams.get('$expand'), /Datastreams\(\$expand=Network,Sensor,/)
        return Response.json({
          value: things.slice(skip, skip + 100).map((thing) => ({
            ...thing,
            Datastreams: thing.Datastreams.slice(0, 100),
            ...(thing.Datastreams.length > 100 ? {
              'Datastreams@iot.nextLink': 'https://public.test/tsdb/v1.1/Things(18)/Datastreams?$top=100&$skip=100',
            } : {}),
          })),
          ...(skip === 0 ? { '@iot.nextLink': '?$top=100&$skip=100' } : {}),
        })
      }
      if (url.pathname.endsWith('/Things(18)/Datastreams')) {
        const expand = url.searchParams.get('$expand')
        assert.match(expand, /Network,Sensor,/)
        assert.match(expand, /ObservedProperty/)
        assert.equal(expand.includes('Observations($top=1;$orderby=phenomenonTime desc;$select=result,resultQuality,phenomenonTime)'), mode === 'refresh')
        return Response.json({ value: things[17].Datastreams.slice(skip) })
      }
      return Response.json({ value: [] })
    })

    let result
    if (mode === 'initial') {
      result = (await load('services/things.ts').getThings('test-token')).thingData
    } else {
      const response = await load('app/api/data-sources/things/route.ts').POST({ json: async () => ({}) })
      const body = await response.json()
      assert.equal(body.sources[0].error, null)
      assert.equal(body.sources[0].count, 163)
      result = body.things
      assert.equal(result[17].Datastreams.at(-1).__sourceEndpoint, endpoint)
      assert.equal(result.at(-1).Datastreams[0].__sourceId, '0')
    }
    assert.equal(result.length, 163)
    assert.equal(result.flatMap((thing) => thing.Datastreams).length, 777)
    assert.equal(result[17].Datastreams.length, 120)
    assert.equal(result[17].Datastreams.at(-1).ObservedProperty.name, 'Temperature')
    assert.equal(Object.hasOwn(result[17], 'Datastreams@iot.nextLink'), false)
    assert.equal(calls.filter((url) => url.pathname.endsWith('/Things')).length, 2)
  })
}

test('nested relative pages preserve expanded details and complete Locations without extra first-page requests', async () => {
  const { readThingsWithDatastreams } = load('lib/sensorThingsPagination.ts')
  const calls = []
  const things = await readThingsWithDatastreams(endpoint, 'Sensor', async (input) => {
    const url = new URL(input)
    calls.push(url.pathname)
    if (url.pathname.endsWith('/Things')) return {
      value: [{ '@iot.id': 1, Datastreams: [{ '@iot.id': 1 }], Locations: [],
        'Datastreams@iot.nextLink': 'Datastreams?$skip=1',
        'Locations@iot.nextLink': '?$skip=1' }],
    }
    assert.equal(url.searchParams.get('$skip'), '1')
    if (url.pathname.endsWith('/Datastreams')) {
      assert.equal(url.searchParams.get('$expand'), 'Sensor')
      return { value: [{ '@iot.id': 2 }] }
    }
    return { value: [{ '@iot.id': 3 }] }
  })
  assert.equal(things[0].Datastreams.length, 2)
  assert.equal(things[0].Locations[0]['@iot.id'], 3)
  assert.equal(calls.length, 3)
})

test('refresh reports a failed continuation instead of showing a successful truncated source', async (context) => {
  context.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input)
    if (!url.pathname.endsWith('/Things')) return Response.json({ value: [] })
    if (url.searchParams.has('$skip')) return new Response('Unavailable', { status: 503 })
    return Response.json({ value: [{ '@iot.id': 1 }], '@iot.nextLink': '?$skip=1' })
  })
  const response = await load('app/api/data-sources/things/route.ts').POST({ json: async () => ({}) })
  const body = await response.json()
  assert.deepEqual(body.things, [])
  assert.match(body.sources[0].error, /503/)
})

test('repeated continuation URLs fail instead of looping or returning duplicates', async () => {
  const { readThingsWithDatastreams } = load('lib/sensorThingsPagination.ts')
  await assert.rejects(readThingsWithDatastreams(endpoint, 'Sensor', async () => ({
    value: [{ '@iot.id': 1 }], '@iot.nextLink': '?$skip=1',
  })), /Repeated SensorThings page/)
})

test('an unreachable source lists no Things instead of crashing the home page', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed')
  })
  const errors = context.mock.method(console, 'error', () => {})
  context.mock.method(console, 'warn', () => {})
  const { getThings } = load('services/things.ts')
  assert.deepEqual(await getThings(null), { thingData: [] })
  // Next.js shows server console.error calls as issues; offline is not one.
  assert.equal(errors.mock.callCount(), 0)
})

test('deleting every source leaves the configuration empty, without a fallback', async (context) => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sources-'))
  fs.mkdirSync(path.join(dir, 'ui', 'config'), { recursive: true })
  const cwd = process.cwd()
  process.chdir(dir)
  context.after(() => process.chdir(cwd))
  process.env.NEXT_PUBLIC_ISTSOS4_URL ??= 'http://fallback.test'
  const config = load('server/data-sources/config.ts')
  assert.deepEqual(await config.writeDataSourcesConfigFile([]), [])
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(dir, 'ui', 'config', 'data-sources.json'), 'utf8')),
    { sources: [] }
  )
  assert.deepEqual(await config.readDataSourcesConfigFile(), [])
  assert.equal(config.getPrimaryDataSource([]), undefined)
})
