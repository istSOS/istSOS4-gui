/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the editor hook with controlled React state and a mocked preview service. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(compile(fs.readFileSync(filename, 'utf8')), filename)

const constraints = [
  { type: 'flagRange', min: 0, max: 10 },
  { type: 'flagConstants', window: '3min', thresh: 0 },
]
const rows = Array.from({ length: 6 }, (_, index) => ({
  key: String(index),
  id: String(index),
  ts: Date.UTC(2026, 9, 25, 0, index),
  time: new Date(Date.UTC(2026, 9, 25, 0, index)).toISOString(),
  result: 5,
  resultQuality: 63,
  scope: index === 5 ? 'following' : 'window',
}))
const stream = {
  id: '1',
  name: 'Test stream',
  unit: '°C',
  constraints,
  samplingFrequency: 'PT1M',
}
const source = {
  id: 'primary',
  endpoint: 'https://istsos.test/v1.1',
  authorizationEnabled: false,
}

async function editorFixture(
  context,
  fixtureRows = rows,
  fixtureStream = stream,
  stored = new Map()
) {
  const states = [],
    refs = [],
    effects = [],
    pending = []
  let stateIndex,
    refIndex,
    effectIndex,
    dirty = false,
    editor,
    previewResponse
  const previews = []
  const previewSignals = []
  let reads = 0,
    writes = 0,
    disposed = false
  const hooks = {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states))
        states[index] = typeof initial === 'function' ? initial() : initial
      return [
        states[index],
        (update) => {
          const next =
            typeof update === 'function' ? update(states[index]) : update
          if (!Object.is(states[index], next)) {
            states[index] = next
            dirty = true
          }
        },
      ]
    },
    useRef(initial) {
      return (refs[refIndex++] ??= { current: initial })
    },
    useMemo(callback) {
      return callback()
    },
    useEffect(callback, deps) {
      const index = effectIndex++
      const previous = effects[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
        pending.push(() => {
          previous?.cleanup?.()
          effects[index] = { deps, cleanup: callback() }
        })
    },
  }
  const storage = globalThis.sessionStorage
  globalThis.sessionStorage = {
    get length() {
      return stored.size
    },
    key(index) {
      return [...stored.keys()][index] ?? null
    },
    removeItem(key) {
      stored.delete(key)
    },
    getItem(key) {
      reads++
      return stored.get(key) ?? null
    },
    setItem(key, value) {
      writes++
      stored.set(key, value)
    },
  }
  function unmount() {
    if (disposed) return
    disposed = true
    effects.forEach((effect) => effect.cleanup?.())
    if (storage === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = storage
  }
  context.after(unmount)
  context.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const address = String(url)
    const body = options.body ? JSON.parse(options.body) : null
    if (address.endsWith('/sources'))
      return Response.json({ sources: [source] })
    if (address.endsWith('/data'))
      return Response.json(
        body.datastreamId
          ? { datastream: fixtureStream, rows: fixtureRows, bufferSize: 6 }
          : { datastreams: [fixtureStream] }
      )
    assert.ok(address.endsWith('/preview'))
    previews.push(body)
    previewSignals.push(options.signal)
    return new Promise((resolve) => {
      previewResponse = resolve
    })
  })
  const filename = path.join(__dirname, 'useQcEditor.ts')
  const component = new Module(filename, module)
  component.filename = filename
  component.paths = module.paths
  component.require = (name) => {
    if (name === 'react') return hooks
    if (name === '@/config/site')
      return { siteConfig: { authorizationEnabled: false } }
    if (name === '@/context/AuthContext')
      return { useAuth: () => ({ token: null }) }
    if (name === '@/lib/auth') return { getTokenUsername: () => 'test' }
    if (name === '@/lib/dataSourceTokens')
      return { getDataSourceToken: () => null }
    if (name === '@/features/observations/lib/observationWindow')
      return {
        getLiveDefaultWindow: () => ({
          startIso: rows[0].time,
          endIso: rows[4].time,
        }),
      }
    return Module.prototype.require.call(component, name)
  }
  component._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
  function render() {
    stateIndex = refIndex = effectIndex = 0
    dirty = false
    editor = component.exports.useQcEditor(false)
    while (pending.length) pending.shift()()
  }
  async function settle() {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (dirty && !disposed) render()
      await new Promise((resolve) => setImmediate(resolve))
      if (!dirty || disposed) return
    }
    throw new Error('Editor did not settle')
  }
  render()
  await settle()
  editor.chooseStream('1')
  await settle()
  assert.equal(await editor.load(), true)
  await settle()
  assert.equal(editor.confirmed, true)
  return {
    get current() {
      return editor
    },
    previews,
    previewSignals,
    unmount,
    storageAccess: () => ({ reads, writes }),
    settle,
    respond(response) {
      previewResponse(response)
    },
    complete() {
      const body = previews.at(-1)
      const edits = new Map(body.edits.map((edit) => [edit.key, edit.draft]))
      previewResponse(
        Response.json({
          datastream: fixtureStream,
          rows: fixtureRows,
          bufferSize: 6,
          results: body.edits.map(({ key, draft }) => ({
            key,
            resultQuality:
              draft.result === null ? 0 : draft.result === 5 ? 63 : 62,
            staleSlots: [],
            outcomes: [0, ...body.slots].map((slot) => ({
              slot,
              state: slot === 0 ? 2 : 3,
              reason: 'Passed',
            })),
          })),
          warnings: [],
          engineVersion: 'test',
        })
      )
      return edits
    },
  }
}

