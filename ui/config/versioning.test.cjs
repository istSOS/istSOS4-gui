/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TypeScript loader for Node's test runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const instant = '2026-10-20T10:00:00Z'

// Each deployment gets its own env and module cache, as it does in Next.js.
function deployment(setting, overrides = {}) {
  const cache = new Map()
  const load = (relative) => {
    const filename = path.join(root, relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const loaded = { exports: {} }
    cache.set(filename, loaded)
    const localRequire = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier]
      if (specifier === '@/config/versioning') return load('config/versioning.ts')
      if (specifier === '@/config/site') {
        return { siteConfig: { versioning: load('config/versioning.ts').isVersioningEnabled, api_root: 'http://test/v1.1' } }
      }
      // Historical helpers must not be reached by a disabled route.
      if (specifier.startsWith('@/server/')) {
        return new Proxy({}, { get: () => () => { throw new Error('Unexpected historical read') } })
      }
      if (specifier === '@/app/home/utils') return { normalizedBasePath: '/gui' }
      if (specifier === '@/lib/dataSourceTokens') return { getDataSourceToken: () => null, getAllDataSourceTokens: () => ({}) }
      if (specifier.startsWith('@/')) return load(`${specifier.slice(2)}.ts`)
      return require(specifier)
    }
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(code, {
      module: loaded, exports: loaded.exports, require: localRequire,
      process: { env: { NEXT_PUBLIC_VERSIONING_ENABLED: setting } },
      fetch: overrides.fetch ?? (() => { throw new Error('Unexpected fetch') }),
      URL, Response, AbortSignal,
    }, { filename })
    return loaded.exports
  }
  return load
}

test('version history is opt-in, including an unset setting', () => {
  for (const setting of [undefined, '', 'false', '0']) {
    assert.equal(deployment(setting)('config/versioning.ts').isVersioningEnabled, false)
  }
  for (const setting of ['true', 'TRUE']) {
    assert.equal(deployment(setting)('config/versioning.ts').isVersioningEnabled, true)
  }
})

const routes = ['as-of/thing', 'as-of/things', 'as-of/commits', 'from-to/bounds', 'from-to/changes', 'from-to/history', 'from-to/related']
for (const route of routes) {
  test(`${route}: disabled returns 404 before parsing or reading upstream; enabled retains validation`, async () => {
    const filename = `app/api/${route}/route.ts`
    for (const setting of [undefined, 'false']) {
      const response = await deployment(setting)(filename).POST({ json: () => { throw new Error('Body must not be read') } })
      assert.equal(response.status, 404)
    }
    const response = await deployment('true')(filename).POST({ json: async () => ({}) })
    assert.equal(response.status, 400)
  })
}

test('disabled historical adapter returns real live Things without fetching or synthesizing data', async () => {
  const { activeAdapter } = deployment('false')('features/as-of/adapters/asOfAdapter.ts')
  const thing = { '@iot.id': 42, name: 'Live station', Datastreams: [] }
  const things = [thing]
  const resolved = await activeAdapter.resolveThing(thing, instant)
  assert.equal(resolved.thing, thing)
  assert.equal(resolved.existenceState, 'exists')
  assert.equal((await activeAdapter.resolveMapThings(things, instant)).things, things)
  assert.equal((await activeAdapter.fetchCommits(thing)).length, 0)
})

test('enabled historical adapter still reads backend commit history', async () => {
  const requests = []
  const { activeAdapter } = deployment('true', {
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return Response.json({ ok: true, commits: [{ '@iot.id': 7, date: instant, message: 'Reviewed' }] })
    },
  })('features/as-of/adapters/asOfAdapter.ts')
  const commits = await activeAdapter.fetchCommits({ '@iot.id': 42, __sourceEndpoint: 'http://test/v1.1' })
  assert.equal(requests[0].url, '/gui/api/as-of/commits')
  assert.equal(requests[0].body.thingId, '42')
  assert.equal(commits[0].message, 'Reviewed')
})

test('observation reads ignore stale snapshot arguments when disabled and preserve them when enabled', async () => {
  for (const setting of ['false', 'true']) {
    const requests = []
    const service = deployment(setting, {
      '@/services/fetch': { fetchData: async (url) => { requests.push(new URL(url)); return { value: [{ phenomenonTime: instant, result: 4 }] } } },
    })('services/observations.ts')
    const data = await service.getObservationsByDatastream(null, '42', undefined, undefined, undefined, instant)
    assert.equal(data.observationData[0].result, 4)
    assert.equal(await service.getLatestObservationTime(null, '42', undefined, instant), instant)
    for (const url of requests) assert.equal(url.searchParams.get('$as_of'), setting === 'true' ? instant : null)
    assert.equal(requests[0].searchParams.get('$expand'), setting === 'true' ? 'Commit' : null)
  }
})

for (const [file, entity] of [['things', 'Thing'], ['locations', 'Location'], ['sensors', 'Sensor'], ['observedProperties', 'ObservedProperty'], ['datastreams', 'Datastream'], ['networks', 'Network']]) {
  test(`${entity} writes retain backend-required metadata when GUI history is disabled`, async () => {
    for (const [setting, message] of [['false', undefined], ['false', 'Explicit reason'], ['true', 'Explicit reason']]) {
      const requests = []
      const service = deployment(setting, {
        '@/services/fetch': {
          fetchData: async () => ({ value: [] }),
          withAuthHeaders: (_token, headers) => ({ ...headers }),
        },
        fetch: async (_url, options) => {
          requests.push(options)
          return Response.json({ '@iot.id': 42 }, { status: 201 })
        },
      })(`services/${file}.ts`)
      for (const action of ['Create', 'Update']) {
        const write = service[`${action.toLowerCase()}${entity}`]
        if (!write) continue
        const payload = { name: 'Station', commitMessage: message }
        const result = action === 'Create' ? await write(payload) : await write('42', payload)
        assert.ok(result)
        const request = requests.at(-1)
        assert.equal(request.headers['commit-message'], message ?? `${action} ${entity} from GUI`)
        assert.equal(Object.hasOwn(JSON.parse(request.body), 'commitMessage'), false)
      }
    }
  })
}
