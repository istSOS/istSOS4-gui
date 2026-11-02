/* eslint-disable @typescript-eslint/no-require-imports -- Exercise hook cleanup with controlled requests and timers. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const flush = () => new Promise(setImmediate)
const dateA = '2026-10-20T10:00:00Z'
const dateB = '2026-10-21T10:00:00Z'

function mount(context, name) {
  const slots = [],
    effects = [],
    timers = new Set(),
    requests = []
  let index, effectIndex, pending, current
  const hooks = {
    useState(value) {
      const slot = index++
      if (!(slot in slots)) slots[slot] = value
      return [
        slots[slot],
        (next) => {
          slots[slot] = next
        },
      ]
    },
    useRef(value) {
      return (slots[index++] ??= { current: value })
    },
    useMemo(callback) {
      index++
      return callback()
    },
    useEffect(callback, deps) {
      const slot = effectIndex++
      const previous = effects[slot]
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      ) {
        pending.push(() => {
          previous?.cleanup?.()
          effects[slot] = { deps, cleanup: callback() }
        })
      }
    },
  }
  function read(thing, date, signal) {
    return new Promise((resolve) =>
      requests.push({ thing, date, signal, resolve })
    )
  }
  const exports = {}
  const filename = path.join(__dirname, name + '.ts')
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  vm.runInNewContext(
    source,
    {
      exports,
      AbortController,
      setTimeout(callback) {
        timers.add(callback)
        return callback
      },
      clearTimeout(callback) {
        timers.delete(callback)
      },
      console: {
        error() {
          throw new Error('Cancellation must not surface an error')
        },
      },
      require(name) {
        if (name === 'react') return hooks
        if (name === '@/config/versioning') return { isVersioningEnabled: true }
        if (name === '../adapters/asOfAdapter')
          return {
            activeAdapter: { resolveThing: read, resolveMapThings: read },
          }
        throw new Error('Unexpected module: ' + name)
      },
    },
    { filename }
  )
  let props = {
    liveThings: [],
    thing: { '@iot.id': 1, __sourceEndpoint: 'test' },
    asOfDate: dateA,
  }
  function render(update = {}) {
    props = { ...props, ...update }
    index = effectIndex = 0
    pending = []
    current = exports[name](props)
    pending.forEach((effect) => effect())
    return current
  }
  function unmount() {
    effects.forEach((effect) => effect.cleanup?.())
  }
  context.after(unmount)
  render()
  return {
    requests,
    render,
    unmount,
    runTimers() {
      for (const timer of [...timers]) {
        timers.delete(timer)
        timer()
      }
    },
  }
}

for (const name of ['useAsOfThing', 'useAsOfMapThings']) {
  test(`${name} aborts obsolete requests and ignores their late results`, async (context) => {
    const app = mount(context, name)
    app.runTimers()
    const first = app.requests[0]
    assert.equal(first.signal.aborted, false)
    app.render({ asOfDate: dateB })
    assert.equal(first.signal.aborted, true)
    app.runTimers()
    const second = app.requests[1]
    const thing = { '@iot.id': 2 }
    const result =
      name === 'useAsOfThing'
        ? {
            thing,
            existenceState: 'exists',
            existenceRange: { createdAt: null, deletedAt: null },
          }
        : {
            things: [thing],
            failedEndpoints: [],
            readingsUnavailableEndpoints: [],
          }
    second.resolve(result)
    await flush()
    first.resolve(
      name === 'useAsOfThing'
        ? { ...result, thing: { '@iot.id': 99 } }
        : { ...result, things: [] }
    )
    await flush()
    const current = app.render()
    assert.equal(
      name === 'useAsOfThing'
        ? current.snapshotThing['@iot.id']
        : current.things[0]['@iot.id'],
      2
    )
    assert.equal(current.error, null)
    app.render({ asOfDate: null })
    assert.equal(second.signal.aborted, true)
  })

  test(`${name} aborts on unmount`, (context) => {
    const app = mount(context, name)
    app.runTimers()
    app.unmount()
    assert.equal(app.requests[0].signal.aborted, true)
  })
}

test('map date changes during debounce do not start obsolete fetches', (context) => {
  const app = mount(context, 'useAsOfMapThings')
  app.render({ asOfDate: dateB })
  app.runTimers()
  assert.equal(app.requests.length, 1)
  assert.equal(app.requests[0].date, dateB)
})