test('applying a correction reruns all supported checks using the new draft, including dependent context', async (context) => {
  const fixture = await editorFixture(context)
  fixture.current.setSlots([1])
  await fixture.settle()
  assert.equal(
    fixture.current.applyOperation({
      operation: 'constant',
      start: rows[4].ts,
      end: rows[4].ts,
      keys: ['4'],
      value: 8,
      note: 'Correct sensor value',
      includeFailedAnchors: false,
    }),
    true
  )
  await fixture.settle()
  assert.equal(fixture.previews.length, 1)
  const request = fixture.previews[0]
  assert.equal(request.scope, 'affected')
  assert.deepEqual(request.slots, [1, 2])
  assert.deepEqual(request.targetKeys, ['4'])
  assert.equal(request.edits.find((edit) => edit.key === '4').draft.result, 8)
  assert.ok(
    request.edits.find((edit) => edit.key === '5').draft.staleSlots.includes(2)
  )
  assert.ok(fixture.current.busy)
  fixture.complete()
  await fixture.settle()
  assert.equal(fixture.current.busy, '')
  assert.deepEqual(fixture.current.workspace.drafts['4'].staleSlots, [])
  assert.deepEqual(fixture.current.workspace.drafts['5'].staleSlots, [])
  assert.deepEqual(
    fixture.current.workspace.audit.map((entry) => entry.action),
    ['constant', 'checks']
  )
  assert.equal(
    fixture.current.workspace.audit.at(-1).parameters.automatic,
    true
  )
  assert.equal(fixture.current.workspace.undo.length, 1)
  fixture.current.undo()
  await fixture.settle()
  assert.deepEqual(fixture.current.workspace.drafts, {})
})

test('cell corrections rerun automatically and retain pending drafts when QC fails', async (context) => {
  const fixture = await editorFixture(context)
  fixture.current.edit('1', 8, 'Manual correction')
  await fixture.settle()
  assert.equal(fixture.previews.length, 1)
  assert.equal(
    fixture.previews[0].edits.find((edit) => edit.key === '1').draft.result,
    8
  )
  fixture.respond(
    Response.json({ error: 'SaQC service unavailable' }, { status: 503 })
  )
  await fixture.settle()
  assert.equal(fixture.current.busy, '')
  assert.equal(fixture.current.workspace.drafts['1'].result, 8)
  assert.ok(fixture.current.workspace.drafts['1'].staleSlots.includes(1))
  assert.match(fixture.current.error, /SaQC service unavailable/)
  assert.equal(fixture.previews.length, 1)
})

test('previewing corrections, unchanged cell values, and manual review do not start automatic QC', async (context) => {
  const fixture = await editorFixture(context)
  fixture.current.edit('1', 5, 'Unchanged measurement')
  assert.equal(fixture.current.review(['1'], 3, 'Confirmed measurement'), true)
  await fixture.settle()
  assert.equal(fixture.previews.length, 0)
})

