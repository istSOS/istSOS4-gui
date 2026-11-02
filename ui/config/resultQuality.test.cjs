/* eslint-disable @typescript-eslint/no-require-imports -- Load production TypeScript in isolated server/browser contexts. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const catalog = require('./fixtures/resultQuality.json')

function modules(env = {}, document) {
  const cache = new Map()
  const load = (filename) => {
    filename = path.resolve(__dirname, filename)
    if (cache.has(filename)) return cache.get(filename).exports
    const loaded = { exports: {} }
    cache.set(filename, loaded)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText
    vm.runInNewContext(
      source,
      {
        module: loaded,
        exports: loaded.exports,
        process: { env },
        document,
        require(specifier) {
          return load(path.resolve(path.dirname(filename), `${specifier}.ts`))
        },
      },
      { filename }
    )
    return loaded.exports
  }
  return load
}

test('an empty or unset catalog has no fallback and bitmask decoding defaults to enabled', () => {
  for (const raw of [undefined, '', '  ', '[]']) {
    const load = modules({ RESULT_QUALITY_CODES: raw })
    const config = load('resultQuality.ts').getResultQualityConfig()
    assert.equal(config.flags.length, 0)
    assert.equal(config.bitmaskEnabled, true)
    assert.equal(
      load('../features/qc/lib/qualityFlags.ts').qualityFlagDescription(110),
      ''
    )
  }
})

test('invalid JSON, duplicate codes, incomplete translations and invalid toggles fail clearly', () => {
  const { parseResultQualityConfig } = modules()('resultQuality.ts')
  for (const raw of [
    'broken',
    '{}',
    'null',
    '[100]',
    '[null]',
    JSON.stringify([{ code: '100', description: { en: 'Raw', it: 'Grezzo' } }]),
    JSON.stringify([{ code: -1, description: { en: 'Raw', it: 'Grezzo' } }]),
    JSON.stringify([{ code: 100, description: { en: 'Raw' } }]),
    JSON.stringify([{ code: 100, description: { en: ' ', it: 'Grezzo' } }]),
    JSON.stringify([catalog[0], catalog[0]]),
  ])
    assert.throws(() => parseResultQualityConfig(raw), /RESULT_QUALITY_CODES/)
  for (const raw of ['yes', 'no', '1', '0'])
    assert.throws(
      () => parseResultQualityConfig('', raw),
      /RESULT_QUALITY_BITMASK_ENABLED/
    )
  assert.equal(parseResultQualityConfig('', ' FALSE ').bitmaskEnabled, false)
})

test('bitmask validation rejects reserved check and human pairs without a catalog', () => {
  const { fitsMask, maskVerdict, binaryMask, oasiQuality } = modules()(
    '../features/qc/lib/bitmask.ts'
  )
  for (let checks = 0; checks <= 4; checks++) {
    for (let value = 0; value < 4096; value++) {
      const valid =
        value < 2 ** (2 * (checks + 2)) &&
        Array.from(
          { length: checks + 1 },
          (_, i) => (value >> (2 * (i + 1))) & 3
        ).every((pair) => pair !== 1)
      assert.equal(
        fitsMask(value, checks),
        valid,
        `${value} with ${checks} checks`
      )
    }
    for (const flag of catalog) {
      assert.equal(fitsMask(flag.code, checks), false)
      assert.equal(maskVerdict(flag.code, checks), 'unknown')
      assert.equal(binaryMask(flag.code, checks), '—')
      assert.equal(oasiQuality(flag.code, checks), null)
    }
  }
  assert.equal(fitsMask(130, 2), true)
  assert.equal(fitsMask(200, 2), true)
  assert.equal(maskVerdict(null, 2), 'none')
})

test('configured descriptions override bitmasks and depend only on the supplied languages', () => {
  const flags = [
    {
      code: 63,
      description: { en: 'Custom English', it: 'Italiano personalizzato' },
    },
  ]
  const load = modules({ RESULT_QUALITY_CODES: JSON.stringify(flags) })
  const { qualityFlagDescription } = load('../features/qc/lib/qualityFlags.ts')
  const { fitsMask } = load('../features/qc/lib/bitmask.ts')
  assert.equal(qualityFlagDescription(' 63 '), 'Custom English')
  assert.equal(
    qualityFlagDescription(63, () => 'it'),
    'Italiano personalizzato'
  )
  assert.equal(qualityFlagDescription(100), '')
  for (const raw of [null, undefined, true, {}, [], '', ' '])
    assert.equal(qualityFlagDescription(raw), '')
  assert.equal(fitsMask(63, 2), false)
})

test('disabling bitmask decoding preserves catalog descriptions and treats other values as unknown', () => {
  for (const flags of [[], catalog]) {
    const load = modules({
      RESULT_QUALITY_CODES: JSON.stringify(flags),
      RESULT_QUALITY_BITMASK_ENABLED: 'false',
    })
    const { fitsMask, maskVerdict, binaryMask, oasiQuality } = load(
      '../features/qc/lib/bitmask.ts'
    )
    const { qualityFlagDescription } = load(
      '../features/qc/lib/qualityFlags.ts'
    )
    for (const value of [0, 3, 15, 63, 130, 132, 200, 208, 255, 310, '63']) {
      assert.equal(fitsMask(value, 2), false)
      assert.equal(maskVerdict(value, 2), 'unknown')
      assert.equal(binaryMask(value, 2), '—')
      assert.equal(oasiQuality(value, 2), null)
    }
    assert.equal(
      qualityFlagDescription(132),
      flags.length ? 'Raw external source' : ''
    )
    assert.equal(maskVerdict(null, 2), 'none')
  }
})

test('runtime server configuration reaches the browser as escaped JSON without unrelated environment values', () => {
  const flags = [
    {
      code: 132,
      description: { en: '</script><img src=x>', it: 'Grezzo & esterno' },
    },
  ]
  const env = {
    RESULT_QUALITY_CODES: JSON.stringify(flags),
    RESULT_QUALITY_BITMASK_ENABLED: 'false',
    SECRET: 'not-public',
  }
  const server = modules(env)('resultQuality.ts')
  const json = server.resultQualityConfigJson()
  assert.doesNotMatch(json, /<|not-public/)
  const browser = modules(
    {},
    {
      getElementById(id) {
        assert.equal(id, server.RESULT_QUALITY_CONFIG_ID)
        return { textContent: json }
      },
    }
  )
  assert.equal(
    JSON.stringify(browser('resultQuality.ts').getResultQualityConfig()),
    JSON.stringify(server.getResultQualityConfig())
  )
  assert.equal(
    browser('../features/qc/lib/qualityFlags.ts').qualityFlagDescription(132),
    flags[0].description.en
  )
  assert.equal(browser('../features/qc/lib/bitmask.ts').fitsMask(63, 2), false)
})
