/* eslint-disable @typescript-eslint/no-require-imports -- Node's test loader transpiles these isolated TypeScript modules without an extra test framework. */
const fs = require('node:fs')
const assert = require('node:assert/strict')
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
  maskVerdict,
  parseMask,
  slotState,
  fitsMask,
  oasiQuality,
  binaryMask,
  dataStatus,
  inspectQuality,
} = require('./bitmask.ts')
const {
  establishSchema,
  discardSchema,
  prepareSchemaRows,
} = require('./schema.ts')
const {
  editValue,
  editValues,
  emptyWorkspace,
  undo,
  redo,
  rowValue,
  reviewSlot,
  reviewHuman,
  reconcileRecipes,
  commitDrafts,
  changed,
} = require('./model.ts')
const { planEdits } = require('./operations.ts')
const { appendAudit } = require('./audit.ts')
const { selectionZoom } = require('./selectionZoom.ts')
const { explainCheck } = require('./qualityExplanation.ts')
const { reviewServiceQuality } = require('./model.ts')
const { QUALITY_FLAGS } = require('./qualityFlags.ts')
const { checkIssue, runnableSlots, unrunSlots } = require('./checks.ts')
const { qcCheckTargets } = require('./checkTargets.ts')
const { draftWorkbook } = require('./export.ts')
const {
  observationWorkbook,
  observationWorkbookFilename,
  observationExportTime,
  observationExportProblem,
} = require('./observationExport.ts')
const XLSX = require('xlsx')
const { qcWorkload } = require('./workload.ts')
const { QC_LIMITS } = require('./limits.ts')
const { canMeasurePageMemory, measurePageMemory } = require('./pageMemory.ts')
const checks = [
  { type: 'flagRange', min: 0, max: 10 },
  { type: 'flagConstants', window: '3min', thresh: 0 },
  { type: 'flagZScore', window: '6min', center: false },
]
function workspace() {
  const rows = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      String(i),
      {
        key: String(i),
        id: String(i),
        ts: i * 60000,
        time: new Date(i * 60000).toISOString(),
        result: 5,
        resultQuality: 255,
        scope: i < 5 ? 'window' : 'following',
      },
    ])
  )
  return { ...emptyWorkspace(), rows }
}
test('bitmask fixtures distinguish failures, partial checks, no data and reserved bits', () => {
  for (const [mask, verdict] of [
    [255, 'pass'],
    [251, 'failed'],
    [187, 'failed'],
    [63, 'partial'],
    [0, 'missing'],
    [null, 'none'],
    [257, 'unknown'],
    [252, 'missing'],
    [1023, 'accepted'],
  ])
    assert.equal(maskVerdict(mask, 3), verdict)
  assert.equal(parseMask({ quality: 100 }), null)
  assert.equal(parseMask(4096), null)
  assert.equal(fitsMask(1024, 3), false)
  assert.equal(parseMask('255'), 255)
})
test('value edits invalidate only their own range check and subsequent dependent windows', () => {
  const next = editValue(workspace(), '4', 100, checks, 'PT1M')
  assert.equal(next.drafts['4'].result, 100)
  assert.ok(next.drafts['4'].staleSlots.includes(1))
  assert.ok(next.drafts['5'].staleSlots.includes(3))
  assert.equal(slotState(next.drafts['5'].resultQuality, 1), 3)
  assert.equal(next.drafts['10'], undefined)
})
test('reverting overlapping edits keeps the other edit’s invalidation', () => {
  let ws = editValue(workspace(), '2', 100, checks, 'PT1M')
  ws = editValue(ws, '4', 100, checks, 'PT1M')
  ws = editValue(ws, '2', 5, checks, 'PT1M')
  assert.equal(ws.drafts['2'], undefined)
  assert.ok(ws.drafts['5'].staleSlots.includes(3))
  ws = editValue(ws, '4', 5, checks, 'PT1M')
  assert.equal(Object.keys(ws.drafts).length, 0)
})
test('undo and redo restore complete multirow changes', () => {
  const ws = editValue(workspace(), '4', 100, checks, 'PT1M')
  assert.equal(Object.keys(undo(ws).drafts).length, 0)
  assert.deepEqual(redo(undo(ws)).drafts, ws.drafts)
})
test('manual review changes one slot and preserves other failures/reserved bits', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 187 | (1 << 8)
  const next = reviewSlot(ws, '0', 1, 3, checks, checks)
  assert.equal(slotState(next.drafts['0'].resultQuality, 1), 3)
  assert.equal(slotState(next.drafts['0'].resultQuality, 3), 2)
  assert.equal(slotState(next.drafts['0'].resultQuality, 4), 1)
})
test('changing parameters after undo cannot restore a false passing verdict', () => {
  const ws = workspace()
  const modified = checks.map((check, i) =>
    i === 0 ? { ...check, max: 2 } : check
  )
  const next = reconcileRecipes(ws, modified, checks)
  assert.equal(slotState(next.drafts['0'].resultQuality, 1), 0)
  assert.ok(next.drafts['0'].staleSlots.includes(1))
})
test('data-state slot is preserved and missing edits are explicit mask zero', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 254
  const edited = editValue(ws, '0', 7, checks, 'PT1M')
  assert.equal(slotState(edited.drafts['0'].resultQuality, 0), 2)
  assert.equal(
    editValue(ws, '0', null, checks, 'PT1M').drafts['0'].resultQuality,
    0
  )
})
test('returning to a numeric-string original restores its exact stored type', () => {
  const ws = workspace()
  ws.rows['0'].result = '5.0'
  const edited = editValue(ws, '0', 100, checks, 'PT1M')
  const reverted = editValue(edited, '0', 5, checks, 'PT1M')
  assert.equal(rowValue(reverted.rows['0'], reverted.drafts).result, '5.0')
  assert.equal(Object.keys(reverted.drafts).length, 0)
})
test('structured quality survives numeric value edits without being flattened', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = { quality: 100, comment: 'legacy' }
  const next = editValue(ws, '0', 100, checks, 'PT1M')
  assert.deepEqual(next.drafts['0'].resultQuality, ws.rows['0'].resultQuality)
  assert.ok(next.drafts['0'].staleSlots.length)
})
test('unchanged mask strings and diagnostic outcomes survive a preview without becoming edits', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = '63'
  const next = commitDrafts(ws, {
    0: {
      result: 5,
      resultQuality: 63,
      staleSlots: [],
      outcomes: [{ slot: 3, state: 0, reason: 'Insufficient history' }],
    },
  })
  assert.equal(next.drafts['0'].resultQuality, '63')
  assert.equal(changed(next.rows['0'], next.drafts['0']), false)
  assert.equal(next.drafts['0'].outcomes[0].reason, 'Insufficient history')
})
test('an unrelated value edit preserves checks already resolved for a previous edit', () => {
  let ws = editValue(workspace(), '0', 100, checks, 'PT1M')
  ws = reviewSlot(ws, '0', 1, 2, checks, checks)
  ws = editValue(ws, '10', 100, checks, 'PT1M')
  assert.equal(slotState(ws.drafts['0'].resultQuality, 1), 2)
  assert.equal(ws.drafts['0'].staleSlots.includes(1), false)
  assert.equal(
    ws.drafts['0'].outcomes.find((outcome) => outcome.slot === 1).reason,
    'Manual review'
  )
})
test('restoring a missing draft preserves its original filled-data state', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 254
  const empty = editValue(ws, '0', null, checks, 'PT1M')
  const restored = editValue(empty, '0', 7, checks, 'PT1M')
  assert.equal(slotState(restored.drafts['0'].resultQuality, 0), 2)
})

test('a batch is one undo step and preserves overlapping invalidation when reverted', () => {
  const ws = workspace()
  const next = editValues(ws, { 2: 100, 4: 200 }, checks, 'PT1M')
  assert.equal(next.undo.length, 1)
  assert.ok(next.drafts['5'].staleSlots.includes(3))
  assert.deepEqual(undo(next).drafts, {})
  assert.deepEqual(redo(undo(next)).drafts, next.drafts)
  const reverted = editValues(next, { 2: 5, 4: 5 }, checks, 'PT1M')
  assert.equal(Object.keys(reverted.drafts).length, 0)
})