test('foreign flags do not block recalculation and repairs preserve originals and unselected observations', async (context) => {
  const unknownRows = rows.map((row) => ({ ...row, resultQuality: 201 }))
  const oneCheckStream = { ...stream, constraints: [constraints[0]] }
  const fixture = await editorFixture(context, unknownRows, oneCheckStream)
  assert.equal(fixture.current.qualityIssue, 'invalid_quality')
  assert.equal(fixture.current.qualityBlocked, false)
  assert.deepEqual(fixture.current.workspace.drafts, {})
  fixture.current.setSelected(['1'])
  await fixture.settle()
  const checking = fixture.current.runChecks('selected')
  await fixture.settle()
  assert.equal(fixture.previews.length, 1)
  assert.deepEqual(fixture.previews[0].targetKeys, ['1'])
  assert.deepEqual(fixture.previews[0].edits, [])
  fixture.respond(
    Response.json({
      datastream: oneCheckStream,
      rows: unknownRows,
      bufferSize: 6,
      results: [
        {
          key: '1',
          resultQuality: 15,
          staleSlots: [],
          outcomes: [
            { slot: 0, state: 3, reason: 'Data present' },
            { slot: 1, state: 3, reason: 'Passed' },
          ],
        },
      ],
      warnings: ['Rebuilt 1 unknown quality flag'],
      engineVersion: 'test',
    })
  )
  await checking
  await fixture.settle()
  assert.equal(fixture.current.error, '')
  assert.equal(fixture.current.workspace.rows['1'].resultQuality, 201)
  assert.equal(fixture.current.workspace.drafts['1'].resultQuality, 15)
  assert.equal(fixture.current.workspace.drafts['0'], undefined)
  const change = fixture.current.workspace.audit.at(-1).changes[0]
  assert.equal(change.before.resultQuality, 201)
  assert.equal(change.after.resultQuality, 15)
  assert.equal(fixture.current.confirmed, true)
  fixture.current.undo()
  await fixture.settle()
  assert.deepEqual(fixture.current.workspace.drafts, {})
  assert.equal(fixture.current.qualityBlocked, false)
})

test('Undo and Redo work in the active session but returning starts with a clean workspace', async (context) => {
  const first = await editorFixture(context)
  first.current.edit('1', 8, 'Correct sensor value')
  first.complete()
  await first.settle()
  first.current.setCommitMessage('Current session only')
  await first.settle()
  first.current.undo()
  await first.settle()
  assert.deepEqual(first.current.workspace.drafts, {})
  first.current.redo()
  await first.settle()
  assert.equal(first.current.workspace.drafts['1'].result, 8)
  assert.ok(first.current.workspace.audit.length)
  assert.deepEqual(first.storageAccess(), { reads: 0, writes: 0 })
  first.unmount()

  const fresh = await editorFixture(context)
  assert.deepEqual(fresh.current.workspace.drafts, {})
  assert.deepEqual(fresh.current.workspace.undo, [])
  assert.deepEqual(fresh.current.workspace.redo, [])
  assert.deepEqual(fresh.current.workspace.audit, [])
  assert.equal(fresh.current.workspace.commitMessage, undefined)
  assert.equal(fresh.current.canRestore, undefined)
  assert.deepEqual(fresh.storageAccess(), { reads: 0, writes: 0 })
})

test('opening the editor removes old QC recovery copies without reading drafts or touching login data', async (context) => {
  const stored = new Map([
    ['istsos-qc-drafts-v1:test', '{"cache":{"obsolete":"large draft"}}'],
    ['istsos-qc-drafts-v1:previous-user', 'old QC recovery copy'],
    ['token', 'keep login'],
    ['other-app', 'keep preferences'],
  ])
  const fixture = await editorFixture(context, rows, stream, stored)
  assert.deepEqual(
    [...stored],
    [
      ['token', 'keep login'],
      ['other-app', 'keep preferences'],
    ]
  )
  assert.deepEqual(fixture.storageAccess(), { reads: 0, writes: 0 })
  assert.deepEqual(fixture.current.workspace.drafts, {})
})

test('leaving the editor aborts in-flight QC and changing datastream drops the old workspace', async (context) => {
  const fixture = await editorFixture(context)
  fixture.current.edit('1', 8, 'Current correction')
  await fixture.settle()
  assert.equal(fixture.previewSignals[0].aborted, false)
  fixture.unmount()
  assert.equal(fixture.previewSignals[0].aborted, true)
  fixture.complete()
  await fixture.settle()

  const fresh = await editorFixture(context)
  fresh.current.edit('1', 8, 'Another correction')
  fresh.complete()
  await fresh.settle()
  fresh.current.chooseStream('1')
  await fresh.settle()
  assert.equal(fresh.current.loaded, null)
  assert.deepEqual(fresh.current.workspace.rows, {})
  assert.deepEqual(fresh.current.workspace.drafts, {})
  assert.deepEqual(fresh.current.workspace.undo, [])
  assert.deepEqual(fresh.current.workspace.audit, [])
})
