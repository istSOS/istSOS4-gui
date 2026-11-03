/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TypeScript without adding a test framework. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../../..')
const configuredSources = [
  {
    id: 'primary',
    name: 'Primary',
    apiRoot: 'https://primary.test/v1.1',
    authorizationEnabled: true,
    networkEnabled: true,
  },
  {
    id: 'secondary',
    name: 'Secondary',
    apiRoot: 'https://secondary.test/v1.1',
    authorizationEnabled: true,
  },
  {
    id: 'open',
    name: 'Open',
    apiRoot: 'https://open.test/v1.1',
    authorizationEnabled: false,
  },
]
const jwt = (role, exp = Math.floor(Date.now() / 1000) + 3600) =>
  `header.${Buffer.from(JSON.stringify({ role, exp })).toString('base64url')}.signature`
const primaryToken = jwt('administrator')
const cookieReads = []
const cache = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = module.paths
  cache.set(filename, loaded)
  loaded.require = (name) => {
    if (name === 'next/headers')
      return {
        cookies: async () => ({
          get: (key) => {
            cookieReads.push(key)
            return { value: primaryToken }
          },
        }),
      }
    if (name === '@/config/site')
      return { siteConfig: { authorizationEnabled: true } }
    if (name === '@/config/paths') return { normalizedBasePath: '/gui' }
    if (name === '@/server/data-sources/config')
      return {
        readDataSourcesConfigFile: async () => configuredSources,
        getPrimaryDataSource: (sources) => sources[0],
      }
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
    if (name.startsWith('.'))
      return load(
        path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))
      )
    return Module.prototype.require.call(loaded, name)
  }
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  )
  return loaded.exports
}

