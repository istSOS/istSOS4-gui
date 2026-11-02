/* eslint-disable @typescript-eslint/no-require-imports -- Exercise chart selection with controlled React state and observation services. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const ui = path.resolve(__dirname, '../../..')
const endpoint = 'https://primary.test/v1.1'
function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
}
require.extensions['.ts'] = (module, filename) => {
  const original = module.require.bind(module)
  module.require = (name) =>
    original(
      name.startsWith('@/') ? path.join(ui, name.slice(2)) + '.ts' : name
    )
  module._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
}
const {
  datastreamKey,
  datastreamChoices,
} = require('../../observations/lib/datastreamSelection.ts')
const {
  buildSeriesEntries,
} = require('../../observations/lib/observationGraphUtils.ts')
const streams = [1, 2, 3].map((id) => ({
  '@iot.id': id,
  name: `Stream ${id}`,
  phenomenonTime: '2026-10-01T00:00:00Z/2026-10-25T12:00:00Z',
  ObservedProperty: { name: 'Temperature' },
  properties: { constraints: [{ type: 'flagRange', min: 0, max: 100 }] },
}))
const thing = {
  '@iot.id': 1,
  name: 'Station',
  __sourceEndpoint: endpoint,
  Datastreams: streams,
}
const rows = (id) => [
  {
    '@iot.id': 1,
    phenomenonTime: '2026-10-25T12:00:00Z',
    result: Number(id),
    resultQuality: 15,
  },
]
const depsEqual = (a, b) =>
  a && b && a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]))
function fixture(context, initial = {}, read) {
  const slots = [],
    effects = [],
    reads = []
  let index, effectIndex, dirty, pending, current
  const hooks = {
    useState(initial) {
      const i = index++
      if (!(i in slots))
        slots[i] = typeof initial === 'function' ? initial() : initial
      return [
        slots[i],
        (value) => {
          const next = typeof value === 'function' ? value(slots[i]) : value
          if (!Object.is(next, slots[i])) {
            slots[i] = next
            dirty = true
          }
        },
      ]
    },
    useRef(initial) {
      return (slots[index++] ??= { current: initial })
    },
    useMemo(callback, deps) {
      const i = index++
      if (!slots[i] || !depsEqual(slots[i].deps, deps))
        slots[i] = { deps, value: callback() }
      return slots[i].value
    },
    useEffect(callback, deps) {
      const i = effectIndex++,
        previous = effects[i]
      if (!previous || !depsEqual(previous.deps, deps))
        pending.push(() => {
          previous?.cleanup?.()
          effects[i] = { deps, cleanup: callback() }
        })
    },
  }
  const filename = path.join(__dirname, 'useChartState.ts'),
    component = new Module(filename, module)
  component.filename = filename
  component.paths = module.paths
  component.require = (name) => {
    if (name === 'react') return hooks
    if (name === '@/config/site') return { siteConfig: { api_root: endpoint } }
    if (name === '@/lib/dataSourceTokens')
      return { getDataSourceToken: () => undefined }
    if (name === '../lib/utils')
      return {
        getThingKey: (thing) =>
          `${thing.__sourceId ?? thing.__sourceEndpoint ?? endpoint}::${thing['@iot.id'] ?? thing.id}`,
      }
    if (name === '@/services/observations')
      return {
        getLatestObservationTime: async () => null,
        getObservationsByDatastream: async (...args) => {
          reads.push(args)
          return read ? read(...args) : { observationData: rows(args[1]) }
        },
      }
    return Module.prototype.require.call(
      component,
      name.startsWith('@/') ? path.join(ui, name.slice(2)) + '.ts' : name
    )
  }
  component._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
  let props = {
    localThings: [thing],
    liveThings: [thing],
    thingsResolvedFor: null,
    ...initial,
  }
  function render(update = {}) {
    props = { ...props, ...update }
    let count = 0
    do {
      if (++count > 30) throw Error('Render loop')
      dirty = false
      index = effectIndex = 0
      pending = []
      current = component.exports.useChartState(props)
      if (!dirty) pending.forEach((fn) => fn())
    } while (dirty)
  }
  async function act(callback) {
    const promise = callback(current)
    render()
    await promise
    render()
  }
  render()
  context.after(() => effects.forEach((effect) => effect.cleanup?.()))
  return {
    get current() {
      return current
    },
    reads,
    act,
    render,
    choices: datastreamChoices(props.localThings, endpoint),
  }
}

test('Details loads only the clicked stream even when its siblings have the same observed property', async (context) => {
  const app = fixture(context)
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  assert.deepEqual(
    app.reads.map((args) => args[1]),
    ['2']
  )
  assert.equal(app.current.selectedDatastream['@iot.id'], 2)
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [2]
  )
  assert.equal(app.current.availableDatastreams.length, 3)
  assert.deepEqual(
    app.current.activeDatastreamIds,
    app.current.selectedDatastreamKeysForChart
  )
})

test('adding and removing streams preserves the clicked primary and never loads unselected siblings', async (context) => {
  const app = fixture(context)
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  const [first, second] = app.choices
  await app.act((state) =>
    state.changeSelectedDatastreams([first.key, second.key])
  )
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [2, 1]
  )
  assert.deepEqual(
    app.reads.map((args) => args[1]),
    ['2', '1']
  )
  await app.act((state) => state.changeSelectedDatastreams([second.key]))
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [2]
  )
})

test('changing and resetting the period retains exact stream selection', async (context) => {
  const app = fixture(context)
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  await app.act((state) =>
    state.applyObservationRange('2026-10-20T00:00:00Z', '2026-10-21T00:00:00Z')
  )
  assert.deepEqual(app.reads.at(-1).slice(1, 4), [
    '2',
    '2026-10-20T00:00:00Z',
    '2026-10-21T00:00:00Z',
  ])
  await app.act((state) => state.applyObservationRange(null, null))
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [2]
  )
  assert.ok(app.reads.every((args) => args[1] === '2'))
  assert.equal(app.current.obsEnd, '2026-10-25T12:00:00.000Z')
})

test('opening another Details starts with only that stream and its own default range', async (context) => {
  const app = fixture(context)
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  await app.act((state) =>
    state.changeSelectedDatastreams(
      app.choices.slice(0, 2).map((choice) => choice.key)
    )
  )
  await app.act((state) =>
    state.applyObservationRange('2026-10-20T00:00:00Z', '2026-10-21T00:00:00Z')
  )
  await app.act((state) => state.openChartForDatastream(streams[2], thing))
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [3]
  )
  assert.equal(app.current.comparisonDatastream, null)
  assert.equal(app.current.obsEnd, '2026-10-25T12:00:00.000Z')
})

test('a stale read cannot replace a newer Details selection or reopen a closed chart', async (context) => {
  let finish
  const app = fixture(context, {}, async (_token, id) =>
    id === '1'
      ? new Promise((resolve) => (finish = resolve))
      : { observationData: rows(id) }
  )
  const old = app.current.openChartForDatastream(streams[0], thing)
  app.render()
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  finish({ observationData: rows('1') })
  await old
  app.render()
  assert.equal(app.current.selectedDatastream['@iot.id'], 2)
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.datastream['@iot.id']),
    [2]
  )
  const late = app.current.openChartForDatastream(streams[0], thing)
  app.render()
  app.current.resetChartState()
  app.render()
  finish({ observationData: rows('1') })
  await late
  app.render()
  assert.equal(app.current.isChartOpen, false)
  assert.equal(app.current.allSeries.length, 0)
})

test('sources with the same local stream ID remain separate in requests and graph series', async (context) => {
  const other = {
    ...thing,
    '@iot.id': 2,
    __sourceEndpoint: 'https://other.test/v1.1',
    Datastreams: [{ ...streams[0], name: 'Other stream' }],
  }
  const app = fixture(context, {
    localThings: [thing, other],
    liveThings: [thing, other],
  })
  await app.act((state) => state.openChartForDatastream(streams[0], thing))
  const keys = [
    datastreamKey({ ...streams[0], __sourceEndpoint: endpoint }),
    datastreamKey({ ...streams[0], __sourceEndpoint: other.__sourceEndpoint }),
  ]
  await app.act((state) => state.changeSelectedDatastreams(keys))
  assert.equal(new Set(app.current.activeDatastreamIds).size, 2)
  assert.deepEqual(
    app.reads.map((args) => args[4]),
    [endpoint, other.__sourceEndpoint]
  )
  const entries = buildSeriesEntries({
    allSeries: app.current.allSeries,
    datastream: null,
    comparisonDatastream: null,
    chartData: [],
    comparisonChartData: [],
  })
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2)
})

test('snapshot comparison and date-range changes keep the exact clicked stream', async (context) => {
  const asOf = '2026-10-26T00:00:00Z',
    compare = '2026-10-27T00:00:00Z'
  const app = fixture(context, { asOfDate: asOf, thingsResolvedFor: asOf })
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  await app.act((state) => state.changeCompareAsOfDate(compare))
  assert.equal(app.current.allSeries.length, 2)
  assert.ok(
    app.current.allSeries.every((entry) => entry.datastream['@iot.id'] === 2)
  )
  assert.deepEqual(
    app.current.allSeries.map((entry) => entry.asOf),
    [asOf, compare]
  )
  await app.act((state) => state.applyObservationRange(null, null))
  assert.equal(app.current.compareAligned, true)
  await app.act((state) => state.changeCompareAsOfDate(null))
  assert.equal(app.current.allSeries.length, 1)
  assert.ok(app.reads.every((args) => args[1] === '2'))
})

test('read failures are shown in Details and always release its loading state', async (context) => {
  const app = fixture(context, {}, async () => {
    throw Error('Source unavailable')
  })
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  assert.equal(app.current.obsError, 'Source unavailable')
  assert.equal(app.current.obsLoading, false)
  assert.equal(app.current.allSeries.length, 0)
})

test('moving the snapshot waits for matching metadata and refetches only the chosen stream', async (context) => {
  const asOf = '2026-10-26T00:00:00Z',
    next = '2026-10-27T00:00:00Z'
  const app = fixture(context, { asOfDate: asOf, thingsResolvedFor: asOf })
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  const before = app.reads.length
  app.render({ asOfDate: next })
  assert.equal(app.reads.length, before)
  const updated = {
    ...thing,
    Datastreams: streams.map((stream) =>
      stream['@iot.id'] === 2
        ? {
            ...stream,
            properties: {
              constraints: [{ type: 'flagRange', min: 0, max: 200 }],
            },
          }
        : stream
    ),
  }
  app.render({ localThings: [updated], thingsResolvedFor: next })
  await new Promise((resolve) => setTimeout(resolve, 350))
  app.render()
  assert.ok(
    app.reads.slice(before).every((args) => args[1] === '2' && args[5] === next)
  )
  assert.ok(app.reads.length > before)
  assert.equal(app.current.allSeries.length, 1)
  assert.equal(
    app.current.selectedDatastream.properties.constraints[0].max,
    200
  )
})

test('grey legend entries replace B, preserve A and remain available when no longer plotted', async (context) => {
  const app = fixture(context)
  await app.act((state) => state.openChartForDatastream(streams[0], thing))
  const [a, b, c] = app.choices
  await app.act((state) => state.toggleChartDatastream(b.key))
  assert.deepEqual(app.current.selectedDatastreamKeysForChart, [a.key, b.key])
  await app.act((state) => state.toggleChartDatastream(c.key))
  assert.deepEqual(app.current.selectedDatastreamKeysForChart, [a.key, c.key])
  assert.deepEqual(app.current.listedDatastreamKeys, [a.key, b.key, c.key])
  await app.act((state) => state.toggleChartDatastream(b.key))
  assert.deepEqual(app.current.selectedDatastreamKeysForChart, [a.key, b.key])
  await app.act((state) => state.toggleChartDatastream(b.key))
  assert.deepEqual(app.current.selectedDatastreamKeysForChart, [a.key])
  assert.equal(app.current.listedDatastreamKeys.length, 3)
})

test('removing hidden and plotted legend items keeps at least one stream and resets on a fresh Details opening', async (context) => {
  const app = fixture(context),
    [a, b, c] = app.choices
  await app.act((state) => state.openChartForDatastream(streams[0], thing))
  await app.act((state) => state.toggleChartDatastream(b.key))
  await app.act((state) => state.toggleChartDatastream(c.key))
  await app.act((state) => state.removeChartDatastream(b.key))
  assert.deepEqual(app.current.listedDatastreamKeys, [a.key, c.key])
  await app.act((state) => state.removeChartDatastream(c.key))
  assert.deepEqual(app.current.selectedDatastreamKeysForChart, [a.key])
  await app.act((state) => state.removeChartDatastream(a.key))
  assert.deepEqual(app.current.listedDatastreamKeys, [a.key])
  await app.act((state) => state.openChartForDatastream(streams[1], thing))
  assert.deepEqual(app.current.listedDatastreamKeys, [b.key])
})
