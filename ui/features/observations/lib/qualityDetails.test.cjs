/* eslint-disable @typescript-eslint/no-require-imports -- Load the production TypeScript helpers with Node's test runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const translations = require('../../../locales/en/translation.json')
const catalog = require('../../../config/fixtures/resultQuality.json')
const description = (code, language = 'en') =>
  catalog.find((flag) => flag.code === code)?.description[language] ?? ''

function translate(dictionary, key, options = {}) {
  const text = key.split('.').reduce((value, part) => value?.[part], dictionary)
  return String(
    typeof text === 'string' ? text : (options.defaultValue ?? key)
  ).replaceAll('{{count}}', String(options.count))
}
const t = (key, options) => translate(translations, key, options)
function modules(
  translate = t,
  settings = { flags: catalog, bitmaskEnabled: true }
) {
  const document = {
    getElementById: () => ({ textContent: JSON.stringify(settings) }),
  }
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
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    vm.runInNewContext(
      code,
      {
        module: loaded,
        exports: loaded.exports,
        require(specifier) {
          if (specifier === 'react-i18next')
            return { useTranslation: () => ({ t: translate }) }
          if (specifier.endsWith('/QcExplanation'))
            return { __esModule: true, default: 'QcExplanation' }
          if (specifier === '@/features/observations/lib/resultQuality')
            return load('resultQuality.ts')
          if (specifier === '@/config/site')
            return { siteConfig: { api_root: 'http://source/v1.1' } }
          if (specifier.startsWith('.')) {
            const base = path.resolve(path.dirname(filename), specifier)
            return load(
              path.relative(
                __dirname,
                fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`
              )
            )
          }
          return require(specifier)
        },
        document,
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
  assert.equal(qualitySummary(310, [], 'service', t), description(310))
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
  assert.equal(qualityDetails(55, constraints, t).rows.length, 0)
  assert.ok(qualityDetails(55, constraints, t).unavailable)
  assert.equal(
    qualityDetails(0, [], t).rows[0].value,
    t('qc.data_state.missing')
  )
  assert.equal(qualityDetails(0, [], t).rows[1].value, t('qc.not_reviewed'))
})

test('two-check bit patterns use QC status words, while legacy categories use descriptions', () => {
  const load = modules()
  const { qualityDetails } = load('qualityDetails.ts')
  const { slotState, checkStatus, dataStatus, humanStatus, fitsMask } = load(
    '../../qc/lib/bitmask.ts'
  )
  const { qualityFlagDescription } = load('../../qc/lib/qualityFlags.ts')
  for (let mask = 0; mask < 256; mask++) {
    if (qualityFlagDescription(mask)) {
      assert.equal(qualityDetails(mask, constraints, t).rows.length, 1)
      assert.equal(
        qualityDetails(mask, constraints, t).rows[0].value,
        description(mask)
      )
      continue
    }
    if (!fitsMask(mask, constraints.length)) {
      assert.equal(qualityDetails(mask, constraints, t).rows.length, 0)
      assert.ok(qualityDetails(mask, constraints, t).unavailable)
      continue
    }
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

const legacyCodes = [
  100, 110, 120, 132, 208, 210, 220, 230, 310, 312, 313, 320, 321, 322, 323,
  330, 332, 333,
]

function textContent(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join(' ')
  return textContent(node.props?.children)
}

test('observation popups display legacy descriptions in English and Italian without bitmask fields', () => {
  for (const language of ['en', 'it']) {
    const dictionary = require(`../../../locales/${language}/translation.json`)
    const tr = (key, options) => translate(dictionary, key, options)
    const load = modules(tr)
    const ObservationQuality = load(
      '../components/ObservationQuality.tsx'
    ).default
    const { QualityDetails } = load('../../qc/components/QcQualityDetails.tsx')
    const { buildRows, buildSeriesEntries } = load('observationGraphUtils.ts')
    for (const code of legacyCodes) {
      const [entry] = buildSeriesEntries({
        allSeries: [],
        datastream: stream,
        comparisonDatastream: null,
        chartData: buildRows([sample(code)], constraints, 'bitmask'),
        comparisonChartData: [],
      })
      const badge = ObservationQuality({ row: entry.rows[0], entry })
      const popup = badge.props.children.props.content
      assert.equal(popup.type, QualityDetails)
      const expectedDescription = description(code, language)
      const text = textContent(QualityDetails(popup.props))
      assert.ok(
        text.includes(expectedDescription),
        `${language} popup for ${code}`
      )
      assert.equal(text.includes(tr('qc.explain.invalid_mask')), false)
      assert.equal(text.includes(tr('qc.binary')), false)
      assert.equal(text.includes(tr('qc.human_review')), false)
      assert.equal(text.includes(tr('qc.data_state_label')), false)
      // The QC table calls the same component with the stream's bitmask mode.
      assert.ok(
        textContent(
          QualityDetails({ ...popup.props, serviceMode: false, encoded: true })
        ).includes(expectedDescription)
      )
    }
  }
})

test('all 18 legacy codes use translated descriptions regardless of stream layout', () => {
  const load = modules()
  const { qualitySummary, qualityClassOf } = load('resultQuality.ts')
  const { qualityDetails } = load('qualityDetails.ts')
  const { compactQuality } = load('observationQuality.ts')
  const { fitsMask, maskVerdict, oasiQuality } = load('../../qc/lib/bitmask.ts')
  const { qualityFlagDescription } = load('../../qc/lib/qualityFlags.ts')
  for (const code of legacyCodes) {
    assert.ok(qualityFlagDescription(code))
    const english = description(code)
    assert.ok(english, `Missing English description for ${code}`)
    assert.ok(
      description(code, 'it'),
      `Missing Italian description for ${code}`
    )
    for (const raw of [code, String(code), ` ${code} `]) {
      for (const mode of ['service', 'bitmask']) {
        for (const layout of [
          null,
          [],
          constraints,
          Array(4).fill(constraints[0]),
        ]) {
          assert.equal(qualitySummary(raw, layout, mode, t), english)
          assert.equal(qualityClassOf(raw, layout, mode), 'unknown')
          assert.equal(compactQuality(raw, layout, mode).verdict, null)
          const details = qualityDetails(raw, layout, t)
          assert.equal(details.unavailable, undefined)
          assert.equal(details.rows.length, 1)
          assert.equal(details.rows[0].value, english)
        }
      }
      for (let checks = 0; checks <= 4; checks++) {
        assert.equal(fitsMask(raw, checks), false)
        assert.equal(maskVerdict(raw, checks), 'unknown')
        assert.equal(oasiQuality(raw, checks), null)
      }
    }
  }
  assert.equal(description(110), 'Missing data')
})

test('130 and 200 retain bitmask decoding without legacy aliases', () => {
  const load = modules()
  const { qualityFlagDescription } = load('../../qc/lib/qualityFlags.ts')
  const { fitsMask, maskVerdict } = load('../../qc/lib/bitmask.ts')
  const { qualitySummary } = load('resultQuality.ts')
  const { qualityDetails } = load('qualityDetails.ts')
  for (const code of [130, 200]) {
    assert.equal(qualityFlagDescription(code), '')
    assert.equal(description(code), '')
    assert.equal(fitsMask(code, 2), true)
    assert.equal(qualityDetails(code, constraints, t).rows.length, 4)
    assert.equal(
      qualitySummary(code, constraints, 'bitmask', t),
      t(`qc.verdict.${maskVerdict(code, 2)}`)
    )
  }
})

test('empty catalogs and disabled bitmasks show Unknown while preserving raw codes and absent quality', () => {
  for (const bitmaskEnabled of [true, false]) {
    const load = modules(t, { flags: [], bitmaskEnabled })
    const { qualitySummary } = load('resultQuality.ts')
    const { compactQuality } = load('observationQuality.ts')
    const { qualityDetails } = load('qualityDetails.ts')
    for (const code of legacyCodes) {
      assert.equal(
        qualitySummary(code, constraints, 'bitmask', t),
        t('qc.verdict.unknown')
      )
      assert.equal(
        compactQuality(code, constraints, 'bitmask').code,
        String(code)
      )
      assert.equal(
        compactQuality(code, constraints, 'bitmask').verdict,
        'unknown'
      )
      assert.equal(qualityDetails(code, constraints, t).rows.length, 0)
    }
    assert.equal(compactQuality(null, constraints, 'bitmask').code, null)
    assert.equal(compactQuality(null, constraints, 'bitmask').verdict, null)
    assert.equal(
      compactQuality(63, constraints, 'bitmask').verdict,
      bitmaskEnabled ? 'pass' : 'unknown'
    )
  }
  const load = modules(t, { flags: catalog, bitmaskEnabled: false })
  const { qualitySummary } = load('resultQuality.ts')
  assert.equal(qualitySummary(208, constraints, 'bitmask', t), description(208))
  assert.equal(
    qualitySummary(63, constraints, 'bitmask', t),
    t('qc.verdict.unknown')
  )
})

test('mixed graph readings show legacy descriptions without hiding neighboring bitmask verdicts', () => {
  const load = modules()
  const { option, entry } = optionFor(load, stream, [
    sample(63),
    ...legacyCodes.map((code, index) => ({
      ...sample(code),
      phenomenonTime: new Date(
        Date.parse(sample(code).phenomenonTime) + (index + 1) * 60000
      ).toISOString(),
    })),
  ])
  const hover = (row) =>
    option.tooltip.formatter({
      seriesName: entry.id,
      data: [row.ts, 2.5],
    })
  assert.ok(hover(entry.rows[0]).includes(t('qc.verdict.pass')))
  for (let index = 0; index < legacyCodes.length; index++) {
    const html = hover(entry.rows[index + 1])
    assert.ok(html.includes(description(legacyCodes[index])))
    assert.equal(html.includes(t('qc.verdict.unknown')), false)
    assert.equal(html.includes(t('qc.data_state_label')), false)
    assert.equal(html.includes(t('qc.human_review')), false)
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
  assert.equal(html.includes(t('qc.verdict.unknown')), true)
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
  assert.equal(hover(1).includes(t('qc.verdict.unknown')), true)
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

test('compact quality labels unrecognized flags Unknown, keeps catalog codes compact, and omits absent quality', () => {
  const load = modules(),
    { compactQuality } = load('observationQuality.ts')
  const pass = compactQuality(63, constraints, 'bitmask')
  assert.equal(pass.code, '63')
  assert.equal(pass.verdict, 'pass')
  for (const raw of [257, -1, 1.5, 'unmanaged', { detail: 'unknown' }]) {
    const quality = compactQuality(raw, constraints, 'bitmask')
    assert.equal(quality.verdict, 'unknown')
    assert.equal(quality.code, load('../../qc/lib/bitmask.ts').rawText(raw))
  }
  assert.equal(compactQuality(310, [], 'service').verdict, null)
  assert.equal(compactQuality(63, null, 'bitmask').verdict, 'unknown')
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