test('newly filled and interpolated values use slot 0 = 10, never a passing QC slot', () => {
  const ws = workspace()
  ws.rows['1'].result = null
  ws.rows['1'].resultQuality = 0
  const filled = editValues(ws, { 1: 6, 2: 7 }, checks, 'PT1M', checks, [
    '1',
    '2',
  ])
  for (const key of ['1', '2']) {
    assert.equal(slotState(filled.drafts[key].resultQuality, 0), 2)
    assert.equal(slotState(filled.drafts[key].resultQuality, 1), 0)
  }
  const manuallyEdited = editValue(filled, '2', 8, checks, 'PT1M')
  assert.equal(slotState(manuallyEdited.drafts['2'].resultQuality, 0), 2)
  const reverted = editValue(manuallyEdited, '2', 5, checks, 'PT1M')
  assert.equal(
    slotState(rowValue(reverted.rows['2'], reverted.drafts).resultQuality, 0),
    3
  )
})

function interpolationRows() {
  return [0, 1, 3, 4].map((minute, i) => ({
    key: String(i),
    id: String(i),
    ts: minute * 60000,
    time: new Date(minute * 60000).toISOString(),
    result: [0, null, -999, 20][i],
    resultQuality: i === 0 || i === 3 ? 255 : 0,
    scope: 'window',
  }))
}
const linearRequest = {
  operation: 'fill-linear',
  start: 0,
  end: 240000,
  maxGapMs: 240000,
  includeFailedAnchors: false,
  note: 'Repair outage',
}

test('linear gap filling uses elapsed timestamps, leaves valid values and records anchors', () => {
  const plan = planEdits(interpolationRows(), {}, linearRequest, 3)
  assert.deepEqual(plan.changes, { 1: 5, 2: 15 })
  assert.deepEqual(plan.filledKeys, ['1', '2'])
  assert.equal(plan.anchors.length, 2)
  assert.equal(plan.targets, 2)
})

test('gap limits apply to complete runs even when only part of the gap is selected', () => {
  const plan = planEdits(
    interpolationRows(),
    {},
    { ...linearRequest, start: 60000, end: 60000, maxGapMs: 180000 },
    3
  )
  assert.deepEqual(plan.changes, {})
  assert.equal(plan.skipped, 1)
  const constant = planEdits(
    interpolationRows(),
    {},
    {
      ...linearRequest,
      operation: 'fill-constant',
      value: 10,
      maxGapMs: 180000,
    },
    3
  )
  assert.deepEqual(constant.changes, {})
  assert.equal(constant.skipped, 2)
})

test('interpolation never extrapolates or silently uses failed anchors', () => {
  const rows = interpolationRows()
  rows[0].resultQuality = 251
  assert.deepEqual(planEdits(rows, {}, linearRequest, 3).changes, {})
  assert.deepEqual(
    planEdits(rows, {}, { ...linearRequest, includeFailedAnchors: true }, 3)
      .changes,
    { 1: 5, 2: 15 }
  )
  rows[0].result = null
  assert.deepEqual(
    planEdits(rows, {}, { ...linearRequest, includeFailedAnchors: true }, 3)
      .changes,
    {}
  )
})

test('interval replacement uses exterior anchors and never targets context observations', () => {
  const rows = interpolationRows()
  rows[0].scope = 'history'
  rows[3].scope = 'following'
  rows[1].result = 100
  rows[1].resultQuality = 255
  rows[2].result = 100
  rows[2].resultQuality = 255
  const plan = planEdits(
    rows,
    {},
    { ...linearRequest, operation: 'interpolate', start: 60000, end: 180000 },
    3
  )
  assert.deepEqual(plan.changes, { 1: 5, 2: 15 })
  assert.deepEqual(
    planEdits(rows, {}, { ...linearRequest, operation: 'interpolate' }, 3)
      .changes,
    {}
  )
  const constant = planEdits(
    rows,
    {},
    { ...linearRequest, operation: 'constant', value: 12.5 },
    3
  )
  assert.deepEqual(constant.changes, { 1: 12.5, 2: 12.5 })
  assert.deepEqual(
    planEdits(rows, {}, { ...linearRequest, operation: 'missing' }, 3).changes,
    { 1: null, 2: null }
  )
})

test('selected-point interpolation uses neighbours of the selection inside the loaded period', () => {
  const rows = interpolationRows()
  rows[1].result = rows[2].result = 100
  const plan = planEdits(
    rows,
    {},
    {
      ...linearRequest,
      operation: 'interpolate',
      keys: ['1', '2'],
    },
    3
  )
  assert.deepEqual(plan.changes, { 1: 5, 2: 15 })
  assert.deepEqual(
    plan.anchors.map((anchor) => anchor.key),
    ['0', '3']
  )
  assert.equal(plan.skipped, 0)
})

test('selected interpolation keeps unselected interior values intact and uses exterior anchors', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    ...interpolationRows()[0],
    key: String(index),
    id: String(index),
    ts: index * 60000,
    time: new Date(index * 60000).toISOString(),
    result: [0, 100, 999, 100, 40][index],
  }))
  const plan = planEdits(
    rows,
    {},
    {
      ...linearRequest,
      operation: 'interpolate',
      keys: ['1', '3'],
    },
    3
  )
  assert.deepEqual(plan.changes, { 1: 10, 3: 30 })
  assert.deepEqual(
    plan.anchors.map((anchor) => anchor.key),
    ['0', '4']
  )
})

test('interpolation distinguishes missing anchors from exceeding the full anchor span', () => {
  const rows = interpolationRows()
  const request = {
    ...linearRequest,
    operation: 'interpolate',
    keys: ['1', '2'],
    maxGapMs: 180000,
  }
  const tooWide = planEdits(rows, {}, request, 3)
  assert.deepEqual(tooWide.skippedRows, [
    { key: '1', reason: 'anchor_span', spanMs: 240000 },
    { key: '2', reason: 'anchor_span', spanMs: 240000 },
  ])
  const noAnchor = planEdits(rows.slice(1), {}, request, 3)
  assert.ok(noAnchor.skippedRows.every((row) => row.reason === 'anchors'))
  assert.equal(noAnchor.skippedRows.length, 2)
})

test('operations reject invalid intervals, non-finite numbers, no-data constants and invalid gap limits', () => {
  const rows = interpolationRows()
  for (const request of [
    { ...linearRequest, start: 500000 },
    { ...linearRequest, maxGapMs: 0 },
    { ...linearRequest, operation: 'constant', value: Infinity },
    { ...linearRequest, operation: 'constant', value: -999 },
  ])
    assert.throws(() => planEdits(rows, {}, request, 3))
})

test('gap filling after clearing values can use unchanged bounding values with dependent pending checks', () => {
  const ws = workspace()
  const cleared = editValues(ws, { 1: null, 2: null }, checks, 'PT1M')
  const plan = planEdits(
    Object.values(ws.rows),
    cleared.drafts,
    { ...linearRequest, start: 60000, end: 120000, maxGapMs: 180000 },
    3
  )
  assert.deepEqual(plan.changes, { 1: 5, 2: 5 })
  assert.deepEqual(
    plan.anchors.map((anchor) => anchor.key),
    ['0', '3']
  )
})

test('generated values remain marked filled even when interpolation happens to equal the original measurement', () => {
  const ws = workspace()
  const cleared = editValue(ws, '1', null, checks, 'PT1M')
  const filled = editValues(cleared, { 1: 5 }, checks, 'PT1M', checks, ['1'])
  assert.equal(filled.drafts['1'].filled, true)
  assert.equal(slotState(filled.drafts['1'].resultQuality, 0), 2)
  const later = editValue(filled, '10', 9, checks, 'PT1M')
  assert.equal(slotState(later.drafts['1'].resultQuality, 0), 2)
  assert.equal(changed(later.rows['1'], later.drafts['1']), true)
})

test('bulk invalidation handles the complete 20,000-observation editing limit', () => {
  const ws = emptyWorkspace()
  const changes = {}
  for (let i = 0; i < 20000; i++) {
    const key = String(i)
    ws.rows[key] = {
      key,
      id: key,
      ts: i * 60000,
      time: new Date(i * 60000).toISOString(),
      result: 5,
      resultQuality: 255,
      scope: 'window',
    }
    changes[key] = 6
  }
  const next = editValues(ws, changes, checks, 'PT1M')
  assert.equal(Object.keys(next.drafts).length, 20000)
  assert.equal(next.undo.length, 1)
  assert.equal(slotState(next.drafts['19999'].resultQuality, 1), 0)
})