const { canManageAggregations } = load('features/aggregations/lib/access.ts')
const { buildAggregationPayload, initialAggregationForm } = load(
  'features/aggregations/lib/form.ts'
)
const { aggregationRequest } = load('features/aggregations/lib/client.ts')
const { GET, POST, PATCH } = load('app/api/aggregations/route.ts')
const targetRoute = load('app/api/aggregations/target/route.ts')
const { suggestAggregationTarget, buildAggregationTarget } = load(
  'features/aggregations/lib/target.ts'
)
const streams = [
  { id: '1', name: 'raw', thing: 'Station', unit: '°C' },
  { id: '2', name: 'daily', thing: 'Station', unit: '°C' },
]
const form = (options = {}) => ({
  ...initialAggregationForm,
  sourceDatastream: '1',
  targetDatastream: '2',
  ...options,
})
const request = (
  method = 'GET',
  sourceId = 'primary',
  body = {},
  headers = {}
) =>
  new Request(`http://gui.test/api/aggregations?sourceId=${sourceId}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET'
      ? {}
      : { body: JSON.stringify({ sourceId, ...body }) }),
  })

test('only unexpired administrators can manage authenticated sources', () => {
  assert.equal(canManageAggregations(primaryToken, true), true)
  for (const token of [
    null,
    'invalid',
    jwt('viewer'),
    jwt('editor'),
    jwt('obs_manager'),
    jwt('administrator', 1),
    jwt('administrator', 0),
  ])
    assert.equal(canManageAggregations(token, true), false)
  assert.equal(canManageAggregations(null, false), true)
})

test('the default form preserves backend defaults and omits completeness rules', () => {
  const payload = buildAggregationPayload(form(), streams)
  assert.equal(payload.sourceDatastream, 'raw')
  assert.equal(payload.targetDatastream, 'daily')
  assert.equal(payload.bucketTimezone, 'Etc/GMT-1')
  for (const field of [
    'minObservations',
    'expectedObservationInterval',
    'maxConsecutiveMissing',
    'scheduleInterval',
    'scheduleTimezone',
  ])
    assert.equal(Object.hasOwn(payload, field), false)
})

test('completeness rules preserve zero limits and map selected stream IDs to names', () => {
  const payload = buildAggregationPayload(
    form({
      minObservations: '0',
      maxConsecutiveMissing: '0',
      expectedObservationInterval: ' 1 minute ',
    }),
    streams
  )
  assert.equal(payload.minObservations, 0)
  assert.equal(payload.maxConsecutiveMissing, 0)
  assert.equal(payload.expectedObservationInterval, '1 minute')
})

test('invalid counts, missing cadence and identical or unknown streams are rejected', () => {
  for (const options of [
    { minObservations: '-1' },
    { minObservations: '1.5' },
    { minObservations: '2147483648' },
    { maxConsecutiveMissing: '0' },
    { bucketsToRecompute: '0' },
    { sourceDatastream: '2' },
    { targetDatastream: 'unknown' },
  ])
    assert.throws(() => buildAggregationPayload(form(options), streams))
})

test('advanced filters validate ranges, finite numbers and station availability', () => {
  for (const options of [
    { resultQualityMin: '4', resultQualityMax: '3' },
    { resultQualityAllowed: '100,,200' },
    { conversionFactor: 'Infinity' },
    { emptyBucketPolicy: 'zero_when_available' },
    { availabilityDatastreams: ['1'] },
  ])
    assert.throws(() => buildAggregationPayload(form(options), streams))
  const payload = buildAggregationPayload(
    form({
      resultQualityAllowed: '100, 200,100',
      resultQualityMin: '0',
      availabilityDatastreams: ['1'],
      availabilityMaxAge: '5 minutes',
      emptyBucketPolicy: 'zero_when_available',
      enabled: false,
    }),
    streams
  )
  assert.deepEqual(payload.resultQualityAllowed, [100, 200])
  assert.deepEqual(payload.availabilityDatastreams, ['raw'])
  assert.equal(payload.resultQualityMin, 0)
  assert.equal(payload.enabled, false)
})

test('unknown sources and non-admin tokens cannot reach an upstream', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('must not fetch')
  })
  assert.equal((await GET(request('GET', 'https://attacker.test'))).status, 400)
  assert.equal((await GET(request('GET', 'secondary'))).status, 401)
  assert.equal(
    (
      await GET(
        request(
          'GET',
          'primary',
          {},
          { Authorization: `Bearer ${jwt('editor')}` }
        )
      )
    ).status,
    403
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('secondary source credentials never fall back to the primary cookie', async (context) => {
  cookieReads.length = 0
  const secondaryToken = jwt(
    'administrator',
    Math.floor(Date.now() / 1000) + 4000
  )
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json({ value: [] })
  })
  assert.equal((await GET(request('GET', 'secondary'))).status, 401)
  assert.equal(
    (
      await GET(
        request(
          'GET',
          'secondary',
          {},
          { Authorization: `Bearer ${secondaryToken}` }
        )
      )
    ).status,
    200
  )
  assert.deepEqual(cookieReads, [])
  assert.equal(calls[0].url, 'https://secondary.test/v1.1/AggregationJobs')
  assert.equal(
    calls[0].options.headers.Authorization,
    `Bearer ${secondaryToken}`
  )
  assert.equal(calls[0].options.redirect, 'error')
})

test('authorization-disabled sources receive no primary credentials', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://open.test/v1.1/AggregationJobs')
    assert.equal(options.headers.Authorization, undefined)
    return Response.json({ value: [] })
  })
  assert.equal((await GET(request('GET', 'open'))).status, 200)
})

test('backend authentication is checked before the datastream catalog is read', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () =>
    Response.json({ message: 'revoked token' }, { status: 401 })
  )
  const response = await GET(
    new Request('http://gui.test/api/aggregations?sourceId=primary&catalog=1')
  )
  assert.equal(response.status, 401)
  assert.equal(fetch.mock.callCount(), 1)
})

test('catalog pagination retains source credentials and expands station names on every page', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.headers.Authorization, `Bearer ${primaryToken}`)
    if (url.endsWith('AggregationJobs')) return Response.json({ value: [] })
    const query = new URL(url).searchParams
    assert.equal(query.get('$select'), 'id,name,unitOfMeasurement')
    assert.equal(query.get('$expand'), 'Thing($select=name)')
    return Response.json(
      query.has('$skip')
        ? {
            value: [
              { '@iot.id': 2, name: 'daily', Thing: { name: 'Station' } },
            ],
          }
        : {
            value: [
              {
                '@iot.id': 1,
                name: 'raw',
                Thing: { name: 'Station' },
                unitOfMeasurement: { symbol: '°C' },
              },
            ],
            '@iot.nextLink': 'https://public.test/v1.1/Datastreams?$skip=1',
          }
    )
  })
  const response = await GET(
    new Request('http://gui.test/api/aggregations?sourceId=primary&catalog=1')
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).datastreams.length, 2)
  assert.equal(
    calls.every((url) => url.startsWith('https://primary.test/v1.1/')),
    true
  )
})

test('a failed later page cannot appear as a complete catalog', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('AggregationJobs')) return Response.json({ value: [] })
    return new URL(url).searchParams.has('$skip')
      ? Response.json({}, { status: 500 })
      : Response.json({
          value: [],
          '@iot.nextLink': '/v1.1/Datastreams?$skip=1',
        })
  })
  const response = await GET(
    new Request('http://gui.test/api/aggregations?sourceId=primary&catalog=1')
  )
  assert.equal(response.status, 500)
  assert.equal(Object.hasOwn(await response.json(), 'datastreams'), false)
})

test('pagination rejects different collections and repeated pages', async (context) => {
  let next = '/v1.1/Users'
  context.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(
      url.endsWith('AggregationJobs')
        ? { value: [] }
        : { value: [], '@iot.nextLink': next }
    )
  )
  for (next of ['/v1.1/Users', '/v1.1/Datastreams?$skip=1']) {
    const response = await GET(
      new Request('http://gui.test/api/aggregations?sourceId=primary&catalog=1')
    )
    assert.equal(response.status, 502)
  }
})

test('creation forwards completeness settings without GUI metadata', async (context) => {
  const job = buildAggregationPayload(
    form({
      minObservations: '20',
      expectedObservationInterval: '1 hour',
      maxConsecutiveMissing: '3',
      bucketInterval: '1 day',
    }),
    streams
  )
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://primary.test/v1.1/AggregationJobs')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), job)
    return Response.json({ ...job, id: 42 }, { status: 201 })
  })
  const response = await POST(request('POST', 'primary', { job }))
  assert.equal(response.status, 201)
  assert.equal((await response.json()).job.minObservations, 20)
})

test('enable/suspend only forwards the enabled flag to the selected job', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://primary.test/v1.1/AggregationJobs(42)')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { enabled: false })
    return Response.json({ id: 42, enabled: false })
  })
  assert.equal(
    (
      await PATCH(
        request('PATCH', 'primary', {
          id: 42,
          enabled: false,
          aggregation: 'AVG',
        })
      )
    ).status,
    200
  )
})

test('invalid job IDs, non-boolean toggles and cross-origin writes do not reach upstreams', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('must not fetch')
  })
  for (const body of [
    { id: '../Users', enabled: false },
    { id: 0, enabled: false },
    { id: 1, enabled: 'false' },
  ])
    assert.equal((await PATCH(request('PATCH', 'primary', body))).status, 400)
  assert.equal(
    (
      await POST(
        request(
          'POST',
          'primary',
          { job: {} },
          { origin: 'https://attacker.test' }
        )
      )
    ).status,
    403
  )
  assert.equal(
    (
      await POST(
        request(
          'POST',
          'primary',
          { job: {} },
          { 'Content-Type': 'text/plain' }
        )
      )
    ).status,
    400
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('same-origin writes behind Docker preserve the browser-facing host and port', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ id: 1 }))
  const response = await POST(
    request(
      'POST',
      'primary',
      { job: {} },
      { origin: 'http://gui.test:2000', host: 'gui.test:2000' }
    )
  )
  assert.equal(response.status, 201)
})

test('duplicate, unsupported and validation errors remain actionable without upstream details', async (context) => {
  let status = 409
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { message: 'validation detail', stack: 'internal secret' },
      { status }
    )
  )
  for (const [code, errorCode] of [
    [409, 'duplicate'],
    [404, 'unsupported'],
    [503, 'unsupported'],
    [400, 'request'],
  ]) {
    status = code
    const response = await POST(request('POST', 'primary', { job: {} }))
    const data = await response.json()
    assert.equal(response.status, status)
    assert.equal(data.errorCode, errorCode)
    assert.equal(data.stack, undefined)
    assert.equal(data.error, status === 400 ? 'validation detail' : undefined)
  }
})

test('the client preserves base paths, source IDs and write failure uncertainty', async (context) => {
  let unavailable = false
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (unavailable) throw new TypeError('connection reset')
    assert.equal(url, '/gui/api/aggregations')
    assert.equal(options.headers.Authorization, 'Bearer secondary-token')
    assert.deepEqual(JSON.parse(options.body), {
      id: 42,
      enabled: true,
      sourceId: 'secondary',
    })
    return Response.json({ job: { id: 42, enabled: true } })
  })
  await aggregationRequest('secondary', 'secondary-token', {
    method: 'PATCH',
    body: { id: 42, enabled: true },
  })
  unavailable = true
  await assert.rejects(
    aggregationRequest('secondary', null, {
      method: 'POST',
      body: { job: {} },
    }),
    { code: 'mutationUnknown' }
  )
})

test('older APIs rejecting completeness rules return a specific error without removing rules or retrying', async (context) => {
  const job = buildAggregationPayload(
    form({
      minObservations: '20',
      expectedObservationInterval: '1 minute',
      maxConsecutiveMissing: '3',
    }),
    streams
  )
  let status = 400
  let message = ''
  const fetch = context.mock.method(
    globalThis,
    'fetch',
    async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), job)
      return Response.json({ message }, { status })
    }
  )
  for (const rejected of [
    'minObservations, expectedObservationInterval, maxConsecutiveMissing',
    'maxConsecutiveMissing',
    'maxConsecutiveMissing, minObservations',
  ]) {
    for (status of [400, 422]) {
      message = `Invalid keys in payload: ${rejected}`
      const before = fetch.mock.callCount()
      const response = await POST(request('POST', 'primary', { job }))
      assert.equal(response.status, status)
      assert.equal((await response.json()).errorCode, 'unsupportedCompleteness')
      assert.equal(fetch.mock.callCount(), before + 1)
    }
  }
  for (message of [
    'Invalid keys in payload: minObservations, unrelatedField',
    "'minObservations' must be non-negative.",
  ]) {
    const response = await POST(request('POST', 'primary', { job }))
    assert.equal((await response.json()).errorCode, 'request')
  }
})

test('English and Italian provide the same aggregation translation keys', () => {
  const flatten = (value, prefix = '') =>
    Object.entries(value)
      .flatMap(([key, child]) =>
        typeof child === 'object'
          ? flatten(child, `${prefix}${key}.`)
          : [`${prefix}${key}`]
      )
      .sort()
  const en = JSON.parse(
    fs.readFileSync(path.join(root, 'locales/en/translation.json'))
  ).aggregations
  const it = JSON.parse(
    fs.readFileSync(path.join(root, 'locales/it/translation.json'))
  ).aggregations
  assert.deepEqual(flatten(en), flatten(it))
})

const template = {
  source: {
    id: '1',
    name: 'Temperature',
    thingId: '10',
    observedPropertyId: '30',
    networkId: '40',
    unitOfMeasurement: {
      name: 'Degree Celsius',
      symbol: '°C',
      definition: 'https://unit.test/celsius',
    },
  },
  things: [{ id: '10', name: 'Station' }],
  sensors: [{ id: '20', name: 'Daily processing' }],
  observedProperties: [{ id: '30', name: 'Temperature' }],
  networks: [{ id: '40', name: 'Network' }],
  networkEnabled: true,
}
const targetPayload = () =>
  buildAggregationTarget(
    {
      ...suggestAggregationTarget(template, '1 day', 'Daily average'),
      sensorId: '20',
      unitsReviewed: true,
    },
    template
  )
const targetRequest = (method = 'GET', body = {}, headers = {}) =>
  new Request(
    'http://gui.test/api/aggregations/target?sourceId=primary&datastreamId=1',
    {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ sourceId: 'primary', ...body }) }),
    }
  )

test('source-based suggestions copy associations and units but require a processing sensor and unit review', () => {
  const draft = suggestAggregationTarget(template, '1 day', 'Daily average')
  assert.equal(draft.name, 'Temperature_daily')
  assert.equal(draft.description, 'Daily average')
  assert.equal(draft.thingId, '10')
  assert.equal(draft.observedPropertyId, '30')
  assert.equal(draft.networkId, '40')
  assert.equal(draft.unitSymbol, '°C')
  assert.equal(draft.sensorId, '')
  assert.equal(draft.unitsReviewed, false)
  assert.throws(() => buildAggregationTarget(draft, template), {
    field: 'unitsReviewed',
  })
  assert.throws(
    () => buildAggregationTarget({ ...draft, unitsReviewed: true }, template),
    { field: 'sensorId' }
  )
})

test('new target payloads contain integer associations and no raw checks, properties or observations', () => {
  const payload = targetPayload()
  assert.deepEqual(payload.Thing, { '@iot.id': 10 })
  assert.deepEqual(payload.Sensor, { '@iot.id': 20 })
  assert.deepEqual(payload.Network, { '@iot.id': 40 })
  assert.equal(payload.observationType.endsWith('/OM_Measurement'), true)
  for (const field of [
    'properties',
    'Observations',
    'phenomenonTime',
    'resultTime',
    'unitsReviewed',
  ])
    assert.equal(Object.hasOwn(payload, field), false)
  const noNetwork = { ...template, networkEnabled: false }
  const draft = {
    ...suggestAggregationTarget(noNetwork, '1 hour', 'Hourly count'),
    sensorId: '20',
    unitsReviewed: true,
    unitName: 'Count',
    unitSymbol: '1',
    unitDefinition: '',
  }
  assert.equal(
    Object.hasOwn(buildAggregationTarget(draft, noNetwork), 'Network'),
    false
  )
  assert.equal(
    buildAggregationTarget(draft, noNetwork).unitOfMeasurement.symbol,
    '1'
  )
})

test('a proposed target can validate job settings before either write occurs', () => {
  const payload = buildAggregationPayload(
    form({ targetDatastream: '' }),
    streams,
    'new-daily'
  )
  assert.equal(payload.targetDatastream, 'new-daily')
  assert.throws(() => buildAggregationPayload(form(), streams, 'raw'), {
    code: 'differentStreams',
  })
  assert.throws(
    () =>
      buildAggregationPayload(
        form({ maxConsecutiveMissing: '0' }),
        streams,
        'new-daily'
      ),
    { code: 'cadenceRequired' }
  )
})

test('template metadata and available entities are read from the selected source with full pagination', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.headers.Authorization, `Bearer ${primaryToken}`)
    assert.equal(new URL(url).origin, 'https://primary.test')
    const pathname = new URL(url).pathname
    if (pathname.endsWith('AggregationJobs'))
      return Response.json({ value: [] })
    if (pathname.endsWith('Datastreams(1)'))
      return Response.json({
        '@iot.id': 1,
        name: 'Temperature',
        Thing: { '@iot.id': 10 },
        Sensor: { '@iot.id': 99 },
        ObservedProperty: { '@iot.id': 30 },
        Network: { '@iot.id': 40 },
        unitOfMeasurement: template.source.unitOfMeasurement,
        properties: { constraints: [{ type: 'flagRange' }] },
      })
    const collection = pathname.split('/').pop()
    if (collection === 'Networks')
      assert.equal(new URL(url).searchParams.get('$select'), 'id,name')
    if (collection === 'Sensors' && !new URL(url).searchParams.has('$skip'))
      return Response.json({
        value: [],
        '@iot.nextLink': 'https://public.test/v1.1/Sensors?$skip=1',
      })
    const key = {
      Things: 'things',
      Sensors: 'sensors',
      ObservedProperties: 'observedProperties',
      Networks: 'networks',
    }[collection]
    return Response.json({
      value: template[key].map((item) => ({
        '@iot.id': Number(item.id),
        name: item.name,
      })),
    })
  })
  const response = await targetRoute.GET(targetRequest())
  assert.equal(response.status, 200)
  const result = (await response.json()).template
  assert.equal(result.source.thingId, '10')
  assert.equal(result.source.unitOfMeasurement.symbol, '°C')
  assert.deepEqual(result.sensors, [
    { id: '20', name: 'Daily processing', description: '' },
  ])
  assert.equal(Object.hasOwn(result.source, 'properties'), false)
  assert.equal(Object.hasOwn(result.source, 'sensorId'), false)
  assert.equal(calls[0], 'https://primary.test/v1.1/AggregationJobs')
})

test('target metadata and creation authenticate administrator privileges before touching datastreams', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () =>
    Response.json({}, { status: 401 })
  )
  assert.equal((await targetRoute.GET(targetRequest())).status, 401)
  assert.equal(
    (await targetRoute.POST(targetRequest('POST', { target: targetPayload() })))
      .status,
    401
  )
  assert.equal(fetch.mock.callCount(), 2)
  assert.equal(
    fetch.mock.calls.every((call) =>
      call.arguments[0].endsWith('/AggregationJobs')
    ),
    true
  )
})

test('empty datastream creation responses use the Location header without following its public hostname', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    if (
      url.endsWith('AggregationJobs') ||
      new URL(url).searchParams.has('$filter')
    )
      return Response.json({ value: [] })
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), targetPayload())
    assert.equal(
      options.headers['commit-message'],
      'Create aggregation target from GUI'
    )
    return new Response(null, {
      status: 201,
      headers: { location: 'https://public.test/v1.1/Datastreams(55)' },
    })
  })
  const response = await targetRoute.POST(
    targetRequest('POST', { target: targetPayload() })
  )
  assert.equal(response.status, 201)
  assert.deepEqual((await response.json()).datastream, {
    id: '55',
    name: 'Temperature_daily',
    thing: '',
    unit: '°C',
  })
  assert.equal(calls.length, 3)
  assert.equal(
    calls.every((call) => call.url.startsWith('https://primary.test/')),
    true
  )
})

test('existing target names are not silently reused or posted again', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async (url) =>
    Response.json({
      value: url.endsWith('AggregationJobs') ? [] : [{ '@iot.id': 55 }],
    })
  )
  const response = await targetRoute.POST(
    targetRequest('POST', { target: targetPayload() })
  )
  assert.equal(response.status, 409)
  assert.equal((await response.json()).errorCode, 'targetExists')
  assert.equal(
    fetch.mock.calls.some((call) => call.arguments[1].method === 'POST'),
    false
  )
})

test('target validation rejects copied QC properties, nested entity creation and missing networks', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () =>
    Response.json({ value: [] })
  )
  const withoutNetwork = targetPayload()
  delete withoutNetwork.Network
  for (const target of [
    { ...targetPayload(), properties: { constraints: [] } },
    { ...targetPayload(), Observations: [] },
    { ...targetPayload(), Sensor: { name: 'New sensor' } },
    { ...targetPayload(), Thing: { '@iot.id': '10' } },
    withoutNetwork,
  ])
    assert.equal(
      (await targetRoute.POST(targetRequest('POST', { target }))).status,
      400
    )
  assert.equal(
    fetch.mock.calls.every((call) =>
      call.arguments[0].endsWith('AggregationJobs')
    ),
    true
  )
})

test('unconfirmed target writes never trigger another create attempt or a job write', async (context) => {
  let mode = 'network'
  let writes = 0
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method !== 'POST') return Response.json({ value: [] })
    writes += 1
    if (mode === 'network') throw new TypeError('connection interrupted')
    return new Response(null, {
      status: 201,
      headers:
        mode === 'wrong-location'
          ? { location: 'https://public.test/Users(1)' }
          : {},
    })
  })
  for (mode of ['network', 'missing-location', 'wrong-location']) {
    const response = await targetRoute.POST(
      targetRequest('POST', { target: targetPayload() })
    )
    assert.equal((await response.json()).errorCode, 'targetUnknown')
  }
  assert.equal(writes, 3)
})

test('target transport preserves the configured GUI base path and source identity', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json(
      options.method === 'GET'
        ? { template }
        : { datastream: { id: '55', name: 'Temperature_daily' } }
    )
  })
  await aggregationRequest('secondary', 'secondary-token', {
    resource: 'target',
    datastreamId: '1',
  })
  await aggregationRequest('secondary', 'secondary-token', {
    resource: 'target',
    method: 'POST',
    body: { target: targetPayload() },
  })
  assert.equal(
    calls[0].url,
    '/gui/api/aggregations/target?sourceId=secondary&datastreamId=1'
  )
  assert.equal(calls[1].url, '/gui/api/aggregations/target')
  assert.equal(JSON.parse(calls[1].options.body).sourceId, 'secondary')
})
