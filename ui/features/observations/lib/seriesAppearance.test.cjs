/* eslint-disable @typescript-eslint/no-require-imports -- Load the production persistence and search helpers with isolated browser storage. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
function fixture(initial = new Map(), throwOnWrite = false) {
  const cache = new Map(),
    events = new Map()
  let notifications = 0,
    subscribed = false
  const load = (name) => {
    const filename = path.resolve(__dirname, name)
    if (cache.has(filename)) return cache.get(filename).exports
    const loaded = { exports: {} }
    cache.set(filename, loaded)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText
    vm.runInNewContext(
      code,
      {
        module: loaded,
        exports: loaded.exports,
        window: {
          localStorage: {
            getItem: (key) => initial.get(key) ?? null,
            setItem: (key, value) => {
              if (throwOnWrite) throw Error('Blocked')
              initial.set(key, value)
            },
          },
          addEventListener: (name, listener) => events.set(name, listener),
          removeEventListener: (name) => events.delete(name),
        },
        require: (name) => {
          if (name === 'react')
            return {
              useSyncExternalStore: (subscribe, getSnapshot) => {
                if (!subscribed) {
                  subscribe(() => notifications++)
                  subscribed = true
                }
                return getSnapshot()
              },
            }
          if (name.startsWith('.'))
            return load(
              path.relative(
                __dirname,
                path.resolve(path.dirname(filename), name + '.ts')
              )
            )
          return require(name)
        },
      },
      { filename }
    )
    return loaded.exports
  }
  return {
    load,
    storage: initial,
    events,
    get notifications() {
      return notifications
    },
  }
}
test('appearance settings are validated and cannot inject arbitrary CSS or hide a points-only stream', () => {
  const { validAppearance, readAppearances } = fixture().load(
    'seriesAppearance.ts'
  )
  const bad = validAppearance({
    color: 'url(evil)',
    line: 'invalid',
    points: 'yes',
    type: 'unsupported',
  })
  assert.equal(Object.keys(bad).length, 0)
  const valid = validAppearance({
    color: '#7c3aed',
    line: 'none',
    points: false,
  })
  assert.equal(valid.color, '#7c3aed')
  assert.equal(valid.line, 'none')
  assert.equal(valid.points, true)
  for (const raw of ['broken', 'null', '[]', '"text"'])
    assert.equal(Object.keys(readAppearances(raw)).length, 0)
})
test('appearance choices persist per source and datastream, and Reset style removes just its override', () => {
  const app = fixture(),
    store = app.load('seriesAppearanceStore.ts'),
    { SERIES_APPEARANCE_KEY } = app.load('seriesAppearance.ts')
  store.useSeriesAppearances()
  const a = '["https://one.test/v1.1","1"]',
    b = '["https://two.test/v1.1","1"]'
  store.saveSeriesAppearance(a, {
    color: '#7c3aed',
    line: 'dotted',
    points: true,
  })
  store.saveSeriesAppearance(b, { color: '#2563eb', line: 'dashed' })
  assert.equal(app.notifications, 2)
  const reloaded = fixture(app.storage)
    .load('seriesAppearanceStore.ts')
    .useSeriesAppearances()
  assert.equal(reloaded[a].color, '#7c3aed')
  assert.equal(reloaded[b].line, 'dashed')
  store.saveSeriesAppearance(a, null)
  const saved = JSON.parse(app.storage.get(SERIES_APPEARANCE_KEY))
  assert.equal(saved[a], undefined)
  assert.equal(saved[b].color, '#2563eb')
})
test('appearance changes remain usable when browser storage is blocked and follow changes in another tab', () => {
  const app = fixture(new Map(), true),
    store = app.load('seriesAppearanceStore.ts'),
    { SERIES_APPEARANCE_KEY } = app.load('seriesAppearance.ts')
  store.useSeriesAppearances()
  store.saveSeriesAppearance('stream', { line: 'dashed' })
  assert.equal(store.useSeriesAppearances().stream.line, 'dashed')
  app.storage.set(
    SERIES_APPEARANCE_KEY,
    JSON.stringify({ stream: { color: '#2563eb' } })
  )
  app.events.get('storage')({ key: SERIES_APPEARANCE_KEY })
  assert.equal(store.useSeriesAppearances().stream.color, '#2563eb')
})
test('stream search matches name, station, property, source name and source address with multiple words', () => {
  const { datastreamChoices, searchDatastreams } = fixture().load(
    'datastreamSelection.ts'
  )
  const choices = datastreamChoices(
    [
      {
        '@iot.id': 1,
        name: 'Alpha station',
        __sourceName: 'Weather source',
        __sourceEndpoint: 'https://weather.test/v1.1',
        Datastreams: [
          {
            '@iot.id': 1,
            name: 'Main sensor',
            ObservedProperty: { name: 'Temperature' },
          },
        ],
      },
      {
        '@iot.id': 2,
        name: 'Beta station',
        __sourceName: 'River source',
        __sourceEndpoint: 'https://river.test/v1.1',
        Datastreams: [
          {
            '@iot.id': 2,
            name: 'Backup sensor',
            ObservedProperty: { name: 'Water level' },
          },
        ],
      },
    ],
    'https://primary.test/v1.1'
  )
  for (const query of [
    'MAIN',
    'alpha',
    'temperature',
    'weather source',
    'weather.test',
    'alpha weather temperature',
  ]) {
    const matches = searchDatastreams(choices, query)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].datastream.name, 'Main sensor')
  }
  assert.equal(searchDatastreams(choices, 'missing').length, 0)
  assert.equal(searchDatastreams(choices, '').length, 2)
})

test('bar display persists per stream without discarding line preferences', () => {
  const app = fixture(),
    store = app.load('seriesAppearanceStore.ts')
  store.useSeriesAppearances()
  store.saveSeriesAppearance('rainfall', {
    type: 'bar',
    color: '#2563eb',
    line: 'dashed',
    points: true,
  })
  const reloaded = fixture(app.storage)
    .load('seriesAppearanceStore.ts')
    .useSeriesAppearances()
  assert.equal(reloaded.rainfall.type, 'bar')
  assert.equal(reloaded.rainfall.line, 'dashed')
  assert.equal(reloaded.rainfall.color, '#2563eb')
})