const actor = {
  actor: 'test-editor',
  source: 'https://example.test/v1.1',
  datastream: '42',
}
test('audit remains append-only through undo, redo, discard and session serialization', () => {
  const initial = workspace()
  let ws = appendAudit(
    initial,
    editValues(initial, { 1: 10, 2: 20 }, checks, 'PT1M'),
    actor,
    'constant',
    { value: 10, note: 'Repair' }
  )
  const first = ws.audit[0]
  assert.equal(first.actor, actor.actor)
  assert.equal(
    first.changes.find((change) => change.key === '1').before.result,
    5
  )
  assert.equal(
    first.changes.find((change) => change.key === '1').after.result,
    10
  )
  ws = appendAudit(ws, undo(ws), actor, 'undo')
  ws = appendAudit(ws, redo(ws), actor, 'redo')
  ws = appendAudit(ws, { ...emptyWorkspace(), rows: ws.rows }, actor, 'discard')
  assert.deepEqual(
    ws.audit.map((entry) => entry.action),
    ['constant', 'undo', 'redo', 'discard']
  )
  assert.deepEqual(ws.audit[0], first)
  assert.equal(Object.keys(ws.drafts).length, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(ws)).audit, ws.audit)
})

test('audit snapshots cannot be mutated through later parameter edits and no-op edits add no event', () => {
  const ws = workspace()
  const parameters = { checks: [{ type: 'flagRange', max: 5 }] }
  const logged = appendAudit(ws, ws, actor, 'parameters', parameters, true)
  parameters.checks[0].max = 100
  assert.equal(logged.audit[0].parameters.checks[0].max, 5)
  assert.equal(appendAudit(logged, logged, actor, 'cell-edit').audit.length, 1)
})

test('audit-only exports preserve discarded history and split large parameters without losing information', () => {
  const ws = workspace()
  const text = 'x'.repeat(40000)
  const logged = appendAudit(ws, ws, actor, 'parameters', { text }, true)
  const book = draftWorkbook({ stream: logged })
  assert.ok(book.SheetNames.includes('Audit log'))
  const events = XLSX.utils.sheet_to_json(book.Sheets['Audit log'])
  assert.equal(events[0].actor, 'test-editor')
  const parts = XLSX.utils
    .sheet_to_json(book.Sheets['Audit parameters'])
    .filter((part) => part.parameter === 'text')
  assert.equal(parts.length, 2)
  assert.equal(JSON.parse(parts.map((part) => part.json).join('')), text)
})

test('quality decoding matches client human/OASI fixtures and preserves digital data', () => {
  for (const [mask, score] of [
    [3, 0],
    [171, 1],
    [239, 2],
    [255, 3],
    [767, 6],
    [939, 10],
    [15, 2],
    [1007, 10],
  ])
    assert.equal(oasiQuality(mask, 3), score, String(mask))
  assert.equal(oasiQuality(2, 0), null)
  assert.equal(oasiQuality(0, 0), null)
  assert.equal(dataStatus(1), 'digital')
  assert.equal(maskVerdict(253, 3), 'pass')
  assert.equal(maskVerdict(1007, 3), 'accepted')
  assert.equal(maskVerdict(751, 3), 'rejected')
  assert.equal(binaryMask(1007, 3), '11 11 10 11 11')
})

test('numeric compatibility alone remains an unconfirmed candidate, not an encoding decision', () => {
  const result = inspectQuality(
    [
      { resultQuality: 100 },
      { resultQuality: 'bad' },
      { resultQuality: { quality: 100 } },
    ],
    3
  )
  assert.deepEqual(result, { total: 3, candidate: 1, raw: 0, unknown: 2 })
  assert.equal(workspace().qualitySchema, undefined)
})

test('human review uses N+1, leaves automatic bits intact, and supports existing four-check masks', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 239
  let reviewed = reviewHuman(ws, ['0'], 3, checks)
  assert.equal(reviewed.drafts['0'].resultQuality, 1007)
  reviewed = reviewHuman(reviewed, ['0'], 2, checks)
  assert.equal(reviewed.drafts['0'].resultQuality, 751)
  reviewed = reviewHuman(reviewed, ['0'], 0, checks)
  assert.equal(rowValue(reviewed.rows['0'], reviewed.drafts).resultQuality, 239)
  ws.rows['0'].resultQuality = 1023
  const four = [...checks, { type: 'flagNAN' }]
  assert.equal(reviewHuman(ws, ['0'], 3, four).drafts['0'].resultQuality, 4095)
  assert.throws(() => reviewHuman(ws, ['0'], 1, four))
})

test('value corrections set data bits 10, clear human approval, and preserve review through Undo', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 1023
  const edited = editValue(ws, '0', 7, checks, 'PT1M')
  assert.equal(slotState(edited.drafts['0'].resultQuality, 0), 2)
  assert.equal(slotState(edited.drafts['0'].resultQuality, 4), 0)
  assert.equal(
    rowValue(undo(edited).rows['0'], undo(edited).drafts).resultQuality,
    1023
  )
  const approved = reviewHuman(edited, ['0'], 3, checks)
  assert.equal(slotState(approved.drafts['0'].resultQuality, 0), 2)
  assert.equal(slotState(approved.drafts['0'].resultQuality, 1), 0)
})

test('legacy conversion preserves originals, fixes recipe order, exports its schema and survives value Undo', () => {
  const initial = workspace()
  for (const row of Object.values(initial.rows))
    row.resultQuality = { quality: 100 }
  const schema = {
    mode: 'converted',
    constraints: [{ type: 'flagRange', min: 0, max: 10 }],
  }
  const converted = establishSchema(initial, schema)
  assert.deepEqual(converted.rows['0'].resultQuality, { quality: 100 })
  assert.equal(converted.drafts['0'].resultQuality, 3)
  assert.equal(converted.drafts['0'].converted, true)
  assert.equal(converted.rows['5'].draftBaseQuality, 3)
  const edited = editValue(
    converted,
    '0',
    20,
    schema.constraints,
    'PT1M',
    schema.constraints
  )
  assert.equal(undo(edited).drafts['0'].resultQuality, 3)
  assert.throws(() => establishSchema(converted, schema))
  assert.throws(() =>
    establishSchema(initial, {
      ...schema,
      constraints: checks.concat({ type: 'flagNAN' }),
    })
  )
  const logged = appendAudit(initial, converted, actor, 'conversion')
  assert.deepEqual(logged.audit[0].changes[0].before.resultQuality, {
    quality: 100,
  })
  assert.equal(logged.audit[0].changes[0].after.resultQuality, 3)
  const book = draftWorkbook({ stream: logged })
  const exported = XLSX.utils.sheet_to_json(book.Sheets.Datastream_1)
  assert.equal(exported[0].originalQuality, JSON.stringify({ quality: 100 }))
  assert.equal(exported[0].humanPair, 2)
  assert.deepEqual(JSON.parse(exported[0].orderedRecipe), schema.constraints)
  const discarded = discardSchema(logged)
  assert.equal(discarded.qualitySchema, undefined)
  assert.equal(discarded.rows['0'].draftBaseQuality, undefined)
  assert.equal(
    rowValue(discarded.rows['0'], discarded.drafts).resultQuality.quality,
    100
  )
  assert.equal(discarded.audit.length, 1)
})

test('unknown flags remain raw when choosing a stored layout or converting later ranges', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 'legacy'
  const existing = establishSchema(ws, {
    mode: 'existing',
    constraints: checks,
  })
  assert.equal(existing.rows['0'].resultQuality, 'legacy')
  assert.deepEqual(existing.drafts, {})
  assert.deepEqual(prepareSchemaRows(existing).rows, ws.rows)
  let converted = establishSchema(ws, { mode: 'converted', constraints: [] })
  converted.rows.new = {
    key: 'new',
    id: 'new',
    time: '2026-01-01T00:00:00Z',
    ts: 0,
    result: null,
    resultQuality: 'bad',
    scope: 'window',
  }
  converted = prepareSchemaRows(converted)
  assert.equal(converted.drafts.new.resultQuality, 0)
  const reviewed = reviewHuman(converted, ['1'], 3, [])
  assert.equal(reviewed.drafts['1'].resultQuality, 15)
})

test('confirming quality interpretation preserves earlier draft flags without migrating or rerunning them', () => {
  const ws = workspace()
  ws.rows['0'].resultQuality = 1023
  ws.drafts['0'] = { result: 100, resultQuality: 1023, staleSlots: [] }
  const confirmed = establishSchema(ws, {
    mode: 'existing',
    constraints: checks,
  })
  assert.deepEqual(confirmed.drafts, ws.drafts)
  assert.deepEqual(confirmed.rows, ws.rows)
  assert.deepEqual(confirmed.drafts['0'].staleSlots, [])
})

