/* eslint-disable @typescript-eslint/no-require-imports -- Load the shared TypeScript helper with Node's test runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { test } = require('node:test')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  )
const {
  phenomenonTimeEnd,
  phenomenonTimeTimestamp,
} = require('./phenomenonTime.ts')

test('instant and aggregate observations resolve to their actual instant or interval end', () => {
  const end = '2026-11-03T14:40:00Z'
  for (const value of [
    end,
    `2026-11-03T14:30:00Z/${end}`,
    `2026-11-03T15:30:00+01:00/2026-11-03T15:40:00+01:00`,
  ])
    assert.equal(phenomenonTimeTimestamp(value), Date.parse(end))
  assert.equal(
    phenomenonTimeEnd(
      `2026-11-03T14:30:00.123456Z/2026-11-03T14:40:00.654321Z`
    ),
    '2026-11-03T14:40:00.654321Z'
  )
})

test('malformed, open and reversed intervals cannot become plotted observations', () => {
  for (const value of [
    null,
    undefined,
    '',
    'invalid',
    '/2026-11-03T14:40:00Z',
    '2026-11-03T14:30:00Z/',
    'invalid/2026-11-03T14:40:00Z',
    '2026-11-03T14:40:00Z/2026-11-03T14:30:00Z',
    '2026-11-03T14:30:00Z/2026-11-03T14:40:00Z/2026-11-03T15:00:00Z',
  ]) {
    assert.equal(phenomenonTimeEnd(value), null)
    assert.equal(phenomenonTimeTimestamp(value), null)
  }
})

test('zone-less UTC readings do not change position with the host timezone', () => {
  const previous = process.env.TZ
  try {
    for (const zone of ['Europe/Zurich', 'America/New_York']) {
      process.env.TZ = zone
      assert.equal(
        phenomenonTimeTimestamp('2026-11-03T14:30:00/2026-11-03T14:40:00'),
        Date.parse('2026-11-03T14:40:00Z')
      )
    }
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
