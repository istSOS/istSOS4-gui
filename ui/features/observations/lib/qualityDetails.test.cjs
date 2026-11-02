/* eslint-disable @typescript-eslint/no-require-imports -- Load the production TypeScript helpers with Node's test runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const translations = require('../../../locales/en/translation.json')

function t(key, options = {}) {
  const text = key
    .split('.')
    .reduce((value, part) => value?.[part], translations)
  return String(
    typeof text === 'string' ? text : (options.defaultValue ?? key)
  ).replaceAll('{{count}}', String(options.count))
}
function modules() {
  const cache = new Map(),
    storage = new Map()
  const load = (name) => {
    const filename = path.resolve(__dirname, name)
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
        require(specifier) {
          if (specifier === '@/config/site')
            return { siteConfig: { api_root: 'http://source/v1.1' } }
          if (specifier.startsWith('.'))
            return load(
              path.relative(
                __dirname,
                path.resolve(path.dirname(filename), `${specifier}.ts`)
              )
            )
          return require(specifier)
        },
        window: { addEventListener() {} },
        localStorage: {
          getItem: (key) => storage.get(key),
          setItem: (key, value) => storage.set(key, value),
        },
      },
      { filename }
    )
    return loaded.exports
  }
  return load
}
const constraints = [
  { type: 'flagRange', min: 0, max: 10 },
  { type: 'flagJumps', max: 2 },
]
const stream = {
  '@iot.id': 1,
  name: 'Chlorophyll',
  __sourceEndpoint: 'http://source/v1.1',
  properties: { constraints },
  unitOfMeasurement: { symbol: 'µg/L' },
}
const sample = (quality) => ({
  phenomenonTime: '2026-10-27T12:00:00Z',
  result: 2.5,
  resultQuality: quality,
})

test('stored metadata selects fixed QC interpretation without browser rules', () => {
  const load = modules(),
    { qualityModeOf } = load('resultQuality.ts')
  assert.equal(qualityModeOf(stream), 'bitmask')
  assert.equal(qualityModeOf({ ...stream, properties: {} }), 'service')
  assert.equal(
    qualityModeOf({
      ...stream,
      properties: { constraints: JSON.stringify(constraints) },
    }),
    'bitmask'
  )
  assert.equal(
    qualityModeOf({ ...stream, properties: { constraints: 'broken' } }),
    'bitmask'
  )
})

test('all stored two-check flags have exactly the Edit/QC verdict and colour', () => {
  const load = modules(),
    { qualityClassOf, QUALITY_COLORS } = load('resultQuality.ts')
  const { maskVerdict, VERDICT_COLORS } = load('../../qc/lib/bitmask.ts')
  for (let mask = 0; mask < 256; mask++) {
    assert.equal(
      qualityClassOf(mask, constraints, 'bitmask'),
      maskVerdict(mask, 2)
    )
    assert.equal(
      QUALITY_COLORS[qualityClassOf(mask, constraints, 'bitmask')],
      VERDICT_COLORS[maskVerdict(mask, 2)]
    )
  }
})

test('service codes use the shared category catalog instead of a score threshold', () => {
  const load = modules(),
    { qualitySummary, qualityClassOf } = load('resultQuality.ts')
  assert.equal(
    qualitySummary(310, [], 'service', t),
    t('qc.workflow.flags.310')
  )
  assert.equal(qualityClassOf(100, [], 'service'), 'unknown')
  assert.equal(
    qualitySummary(999, [], 'service', t),
    t('qc.workflow.unknown_code')
  )
})

test('decoded details match QC check, data-state and human-review language', () => {
  const load = modules(),
    { qualityDetails } = load('qualityDetails.ts')
  const passed = qualityDetails('63', constraints, t)
  assert.deepEqual(
    Array.from(passed.rows, (row) => row.value),
    [
      t('qc.passed'),
      t('qc.passed'),
      t('qc.data_state.raw'),
      t('qc.not_reviewed'),
    ]
  )
  assert.deepEqual(
    Array.from(passed.rows, (row) => row.label),
    [
      t('qc.workflow.tests.flagRange'),
      t('qc.workflow.tests.flagJumps'),
      t('qc.data_state_label'),
      t('qc.human_review'),
    ]
  )
  assert.equal(
    qualityDetails(191, constraints, t).rows.at(-1).value,
    t('qc.rejected')
  )
  assert.equal(
    qualityDetails(255, constraints, t).rows.at(-1).value,
    t('qc.accepted')
  )
  assert.equal(
    qualityDetails(55, constraints, t).rows[0].value,
    t('qc.reserved')
  )
  assert.equal(
    qualityDetails(0, [], t).rows[0].value,
    t('qc.data_state.missing')
  )
  assert.equal(qualityDetails(0, [], t).rows[1].value, t('qc.not_reviewed'))
})

test('all two-check bit patterns use the same status words as QcGraph', () => {
  const load = modules()
  const { qualityDetails } = load('qualityDetails.ts')
  const { slotState, checkStatus, dataStatus, humanStatus } = load(
    '../../qc/lib/bitmask.ts'
  )
  for (let mask = 0; mask < 256; mask++) {
    assert.deepEqual(
      Array.from(qualityDetails(mask, constraints, t).rows, (row) => row.value),
      [
        t(`qc.${checkStatus(slotState(mask, 1))}`),
        t(`qc.${checkStatus(slotState(mask, 2))}`),
        t(`qc.data_state.${dataStatus(mask)}`),
        t(`qc.${humanStatus(slotState(mask, 3))}`),
      ]
    )
  }
})

test('unreadable and out-of-range flags remain raw, with no fabricated check outcomes', () => {
  const load = modules(),
    { qualityDetails, rawQualityText } = load('qualityDetails.ts')
  const { buildRows } = load('observationGraphUtils.ts')
  for (const raw of [256, -1, 1.5, 'unknown', { detail: 'unknown' }]) {
    const decoded = qualityDetails(raw, constraints, t)
    assert.equal(decoded.rows.length, 0)
    assert.ok(decoded.unavailable)
    const [row] = buildRows([sample(raw)], constraints, 'bitmask')
    assert.equal(row.qualityClass, 'unknown')
    assert.equal(rawQualityText(row.rawQuality), rawQualityText(raw))
  }
  assert.ok(qualityDetails(63, null, t).unavailable)
  assert.equal(qualityDetails(null, constraints, t).unavailable, undefined)
})

function optionFor(load, source, observations, overrides = {}) {
  const { buildRows, buildSeriesEntries } = load('observationGraphUtils.ts')
  const { qualityConstraintsOf, qualityModeOf } = load('resultQuality.ts')
  const entries = buildSeriesEntries({
    allSeries: [],
    datastream: source,
    comparisonDatastream: null,
    chartData: buildRows(
      observations,
      qualityConstraintsOf(source),
      qualityModeOf(source)
    ),
    comparisonChartData: [],
  })
  const option = load('observationGraphOptions.ts').buildObservationGraphOption(
    {
      seriesEntries: entries,
      activeDatastreamIds: ['1'],
      primaryColor: '#008374',
      t,
      ...overrides,
    }
  )
  return { option, entry: entries[0] }
}

test('the hover tooltip stays compact and escapes raw source text', () => {
  const load = modules(),
    { option, entry } = optionFor(load, stream, [sample('<img src=x>')])
  const html = option.tooltip.formatter({
    seriesName: entry.id,
    data: [entry.rows[0].ts, 2.5],
    axisValueLabel: '<timestamp>',
  })
  assert.doesNotMatch(html, /<table/)
  assert.ok(html.startsWith('<section'))
  assert.ok(html.includes(stream.name))
  assert.ok(html.includes('2026-10-27T12:00:00Z'))
  assert.ok(html.includes(t('qc.quality')))
  assert.equal(html.includes(t('qc.verdict.unknown')), false)
  assert.match(html, /&lt;img src=x&gt;/)
  assert.doesNotMatch(html, /<img|<timestamp>/)
  assert.equal(option.tooltip.confine, true)
})

test('one unmanaged flag does not prevent neighboring readings from being decoded', () => {
  const load = modules()
  const invalid = {
    ...sample('unmanaged flag'),
    phenomenonTime: '2026-10-27T12:10:00Z',
  }
  const { option, entry } = optionFor(load, stream, [sample(63), invalid])
  const hover = (index) =>
    option.tooltip.formatter({
      seriesName: entry.id,
      data: [entry.rows[index].ts, 2.5],
    })
  assert.ok(hover(0).includes(t('qc.verdict.pass')))
  assert.equal(hover(0).includes(t('qc.human_review')), false)
  assert.ok(hover(1).includes('unmanaged flag'))
  assert.equal(hover(1).includes(t('qc.verdict.unknown')), false)
  assert.equal(hover(1).includes(t('qc.data_state_label')), false)
  assert.equal(hover(1).includes(t('qc.human_review')), false)
})

test('snapshot tooltip lookup uses each snapshot’s own flags and constraints on an aligned axis', () => {
  const load = modules(),
    { buildSeriesEntries } = load('observationGraphUtils.ts')
  const entries = buildSeriesEntries({
    allSeries: [
      {
        datastream: stream,
        observations: [sample(255)],
        asOf: '2026-10-27T12:00:00Z',
      },
      {
        datastream: {
          ...stream,
          properties: { constraints: [constraints[0]] },
        },
        observations: [
          { ...sample(47), phenomenonTime: '2026-10-26T12:00:00Z' },
        ],
        asOf: '2026-10-26T12:00:00Z',
      },
    ],
    datastream: null,
    comparisonDatastream: null,
    chartData: [],
    comparisonChartData: [],
  })
  const option = load('observationGraphOptions.ts').buildObservationGraphOption(
    {
      seriesEntries: entries,
      activeDatastreamIds: entries.map((e) => e.id),
      primaryColor: '#008374',
      t,
      alignedAxis: true,
      isCompare: true,
    }
  )
  const html = option.tooltip.formatter(
    entries.map((entry) => ({
      seriesName: entry.id,
      data: [0, 2.5],
      axisValueLabel: '0',
    }))
  )
  assert.ok(html.includes(t('qc.verdict.accepted')))
  assert.ok(html.includes(t('qc.verdict.rejected')))
  assert.ok(html.includes('255'))
  assert.ok(html.includes('47'))
})

test('missing and non-numeric results remain in the table data, with gaps in the plot', () => {
  const load = modules(),
    { buildRows } = load('observationGraphUtils.ts')
  const raw = [null, -999, 'not a number', 2.5]
  const rows = buildRows(
    raw.map((result, i) => ({
      ...sample(63),
      '@iot.id': i + 1,
      result,
      phenomenonTime: new Date(1700000000000 + i * 60000).toISOString(),
    })),
    constraints,
    'bitmask'
  )
  assert.equal(rows.length, 4)
  assert.deepEqual(
    Array.from(rows, (row) => row.value),
    [null, null, null, 2.5]
  )
  assert.deepEqual(
    Array.from(rows, (row) => row.rawValue),
    raw
  )
})

test('tooltip timestamps use each actual observation, the chosen offset and original fractional precision', () => {
  const load = modules(),
    observation = {
      ...sample(63),
      phenomenonTime: '2026-10-27T23:30:00.123456Z',
    }
  const { option, entry } = optionFor(load, stream, [observation], {
    utcOffset: 345,
  })
  const html = option.tooltip.formatter({
    seriesName: entry.id,
    data: [entry.rows[0].ts, 2.5],
    axisValue: 0,
    axisValueLabel: 'wrong cursor time',
  })
  assert.ok(html.includes('2026-10-28T05:15:00.123456+05:45'))
  assert.equal(html.includes('wrong cursor time'), false)
  assert.equal(entry.rows[0].time, observation.phenomenonTime)
})

test('compact quality shows only code for service and unrecognized flags, and dash for absent quality', () => {
  const load = modules(),
    { compactQuality } = load('observationQuality.ts')
  const pass = compactQuality(63, constraints, 'bitmask')
  assert.equal(pass.code, '63')
  assert.equal(pass.verdict, 'pass')
  for (const raw of [257, -1, 1.5, 'unmanaged', { detail: 'unknown' }]) {
    const quality = compactQuality(raw, constraints, 'bitmask')
    assert.equal(quality.verdict, null)
    assert.equal(quality.code, load('../../qc/lib/bitmask.ts').rawText(raw))
  }
  assert.equal(compactQuality(310, [], 'service').verdict, null)
  assert.equal(compactQuality(63, null, 'bitmask').verdict, null)
  assert.equal(compactQuality(null, constraints, 'bitmask').code, null)
})

test('QC date helpers accept editor UTC values and API ISO dates without shifting instants', () => {
  const { toOffsetInput, fromOffsetInput, utcTimestamp } = modules()(
    '../../qc/lib/timezone.ts'
  )
  for (const value of [
    '2026-10-30T14:25:00.123',
    '2026-10-30T14:25:00.123Z',
    '2026-10-30T15:25:00.123+01:00',
  ]) {
    assert.equal(toOffsetInput(value, 60), '2026-10-30T15:25:00.123')
    assert.equal(utcTimestamp(value), Date.parse('2026-10-30T14:25:00.123Z'))
  }
  assert.equal(
    fromOffsetInput('2026-10-31T00:30', 345),
    '2026-10-30T18:45:00.000'
  )
})