test('auditing conversion of a later range records the original legacy quality, not its draft baseline', () => {
  const initial = establishSchema(workspace(), {
    mode: 'converted',
    constraints: [],
  })
  const row = {
    key: 'later',
    id: 'later',
    ts: 999999,
    time: '2026-01-01T00:00:00Z',
    result: 5,
    resultQuality: { quality: 100 },
    scope: 'window',
  }
  const next = prepareSchemaRows({
    ...initial,
    rows: { ...initial.rows, later: row },
  })
  const audited = appendAudit(initial, next, actor, 'load-quality')
  const change = audited.audit
    .at(-1)
    .changes.find((change) => change.key === 'later')
  assert.deepEqual(change.before.resultQuality, { quality: 100 })
  assert.equal(change.after.resultQuality, 3)
})

test('promoting context to a converted target audits its source quality before the virtual baseline', () => {
  const ws = workspace()
  ws.rows['5'].resultQuality = { quality: 100 }
  const initial = establishSchema(ws, { mode: 'converted', constraints: [] })
  const next = prepareSchemaRows({
    ...initial,
    rows: { ...initial.rows, 5: { ...initial.rows['5'], scope: 'window' } },
  })
  const logged = appendAudit(initial, next, actor, 'load-quality')
  assert.deepEqual(
    logged.audit.at(-1).changes.find((change) => change.key === '5').before
      .resultQuality,
    { quality: 100 }
  )
})

const {
  UTC_OFFSETS,
  validUtcOffset,
  formatUtcOffset,
  toOffsetInput,
  fromOffsetInput,
  formatObservationTime,
  chartTimeLabel,
} = require('./timezone.ts')

test('fixed UTC offsets use numeric labels and include quarter/half-hour zones', () => {
  assert.equal(formatUtcOffset(60), '+01:00')
  assert.equal(formatUtcOffset(-30), '-00:30')
  assert.equal(formatUtcOffset(345), '+05:45')
  assert.ok(UTC_OFFSETS.includes(330))
  assert.ok(UTC_OFFSETS.includes(765))
  assert.equal(UTC_OFFSETS[0], -720)
  assert.equal(UTC_OFFSETS.at(-1), 840)
  assert.equal(validUtcOffset('Europe/Zurich'), false)
  assert.equal(validUtcOffset(61), false)
})

test('offset inputs preserve instants through date/year boundaries and fixed offsets have no DST changes', () => {
  const utc = '2026-12-31T23:30:12.345'
  for (const offset of [-720, -240, -30, 0, 60, 330, 345, 840]) {
    assert.equal(fromOffsetInput(toOffsetInput(utc, offset), offset), utc)
  }
  assert.equal(toOffsetInput(utc, 60), '2027-01-01T00:30:12.345')
  assert.equal(
    fromOffsetInput('2026-01-01T00:30', 345),
    '2025-12-31T18:45:00.000'
  )
  assert.equal(
    toOffsetInput('2026-07-01T12:00:00.000', 60),
    '2026-07-01T13:00:00.000'
  )
  assert.equal(
    toOffsetInput('2026-01-01T12:00:00.000', 60),
    '2026-01-01T13:00:00.000'
  )
  assert.equal(fromOffsetInput('', 60), '')
  assert.equal(toOffsetInput('invalid', 60), '')
})

test('table and graph times apply the chosen offset while preserving original timestamp precision', () => {
  const raw = '2026-10-20T23:45:00.123456Z'
  assert.equal(
    formatObservationTime(raw, 60),
    '2026-10-21T00:45:00.123456+01:00'
  )
  assert.equal(formatObservationTime(raw, 0), raw)
  assert.equal(
    formatObservationTime('2026-10-21T00:45:00+01:00', 0),
    '2026-10-20T23:45:00+00:00'
  )
  assert.equal(
    formatObservationTime('2026-01-01T00:00Z/2026-01-01T01:00Z', -240),
    '2025-12-31T20:00:00-04:00/2025-12-31T21:00:00-04:00'
  )
  assert.equal(chartTimeLabel(Date.parse(raw), 60, false), '00:45')
  assert.equal(chartTimeLabel(Date.parse(raw), 60, true), '2026-10-21 00:45')
})

function serviceWorkspace() {
  const initial = workspace()
  for (const row of Object.values(initial.rows)) row.resultQuality = 100
  return establishSchema(initial, { mode: 'service', constraints: [] })
}

test('confirming service-code mode preserves original values and never decodes catalog codes as masks', () => {
  const initial = serviceWorkspace()
  assert.equal(QUALITY_FLAGS.length, 13)
  assert.match(
    QUALITY_FLAGS.find((flag) => flag.code === 101).description,
    /pluviometri del 2025/
  )
  assert.deepEqual(initial.drafts, {})
  assert.equal(initial.rows['1'].resultQuality, 100)
  const next = editValue(initial, '1', 12, checks, 'PT1M')
  assert.equal(next.drafts['1'].resultQuality, null)
  assert.equal(next.drafts['1'].qualityPending, true)
  assert.deepEqual(next.drafts['1'].staleSlots, [])
  assert.equal(next.rows['1'].resultQuality, 100)
  assert.equal(Object.keys(next.drafts).length, 1)
})

test('service acceptance is explicit and a later correction clears it; undo restores the decision', () => {
  const initial = serviceWorkspace()
  const edited = editValue(initial, '1', 12, [])
  const accepted = reviewServiceQuality(edited, ['1'], 320)
  assert.equal(accepted.drafts['1'].resultQuality, 320)
  assert.equal(accepted.drafts['1'].qualityPending, false)
  const correctedAgain = editValue(accepted, '1', 13, [])
  assert.equal(correctedAgain.drafts['1'].resultQuality, null)
  assert.equal(correctedAgain.drafts['1'].qualityPending, true)
  assert.equal(undo(correctedAgain).drafts['1'].resultQuality, 320)
  assert.equal(redo(undo(correctedAgain)).drafts['1'].qualityPending, true)
})

test('service flags reject unknown codes and contradictory manual correction meanings atomically', () => {
  const initial = serviceWorkspace()
  const edited = editValue(initial, '1', 12, [])
  assert.throws(
    () => reviewServiceQuality(initial, ['1'], 320),
    /require a value correction/
  )
  assert.throws(
    () => reviewServiceQuality(edited, ['1'], 330),
    /unchanged values/
  )
  assert.throws(() => reviewServiceQuality(edited, ['1'], 110), /missing value/)
  assert.throws(
    () => reviewServiceQuality(edited, ['1'], 999),
    /supplied service catalog/
  )
  assert.throws(
    () => reviewServiceQuality(edited, ['1', '2'], 320),
    /require a value correction/
  )
  assert.equal(edited.drafts['1'].resultQuality, null)
  assert.equal(
    reviewServiceQuality(initial, ['1'], 330).drafts['1'].resultQuality,
    330
  )
  const missing = editValue(initial, '1', null, [])
  assert.equal(
    reviewServiceQuality(missing, ['1'], 110).drafts['1'].resultQuality,
    110
  )
})

test('selecting separated observations does not silently correct observations between them', () => {
  const initial = workspace()
  const plan = planEdits(
    Object.values(initial.rows),
    {},
    {
      operation: 'constant',
      start: 0,
      end: 240000,
      keys: ['0', '4'],
      value: 8,
      includeFailedAnchors: false,
      note: 'Maintenance',
    },
    checks.length
  )
  assert.deepEqual(plan.changes, { 0: 8, 4: 8 })
  assert.equal(plan.targets, 2)
  assert.equal(
    planEdits(
      Object.values(initial.rows),
      {},
      {
        operation: 'constant',
        start: 0,
        end: 240000,
        keys: [],
        value: 8,
        includeFailedAnchors: false,
        note: 'Maintenance',
      },
      checks.length
    ).targets,
    0
  )
})

test('offset corrections skip missing data and context, preserve selection scope and never create records', () => {
  const initial = workspace()
  initial.rows['1'].result = null
  initial.rows['2'].result = 999.9
  const request = {
    operation: 'offset',
    start: 0,
    end: 600000,
    value: -0.3,
    includeFailedAnchors: false,
    note: 'Calibration',
  }
  const plan = planEdits(
    Object.values(initial.rows),
    {},
    request,
    checks.length
  )
  assert.deepEqual(plan.changes, { 0: 4.7, 3: 4.7, 4: 4.7 })
  assert.equal(plan.skipped, 2)
  assert.deepEqual(
    plan.skippedRows.map((row) => row.reason),
    ['missing', 'missing']
  )
  assert.equal(plan.targets, 5)
  assert.deepEqual(
    planEdits(
      Object.values(initial.rows),
      {},
      { ...request, value: 0 },
      checks.length
    ).changes,
    {}
  )
  assert.throws(
    () =>
      planEdits(
        Object.values(initial.rows),
        {},
        { ...request, value: Infinity },
        checks.length
      ),
    /finite value/
  )
})

