/* eslint-disable @typescript-eslint/no-require-imports -- Load the TypeScript helper without a bundler. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const loaded = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, 'timeAxisTicks.ts'), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }
  ).outputText,
  { module: loaded, exports: loaded.exports, Date, Math, Number }
)
const { calendarTicks, initialTimeRange } = loaded.exports
// Values built inside the vm carry its prototypes; copy them into this realm.
const plain = (value) => JSON.parse(JSON.stringify(value))

const HOUR = 3600000
const DAY = 24 * HOUR
const iso = (ms) => new Date(ms).toISOString()

test('a 7-day window gets one tick per local midnight, none skipped', () => {
  const start = Date.parse('2026-11-03T13:27:00Z')
  const end = start + 7 * DAY
  // UTC+01:00: local midnight is 23:00 UTC the day before.
  const ticks = calendarTicks(start, end, 60)
  assert.deepEqual(plain(ticks.map(iso)), [
    '2026-11-03T23:00:00.000Z',
    '2026-11-04T23:00:00.000Z',
    '2026-11-05T23:00:00.000Z',
    '2026-11-06T23:00:00.000Z',
    '2026-11-07T23:00:00.000Z',
    '2026-11-08T23:00:00.000Z',
    '2026-11-09T23:00:00.000Z',
  ])
})

test('a few hours get whole-hour ticks', () => {
  const start = Date.parse('2026-11-10T11:41:00Z')
  const ticks = calendarTicks(start, start + 4 * HOUR, 0)
  assert.deepEqual(plain(ticks.map(iso)), [
    '2026-11-10T12:00:00.000Z',
    '2026-11-10T13:00:00.000Z',
    '2026-11-10T14:00:00.000Z',
    '2026-11-10T15:00:00.000Z',
  ])
})

test('long ranges tick on month starts in the local offset', () => {
  const start = Date.parse('2026-01-15T00:00:00Z')
  const ticks = calendarTicks(start, Date.parse('2026-06-20T00:00:00Z'), 0)
  assert.deepEqual(plain(ticks.map(iso)), [
    '2026-02-01T00:00:00.000Z',
    '2026-03-01T00:00:00.000Z',
    '2026-04-01T00:00:00.000Z',
    '2026-05-01T00:00:00.000Z',
    '2026-06-01T00:00:00.000Z',
  ])
})

test('an empty or inverted range has no ticks', () => {
  assert.deepEqual(plain(calendarTicks(5, 5, 0)), [])
  assert.deepEqual(plain(calendarTicks(10, 5, 0)), [])
})

test('up to 7 days of readings set the axis to their own extent, unzoomed', () => {
  const windowStart = Date.parse('2026-11-03T13:27:00Z')
  const windowEnd = windowStart + 7 * DAY
  const first = Date.parse('2026-11-10T10:44:00Z')
  const last = first + 2 * HOUR
  assert.deepEqual(
    plain(initialTimeRange([last, first], windowStart, windowEnd)),
    { axisStart: first, axisEnd: last, zoom: null, fromData: true }
  )
  const lone = initialTimeRange([first], windowStart, windowEnd)
  assert.ok(lone.axisStart < first && lone.axisEnd > first)
})

test('more than a week keeps the window and opens on the last 7 days', () => {
  const last = Date.parse('2026-11-10T12:00:00Z')
  assert.deepEqual(
    plain(initialTimeRange([last - 30 * DAY, last], last - 31 * DAY, last)),
    {
      axisStart: last - 31 * DAY,
      axisEnd: last,
      zoom: { startValue: last - 7 * DAY, endValue: last },
      fromData: false,
    }
  )
  // Without a requested window the axis spans the readings.
  assert.deepEqual(plain(initialTimeRange([0, 10 * DAY], null, null)), {
    axisStart: 0,
    axisEnd: 10 * DAY,
    zoom: { startValue: 3 * DAY, endValue: 10 * DAY },
    fromData: false,
  })
})

test('no readings keep the requested window', () => {
  assert.deepEqual(plain(initialTimeRange([], 0, 7 * DAY)), {
    axisStart: 0,
    axisEnd: 7 * DAY,
    zoom: null,
    fromData: false,
  })
})