test('service interpolation uses accepted catalog anchors and never treats a numeric service code as a passing mask', () => {
  const initial = serviceWorkspace()
  initial.rows['1'].result = null
  const request = {
    operation: 'fill-linear',
    start: 60000,
    end: 60000,
    maxGapMs: 180000,
    includeFailedAnchors: false,
    note: 'Fill maintenance gap',
  }
  assert.equal(
    planEdits(Object.values(initial.rows), {}, request, 0, false).skipped,
    1
  )
  initial.rows['0'].resultQuality = 330
  initial.rows['2'].resultQuality = 330
  assert.deepEqual(
    planEdits(Object.values(initial.rows), {}, request, 0, false).changes,
    { 1: 5 }
  )
})

test('service exports preserve pending quality, original catalog codes and exact descriptions', () => {
  const initial = serviceWorkspace()
  const edited = appendAudit(
    initial,
    editValue(initial, '1', 12, []),
    actor,
    'cell-edit',
    { reason: 'Maintenance' }
  )
  assert.equal(edited.drafts['1'].qualityPending, true)
  const book = draftWorkbook({ stream: edited })
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Datastream_1)
  assert.equal(rows[0].qualityEncoding, 'service-quality-code')
  assert.equal(rows[0].originalQuality, 100)
  assert.equal(rows[0].qualityPending, true)
  assert.equal(rows[0].humanPair, '')
  assert.equal(
    XLSX.utils.sheet_to_json(book.Sheets['Service quality flags']).length,
    13
  )
})

test('confirmed bitmasks can start with absent quality and acquire corrected bits without becoming digital', () => {
  const initial = workspace()
  initial.rows['1'].resultQuality = null
  const confirmed = establishSchema(initial, {
    mode: 'existing',
    constraints: checks,
  })
  assert.equal(confirmed.rows['1'].resultQuality, null)
  const edited = editValue(confirmed, '1', 12, checks, 'PT1M')
  assert.equal(slotState(edited.drafts['1'].resultQuality, 0), 2)
})

test('unsupported stored definitions are excluded from reruns instead of being changed to compatible parameters', () => {
  const constraints = [
    { type: 'flagRange', min: 0, max: 10 },
    { type: 'customTest' },
    { type: 'flagZScore', window: '3h', center: true },
    { type: 'flagRange', min: 0, max: 10, customThreshold: 3 },
  ]
  const original = structuredClone(constraints)
  assert.deepEqual(runnableSlots(constraints), [1])
  assert.equal(
    checkIssue({ type: 'flagZScore', window: '3h', center: false }),
    null
  )
  assert.deepEqual(constraints, original)
})

test('not-run results stay outstanding even after an attempted check or human acceptance', () => {
  const draft = { result: 5, resultQuality: 939, staleSlots: [] }
  assert.deepEqual(
    unrunSlots({ ...draft, resultQuality: 3 | (3 << 8) }, 3),
    [1, 2, 3]
  )
  assert.deepEqual(unrunSlots({ ...draft, resultQuality: 255 }, 3), [])
  assert.deepEqual(
    unrunSlots({ ...draft, result: null, resultQuality: 0 }, 3),
    []
  )
  const initial = establishSchema(workspace(), {
    mode: 'existing',
    constraints: checks,
  })
  initial.drafts['1'] = { ...draft, resultQuality: 3 }
  const book = draftWorkbook({ stream: initial })
  assert.equal(
    XLSX.utils.sheet_to_json(book.Sheets.Datastream_1)[0].pendingChecks,
    '1,2,3'
  )
})

// Exercise the actual Next.js preview boundary with a mocked upstream service.
// No istSOS authentication, source data or external network is used by these tests.
function previewServer() {
  const Module = require('node:module')
  const path = require('node:path')
  const filename = path.resolve(__dirname, '../../../server/qcData.ts')
  const server = new Module(filename, module)
  server.require = (name) => {
    if (name === '@/features/qc/lib/bitmask') return require('./bitmask.ts')
    if (name === '@/features/qc/lib/checks') return require('./checks.ts')
    if (name === '@/features/qc/lib/limits') return require('./limits.ts')
    if (name === '@/features/qc/lib/storedBitmask')
      return require('./storedBitmask.ts')
    if (name === '@/server/qc')
      return { getSaqcServiceUrl: () => 'http://saqc.test' }
    if (name.startsWith('next/') || name === '@/server/data-sources/config')
      return {}
    return require(name)
  }
  server._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  )
  return server.exports
}

function upstreamFixture(context, constraints) {
  const requests = []
  context.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const address = String(url)
    requests.push({ url: address, options })
    if (address === 'http://saqc.test/preview')
      return Response.json({ results: [], warnings: [], engineVersion: 'test' })
    if (address.includes('/Datastreams(1)?'))
      return Response.json({ '@iot.id': 1, properties: { constraints } })
    const query = new URL(address).searchParams.get('$filter') ?? ''
    return Response.json({
      value: query.includes(' ge ')
        ? [
            {
              id: 1,
              phenomenonTime: '2026-10-26T00:00:00Z',
              result: 5,
              resultQuality: 15,
            },
          ]
        : [],
    })
  })
  return requests
}

const previewRequest = {
  datastreamId: '1',
  start: '2026-10-26T00:00:00Z',
  end: '2026-10-26T01:00:00Z',
  qualityMode: 'existing',
  slots: [1],
  edits: [],
  scope: 'selected',
  targetKeys: ['1@2026-10-26T00:00:00Z'],
}

test('check scopes keep an empty selection empty and make all-loaded explicit', () => {
  const ws = workspace()
  const rows = Object.values(ws.rows)
  ws.drafts['2'] = { result: 5, resultQuality: 3, staleSlots: [1, 2, 3] }
  const targets = (scope, selected) =>
    qcCheckTargets(scope, rows, selected, ws.drafts, 3, [1])
  assert.deepEqual(targets('selected', []), [])
  assert.deepEqual(targets('selected', ['4', '1', '1', '9', 'missing']), [
    '1',
    '4',
  ])
  assert.deepEqual(targets('all', ['1']), ['0', '1', '2', '3', '4'])
  assert.deepEqual(targets('affected', ['1']), ['2'])
})

test('preview API rejects an empty or invalid selection without calling the QC service', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  const requests = upstreamFixture(context, constraints)
  const { runQcPreview } = previewServer()
  for (const targetKeys of [
    undefined,
    null,
    [],
    [1],
    ['unknown-observation'],
  ]) {
    await assert.rejects(
      () =>
        runQcPreview(
          { apiRoot: 'https://istsos.test/v1.1' },
          {},
          { ...previewRequest, constraints, targetKeys }
        ),
      /Select observations|outside the loaded scope/
    )
  }
  assert.ok(
    requests.every((request) => request.url !== 'http://saqc.test/preview')
  )
})

test('preview API sends explicit scope and allows dependency expansion only for affected rechecks', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  const requests = upstreamFixture(context, constraints)
  const { runQcPreview } = previewServer()
  for (const scope of ['selected', 'all', 'affected']) {
    await runQcPreview(
      { apiRoot: 'https://istsos.test/v1.1' },
      {},
      {
        ...previewRequest,
        constraints,
        scope,
        targetKeys: previewRequest.targetKeys,
      }
    )
    const execution = JSON.parse(requests.at(-1).options.body)
    assert.equal(execution.repairUnknownQuality, true)
    assert.deepEqual(execution.targetKeys, previewRequest.targetKeys)
    assert.equal(execution.includeAffected, scope === 'affected')
  }
})

test('all-observations previews report service connection failures clearly', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  upstreamFixture(context, constraints)
  const upstream = globalThis.fetch
  let serviceError = new TypeError('fetch failed')
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url) === 'http://saqc.test/preview') throw serviceError
    return upstream(url, options)
  })
  const { runQcPreview, QcError } = previewServer()
  const run = () =>
    runQcPreview(
      { apiRoot: 'https://istsos.test/v1.1' },
      {},
      { ...previewRequest, constraints, scope: 'all' }
    )
  await assert.rejects(
    run,
    (error) =>
      error instanceof QcError &&
      error.status === 503 &&
      /SaQC service could not be reached/.test(error.message)
  )
  serviceError = new DOMException('The operation timed out', 'TimeoutError')
  await assert.rejects(
    run,
    (error) =>
      error instanceof QcError &&
      error.status === 504 &&
      /SaQC checks timed out/.test(error.message)
  )
})

test('preview API never exposes out-of-scope flags from an older service', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  const fixture = upstreamFixture(context, constraints)
  const upstream = global.fetch
  context.mock.method(globalThis, 'fetch', async (url, options) =>
    String(url) === 'http://saqc.test/preview'
      ? Response.json({
          results: [
            { key: previewRequest.targetKeys[0], resultQuality: 15 },
            { key: 'unselected', resultQuality: 11 },
          ],
          warnings: [],
          engineVersion: 'test',
        })
      : upstream(url, options)
  )
  const { runQcPreview } = previewServer()
  const result = await runQcPreview(
    { apiRoot: 'https://istsos.test/v1.1' },
    {},
    {
      ...previewRequest,
      constraints,
    }
  )
  assert.deepEqual(
    result.results.map((row) => row.key),
    previewRequest.targetKeys
  )
  assert.ok(fixture.length)
})

test('preview API rejects changed thresholds, test order and conversion before calling the QC engine', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  const requests = upstreamFixture(context, constraints)
  const { runQcPreview } = previewServer()
  const source = { apiRoot: 'https://istsos.test/v1.1' }
  await assert.rejects(
    () =>
      runQcPreview(
        source,
        {},
        { ...previewRequest, constraints: [{ ...constraints[0], max: 50 }] }
      ),
    /parameters must match/
  )
  await assert.rejects(
    () =>
      runQcPreview(
        source,
        {},
        { ...previewRequest, constraints: [{ type: 'flagNAN' }] }
      ),
    /parameters must match/
  )
  await assert.rejects(
    () =>
      runQcPreview(
        source,
        {},
        { ...previewRequest, constraints, qualityMode: 'converted' }
      ),
    /Only confirmed bitmasks/
  )
  assert.ok(
    requests.every((request) => request.url !== 'http://saqc.test/preview')
  )
  assert.ok(
    requests.every(
      (request) => !request.options.method || request.options.method === 'GET'
    )
  )
})

test('preview API accepts the exact stored definition without editing parameters or writing observations', async (context) => {
  const constraints = [{ type: 'flagRange', min: 0, max: 10 }]
  const requests = upstreamFixture(context, constraints)
  const { runQcPreview } = previewServer()
  await runQcPreview(
    { apiRoot: 'https://istsos.test/v1.1' },
    {},
    { ...previewRequest, constraints }
  )
  const execution = requests.find(
    (request) => request.url === 'http://saqc.test/preview'
  )
  assert.ok(execution)
  assert.deepEqual(JSON.parse(execution.options.body).constraints, constraints)
  assert.ok(
    requests
      .filter((request) => request.url.startsWith('https://istsos.test'))
      .every(
        (request) => !request.options.method || request.options.method === 'GET'
      )
  )
})

test('confirmation and reload preserve original quality exactly, including numeric strings and absent quality', () => {
  const initial = workspace()
  initial.rows['0'].resultQuality = '255'
  initial.rows['1'].resultQuality = null
  initial.rows['2'].resultQuality = 0
  const before = structuredClone(initial)
  const confirmed = establishSchema(initial, {
    mode: 'existing',
    constraints: checks,
  })
  assert.deepEqual(confirmed.rows, before.rows)
  assert.deepEqual(confirmed.drafts, {})
  assert.equal(
    rowValue(confirmed.rows['0'], confirmed.drafts).resultQuality,
    '255'
  )
  assert.equal(
    rowValue(confirmed.rows['1'], confirmed.drafts).resultQuality,
    null
  )
  assert.equal(confirmed.rows['1'].draftBaseQuality, undefined)
  assert.deepEqual(prepareSchemaRows(confirmed).rows, before.rows)
  assert.ok(
    Object.values(confirmed.rows).every(
      (row) => !changed(row, rowValue(row, confirmed.drafts))
    )
  )
  const oldCache = {
    ...confirmed,
    rows: {
      ...confirmed.rows,
      1: { ...confirmed.rows['1'], draftBaseQuality: 3 },
    },
  }
  const restored = prepareSchemaRows(oldCache)
  assert.equal(
    rowValue(restored.rows['1'], restored.drafts).resultQuality,
    null
  )
})

test('quality explanations distinguish stored flags, explicit reruns and invalidated results without guessing reasons', () => {
  const constraints = checks.slice(0, 2)
  const row = { ...workspace().rows['0'], resultQuality: 15 }
  assert.deepEqual(explainCheck(row, undefined, constraints, 2, true), {
    status: 'not_run',
    source: 'recorded',
    reason: null,
  })
  const rerun = {
    result: row.result,
    resultQuality: 15,
    staleSlots: [],
    outcomes: [{ slot: 2, state: 0, reason: 'Insufficient history' }],
  }
  assert.deepEqual(explainCheck(row, rerun, constraints, 2, true), {
    status: 'not_run',
    source: 'run',
    reason: 'Insufficient history',
  })
  assert.deepEqual(
    explainCheck(row, { ...rerun, staleSlots: [2] }, constraints, 2, true),
    { status: 'stale', source: 'pending', reason: null }
  )
  assert.deepEqual(explainCheck(row, undefined, constraints, 2, false), {
    status: 'unknown',
    source: 'unconfirmed',
    reason: null,
  })
})

test('a human decision does not relabel unchanged automatic outcomes as a new check run', () => {
  const constraints = checks.slice(0, 2)
  const row = { ...workspace().rows['0'], resultQuality: 63 }
  const reviewed = { result: row.result, resultQuality: 255, staleSlots: [] }
  assert.deepEqual(explainCheck(row, reviewed, constraints, 2, true), {
    status: 'passed',
    source: 'recorded',
    reason: null,
  })
})

test('selection zoom starts with the full series and focuses single and multiple observations with context', () => {
  const rows = Object.values(workspace().rows)
  const before = structuredClone(rows)
  assert.equal(selectionZoom(rows, []), null)
  assert.equal(selectionZoom(rows, ['not-present']), null)
  assert.equal(
    selectionZoom(
      rows,
      rows.map((row) => row.key)
    ),
    null
  )
  assert.deepEqual(selectionZoom(rows, ['4']), {
    startValue: 120000,
    endValue: 360000,
  })
  assert.deepEqual(selectionZoom(rows, ['0']), {
    startValue: 0,
    endValue: 120000,
  })
  assert.deepEqual(selectionZoom(rows, ['4', '1']), {
    startValue: 0,
    endValue: 300000,
  })
  assert.deepEqual(rows, before)
})

test('selection zoom never collapses to an empty time range for single-point or duplicate-time series', () => {
  const row = workspace().rows['0']
  assert.equal(selectionZoom([row], [row.key]), null)
  assert.equal(selectionZoom([row, { ...row, key: 'other' }], [row.key]), null)
})

test('absent quality stays absent until an explicit human decision initializes its bitmask', () => {
  const initial = emptyWorkspace()
  initial.rows['0'] = { ...workspace().rows['0'], resultQuality: null }
  const confirmed = establishSchema(initial, {
    mode: 'existing',
    constraints: [],
  })
  assert.equal(
    rowValue(confirmed.rows['0'], confirmed.drafts).resultQuality,
    null
  )
  const reviewed = reviewHuman(confirmed, ['0'], 3, [])
  assert.equal(reviewed.rows['0'].resultQuality, null)
  assert.equal(reviewed.drafts['0'].resultQuality, 15)
})

const observationOptions = {
  scope: 'loaded',
  utcOffset: 60,
  versioningEnabled: true,
}
function exportWorkspace(name = 'Ta_LUMI') {
  return {
    ...workspace(),
    datastream: { id: '6', name, thing: 'LUMI' },
    sourceEndpoint: 'https://example.test/v1.1',
    commitMessage: 'Reviewed maintenance corrections',
    qualitySchema: { mode: 'existing', constraints: checks },
  }
}

test('observation workbook matches the example columns and named sheets while retaining value types', () => {
  const ws = exportWorkspace()
  ws.rows['0'].resultQuality = '207'
  ws.rows['1'].resultQuality = { quality: 210, note: 'source detail' }
  const before = structuredClone(ws)
  const book = observationWorkbook({ stream: ws }, observationOptions)
  assert.deepEqual(book.SheetNames, ['Ta_LUMI'])
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Ta_LUMI, { header: 1 })
  assert.deepEqual(rows[0], [
    'time',
    'result',
    'resultQuality',
    'commitMessage',
  ])
  assert.equal(rows.length, 6)
  assert.equal(rows[1][0], '1970-01-01T01:00:00.000+0100')
  assert.equal(rows[1][1], 5)
  assert.equal(rows[1][2], '207')
  assert.equal(rows[2][2], JSON.stringify(ws.rows['1'].resultQuality))
  assert.ok(rows.slice(1).every((row) => row[3] === ws.commitMessage))
  assert.deepEqual(ws, before)
  const roundTrip = XLSX.read(
    XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }),
    { type: 'buffer' }
  )
  assert.deepEqual(
    XLSX.utils.sheet_to_json(roundTrip.Sheets.Ta_LUMI, { header: 1 }),
    rows
  )
})

test('compact export requires a planned message only when versioning is enabled and rejects unusable message formats', () => {
  const ws = { ...exportWorkspace(), commitMessage: '   ' }
  assert.equal(
    observationExportProblem({ stream: ws }, observationOptions),
    'message'
  )
  assert.throws(
    () => observationWorkbook({ stream: ws }, observationOptions),
    /commit message is required/
  )
  const disabled = observationWorkbook(
    { stream: ws },
    { ...observationOptions, versioningEnabled: false }
  )
  assert.equal(
    XLSX.utils.sheet_to_json(disabled.Sheets.Ta_LUMI)[0].commitMessage,
    ''
  )
  assert.equal(
    observationExportProblem(
      { stream: { ...ws, commitMessage: 'first\nsecond' } },
      observationOptions
    ),
    'message_format'
  )
  assert.equal(
    observationExportProblem(
      { stream: { ...ws, commitMessage: 'x'.repeat(32768) } },
      observationOptions
    ),
    'message_format'
  )
})

test('loaded export excludes context while changed export retains affected and earlier draft observations', () => {
  let ws = exportWorkspace()
  ws.rows['7'].scope = 'history'
  ws = commitDrafts(ws, {
    1: { result: 7, resultQuality: 254, staleSlots: [] },
    7: { result: 5, resultQuality: 191, staleSlots: [] },
  })
  const all = XLSX.utils.sheet_to_json(
    observationWorkbook({ stream: ws }, observationOptions).Sheets.Ta_LUMI
  )
  assert.equal(all.length, 5)
  assert.equal(all[1].result, 7)
  const changedBook = observationWorkbook(
    { stream: ws },
    { ...observationOptions, scope: 'changed' }
  )
  const changedRows = XLSX.utils.sheet_to_json(changedBook.Sheets.Ta_LUMI)
  assert.equal(changedRows.length, 2)
  assert.equal(changedRows[1].resultQuality, 191)
})

test('compact export retains original Not run flags but unfinished draft decisions stay in detailed backups', () => {
  const ws = exportWorkspace()
  ws.rows['0'].resultQuality = 207
  assert.ok(observationWorkbook({ stream: ws }, observationOptions))
  ws.drafts['1'] = { result: 7, resultQuality: 2, staleSlots: [2] }
  assert.throws(
    () => observationWorkbook({ stream: ws }, observationOptions),
    /pending checks/
  )
  assert.ok(draftWorkbook({ stream: ws }))
  ws.drafts['1'] = {
    result: 7,
    resultQuality: null,
    staleSlots: [],
    qualityPending: true,
  }
  assert.equal(
    observationExportProblem({ stream: ws }, observationOptions),
    'pending'
  )
})

test('multiple datastreams from one station retain their own messages and other sources or stations are separated', () => {
  const temperature = exportWorkspace()
  const humidity = {
    ...exportWorkspace('RH_LUMI'),
    commitMessage: 'Humidity reviewed',
  }
  const book = observationWorkbook(
    { t: temperature, h: humidity },
    observationOptions
  )
  assert.deepEqual(book.SheetNames, ['Ta_LUMI', 'RH_LUMI'])
  assert.equal(
    XLSX.utils.sheet_to_json(book.Sheets.RH_LUMI)[0].commitMessage,
    'Humidity reviewed'
  )
  assert.throws(
    () =>
      observationWorkbook(
        { t: temperature, h: { ...humidity, commitMessage: '' } },
        observationOptions
      ),
    /commit message is required/
  )
  assert.throws(
    () =>
      observationWorkbook(
        {
          t: temperature,
          h: { ...humidity, sourceEndpoint: 'https://other.test/v1.1' },
        },
        observationOptions
      ),
    /one station from one source/
  )
})

test('workbook names retain the station and upper-bound timestamp convention, including sub-millisecond precision', () => {
  const ws = exportWorkspace()
  assert.equal(
    observationWorkbookFilename({ stream: ws }, observationOptions),
    'LUMI_19700101010400+0100.xlsx'
  )
  ws.rows['4'].time = '2026-12-31T23:59:59.999999Z'
  assert.equal(
    observationWorkbookFilename({ stream: ws }, observationOptions),
    'LUMI_20270101010000+0100.xlsx'
  )
  ws.rows['4'].time = '2026-12-31T23:59:59.000001Z'
  assert.equal(
    observationWorkbookFilename({ stream: ws }, observationOptions),
    'LUMI_20270101010000+0100.xlsx'
  )
  assert.equal(
    observationExportTime('2026-10-20T23:45:00.123456Z', 345),
    '2026-10-21T05:30:00.123456+0545'
  )
  assert.equal(
    observationExportTime('2026-10-20T23:45:00Z', 0),
    '2026-10-20T23:45:00+0000'
  )
})

test('Excel sheet aliases are valid, unique and limited to 31 characters', () => {
  const cache = Object.fromEntries(
    ['a/b', 'a:b', 'A_B', 'x'.repeat(50)].map((name, index) => [
      index,
      exportWorkspace(name),
    ])
  )
  const book = observationWorkbook(cache, observationOptions)
  assert.deepEqual(book.SheetNames.slice(0, 3), ['a_b', 'a_b_2', 'A_B_3'])
  assert.ok(book.SheetNames.every((name) => name.length <= 31))
})

test('commit messages and export names appear in the current session’s detailed export', () => {
  const initial = exportWorkspace()
  const logged = appendAudit(initial, initial, actor, 'encoding', {}, true)
  assert.equal(logged.commitMessage, initial.commitMessage)
  assert.equal(logged.datastream.name, 'Ta_LUMI')
  const book = draftWorkbook({ stream: logged })
  assert.equal(
    XLSX.utils.sheet_to_json(book.Sheets['Export metadata'])[0].commitMessage,
    initial.commitMessage
  )
  assert.equal(discardSchema(logged).commitMessage, '')
})

test('workload counts selection plus invalidated dependent context and bounds buffer work by available history', () => {
  const ws = workspace()
  ws.qualitySchema = { mode: 'existing', constraints: checks }
  const stream = {
    id: '1',
    name: 'Test',
    thing: 'Station',
    unit: 'C',
    constraints: checks,
  }
  const loaded = {
    datastream: stream,
    rows: Object.values(ws.rows),
    bufferSize: 4,
  }
  const args = {
    loaded,
    stream,
    workspace: ws,
    selected: [],
    slots: [1, 2],
    start: '',
    end: '',
  }
  const initial = qcWorkload(args)
  assert.equal(initial.period, 5)
  assert.equal(initial.context, 7)
  assert.equal(initial.targets, 5)
  assert.equal(initial.bufferValues, 28)
  assert.equal(initial.modified, 0)
  assert.equal(initial.status, 'normal')
  ws.drafts['6'] = { result: 5, resultQuality: 255, staleSlots: [2] }
  const next = qcWorkload({ ...args, selected: ['1', 'missing'] })
  assert.equal(next.targets, 2)
  assert.equal(next.bufferValues, 12)
  assert.equal(next.modified, 1)
  assert.equal(next.context, 7)
})

test('workload excludes duplicate, unsupported and unconfirmed checks and keeps service codes separate', () => {
  const ws = workspace()
  const constraints = [
    { type: 'flagRange', min: 0, max: 5 },
    { type: 'unknown' },
  ]
  const stream = {
    id: '1',
    name: 'Test',
    thing: 'Station',
    unit: 'C',
    constraints,
  }
  const loaded = {
    datastream: stream,
    rows: Object.values(ws.rows),
    bufferSize: 4,
  }
  const args = {
    loaded,
    stream,
    workspace: ws,
    selected: [],
    slots: [1, 1, 2, 99, -1],
    start: '',
    end: '',
  }
  assert.equal(qcWorkload(args).checks, 0)
  ws.qualitySchema = { mode: 'existing', constraints }
  assert.equal(qcWorkload(args).checks, 1)
  assert.equal(qcWorkload(args).bufferValues, 14)
  ws.qualitySchema = { mode: 'service', constraints: [] }
  assert.equal(qcWorkload(args).checks, 0)
  assert.equal(qcWorkload(args).targets, 0)
  assert.equal(qcWorkload(args).bufferValues, 0)
})

function resourceFixture(length, buffer = 1, constraints = []) {
  const rows = Array.from({ length }, (_, i) => ({
    key: String(i),
    id: String(i),
    ts: i * 1000,
    time: new Date(i * 1000).toISOString(),
    result: 5,
    resultQuality: 3,
    scope: 'window',
  }))
  const stream = {
    id: '1',
    name: 'Test',
    thing: 'Station',
    unit: 'C',
    constraints,
  }
  const ws = {
    ...emptyWorkspace(),
    qualitySchema: { mode: 'existing', constraints },
  }
  return {
    loaded: { datastream: stream, rows, bufferSize: buffer },
    stream,
    workspace: ws,
    selected: [],
    slots: constraints.map((_, i) => i + 1),
    start: '',
    end: '',
  }
}

test('workload uses exact configured limits and does not call an estimate a limit breach', () => {
  const args = resourceFixture(QC_LIMITS.observations)
  assert.deepEqual(qcWorkload(args).limits, [])
  const over = resourceFixture(QC_LIMITS.observations + 1)
  assert.deepEqual(qcWorkload(over).limits, ['observations', 'targets'])
  assert.equal(qcWorkload(over).status, 'limit')
  const context = resourceFixture(1, QC_LIMITS.contextBuffer + 1)
  assert.deepEqual(qcWorkload(context).limits, ['contextBuffer'])
  const total = resourceFixture(QC_LIMITS.previewRows + 1)
  total.loaded.rows.forEach((row) => {
    row.scope = 'history'
  })
  assert.deepEqual(qcWorkload(total).limits, ['previewRows'])
  const preflight = {
    ...args,
    loaded: null,
    stream: { ...args.stream, samplingFrequency: 'PT1S' },
    start: '2026-01-01T00:00:00',
    end: '2026-01-02T00:00:00',
  }
  const estimated = qcWorkload(preflight)
  assert.equal(estimated.expected, 86401)
  assert.equal(estimated.status, 'heavy')
  assert.deepEqual(estimated.limits, [])
  assert.equal(qcWorkload({ ...preflight, end: 'invalid' }).expected, null)
  assert.equal(qcWorkload({ ...preflight, stream: args.stream }).expected, null)
})

test('heavy workload is based on the engine batch budget and falls when the target selection shrinks', () => {
  const args = resourceFixture(2000, 2000, [
    { type: 'flagRange', min: 0, max: 10 },
  ])
  assert.equal(qcWorkload(args).bufferValues, 2001000)
  assert.ok(qcWorkload(args).bufferValues > QC_LIMITS.batchValues)
  assert.equal(qcWorkload(args).status, 'heavy')
  const selected = qcWorkload({ ...args, selected: ['1999'] })
  assert.equal(selected.bufferValues, 2000)
  assert.equal(selected.status, 'normal')
  const none = qcWorkload({ ...args, slots: [] })
  assert.equal(none.checks, 0)
  assert.equal(none.bufferValues, 0)
})

test('memory measurement requires the supported isolated-page API, never legacy heap or device capacity', async () => {
  let calls = 0
  const api = {
    async measureUserAgentSpecificMemory() {
      calls++
      return { bytes: 67108864 }
    },
  }
  assert.equal(canMeasurePageMemory(api, true), true)
  assert.equal(canMeasurePageMemory(api, false), false)
  assert.equal(
    canMeasurePageMemory(
      { memory: { usedJSHeapSize: 123, jsHeapSizeLimit: 999 } },
      true
    ),
    false
  )
  await assert.rejects(measurePageMemory(api, false), /unavailable/)
  assert.equal(calls, 0)
  const result = await measurePageMemory(api, true)
  assert.equal(result.bytes, 67108864)
  assert.ok(Number.isFinite(result.time))
  assert.equal(calls, 1)
})

test('memory measurement reports failed or invalid readings without fabricating a value', async () => {
  for (const bytes of [-1, NaN, Infinity, undefined]) {
    await assert.rejects(
      measurePageMemory(
        {
          async measureUserAgentSpecificMemory() {
            return { bytes }
          },
        },
        true
      ),
      /Invalid/
    )
  }
  await assert.rejects(
    measurePageMemory(
      {
        async measureUserAgentSpecificMemory() {
          throw new DOMException('Denied', 'SecurityError')
        },
      },
      true
    ),
    { name: 'SecurityError' }
  )
  assert.equal(
    (
      await measurePageMemory(
        {
          async measureUserAgentSpecificMemory() {
            return { bytes: 0 }
          },
        },
        true
      )
    ).bytes,
    0
  )
})

const {
  hasStoredConstraints,
  configureStoredBitmask,
  storedBitmaskIssue,
} = require('./storedBitmask.ts')

test('datastream discovery includes only non-empty valid stored constraint lists', () => {
  const { qcDatastreamsWithConstraints } = previewServer()
  const definitions = [
    undefined,
    null,
    [],
    '[]',
    '{broken',
    {},
    [null],
    [{}],
    [{ type: ' ' }],
    checks,
    JSON.stringify(checks),
    [{ type: 'futureCheck' }],
  ]
  const streams = definitions.map((constraints, id) => ({
    '@iot.id': id,
    properties: { constraints },
  }))
  assert.deepEqual(
    qcDatastreamsWithConstraints(streams).map((ds) => ds.id),
    ['9', '10', '11']
  )
  assert.equal(hasStoredConstraints({ constraints: [] }), false)
})

test('loading a datastream without configured checks fails before reading any observations', async (context) => {
  const requests = upstreamFixture(context, [])
  const { loadQcData } = previewServer()
  await assert.rejects(
    () =>
      loadQcData({ apiRoot: 'https://istsos.test/v1.1' }, {}, previewRequest),
    /configured quality constraints/
  )
  assert.equal(requests.length, 1)
  assert.ok(requests[0].url.includes('/Datastreams(1)?'))
})

test('automatic bitmask interpretation preserves original values and flags without drafts or audit events', () => {
  const initial = workspace()
  initial.rows['0'].resultQuality = '255'
  initial.rows['1'].resultQuality = null
  initial.rows['2'].resultQuality = 0
  delete initial.rows['3'].resultQuality
  const original = structuredClone(initial)
  const next = configureStoredBitmask(initial, {
    constraints: checks,
    qualityEncoding: 'service-quality-code',
  })
  assert.deepEqual(next.rows, original.rows)
  assert.deepEqual(next.drafts, {})
  assert.deepEqual(next.undo, [])
  assert.deepEqual(next.audit, original.audit)
  assert.equal(next.qualitySchema.mode, 'existing')
  assert.deepEqual(next.qualitySchema.constraints, checks)
  assert.equal(Object.keys(next.drafts).length, 0)
  next.qualitySchema.constraints[0].max = 999
  assert.equal(checks[0].max, 10)
})

test('unknown quality can be recalculated without rewriting original flags on load', () => {
  const initial = workspace()
  initial.rows['0'].resultQuality = 'not a mask'
  const before = structuredClone(initial)
  assert.equal(
    storedBitmaskIssue({ constraints: checks }, Object.values(initial.rows)),
    'invalid_quality'
  )
  const next = configureStoredBitmask(initial, { constraints: checks })
  assert.equal(next.qualitySchema.mode, 'existing')
  assert.deepEqual(next.rows, before.rows)
  assert.deepEqual(next.drafts, {})
  assert.equal(
    storedBitmaskIssue({ constraints: [...checks, ...checks] }, []),
    'too_many_checks'
  )
  assert.equal(
    configureStoredBitmask(initial, { constraints: [...checks, ...checks] })
      .qualitySchema,
    undefined
  )
  initial.rows['0'].resultQuality = 1024
  assert.equal(
    storedBitmaskIssue({ constraints: checks }, Object.values(initial.rows)),
    'invalid_quality'
  )
})

test('unknown and reserved check flags are pending until explicitly recalculated', () => {
  for (const quality of [201, 'bad', { quality: 100 }, 7]) {
    assert.deepEqual(
      unrunSlots({ result: 5, resultQuality: quality, staleSlots: [] }, 1),
      [1]
    )
  }
  const initial = workspace()
  initial.rows['0'].resultQuality = 2017
  const next = editValue(initial, '0', 8, checks, 'PT1M')
  assert.equal(next.rows['0'].resultQuality, 2017)
  assert.equal(next.drafts['0'].resultQuality, 2017)
  assert.ok(next.drafts['0'].staleSlots.includes(1))
  assert.throws(
    () => reviewHuman(next, ['0'], 3, checks),
    /Run the stored QC checks/
  )
})
