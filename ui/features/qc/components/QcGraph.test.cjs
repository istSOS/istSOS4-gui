/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the component's effects with the real ECharts SVG renderer, without a browser dependency. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')
const echarts = require('echarts')

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(compile(fs.readFileSync(filename, 'utf8')), filename)

const rows = Array.from({ length: 100 }, (_, index) => ({
  key: String(index),
  id: String(index),
  ts: 1700000000000 + index * 60000,
  time: new Date(1700000000000 + index * 60000).toISOString(),
  result: 50 + Math.sin(index / 4),
  resultQuality: 255,
  scope: 'window',
}))

function mount(context, initial = {}) {
  const refs = []
  const effects = []
  const pending = []
  let refIndex, effectIndex, chart, tree
  const t = (key) => key
  const hooks = {
    useRef(value) {
      const index = refIndex++
      return (refs[index] ??= { current: index === 0 ? {} : value })
    },
    useEffect(callback, deps) {
      const index = effectIndex++
      const previous = effects[index]
      if (
        !previous ||
        deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
      ) {
        pending.push(() => {
          previous?.cleanup?.()
          effects[index] = { deps, cleanup: callback() }
        })
      }
    },
  }
  const filename = path.join(__dirname, 'QcGraph.tsx')
  const component = new Module(filename, module)
  component.filename = filename
  component.paths = module.paths
  component.require = (name) => {
    if (name === 'react') return hooks
    if (name === 'react-i18next') return { useTranslation: () => ({ t }) }
    if (name === 'echarts')
      return {
        ...echarts,
        init: () =>
          (chart = echarts.init(null, null, {
            renderer: 'svg',
            ssr: true,
            width: 1000,
            height: 400,
          })),
      }
    return Module.prototype.require.call(component, name)
  }
  context.mock.method(global, 'ResizeObserver', function () {
    return { observe() {}, disconnect() {} }
  })
  component._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
  let props = {
    rows,
    drafts: {},
    checkCount: 3,
    selected: [],
    onSelect() {},
    encoded: true,
    originalEncoded: true,
    utcOffset: 0,
    ...initial,
  }
  const render = (update = {}) => {
    props = { ...props, ...update }
    refIndex = effectIndex = 0
    tree = component.exports.default(props)
    while (pending.length) pending.shift()()
  }
  render()
  context.after(() => effects.forEach((effect) => effect.cleanup?.()))
  return {
    chart,
    render,
    reset: () => tree.props.children[0].props.children.props.onClick(),
    series: (id) =>
      chart
        .getModel()
        .getSeries()
        .find((series) => series.id === id),
  }
}

// Node has no ResizeObserver; mock.method requires the property to exist.
global.ResizeObserver ??= class {}

function extents(chart) {
  return chart
    .getModel()
    .findComponents({ mainType: 'xAxis' })
    .map((axis) => axis.axis.scale.getExtent())
}

function dragBrush(chart, from, to) {
  const brush = chart.getModel().getComponent('brush')
  const grid = chart.getModel().getComponent('grid', 0)
  const controller = chart.getViewOfComponentModel(brush)._brushController
  const area = {
    brushType: 'lineX',
    panelId: `grid--${grid.id}`,
    range: [from, to].map((time) =>
      chart.convertToPixel({ xAxisIndex: 0 }, time)
    ),
  }
  // Exercise the real pixel-to-coordinate conversion used for dragging a
  // brush cover, including the final mouse-up event after the move.
  controller.trigger('brush', { areas: [structuredClone(area)], isEnd: false })
  controller.trigger('brush', { areas: [structuredClone(area)], isEnd: true })
}

test('dragging a brush beyond the automatic zoom selects the complete moved interval', (t) => {
  let selection = []
  const { chart, render, series } = mount(t, {
    onSelect(keys) {
      selection = keys
    },
  })
  dragBrush(chart, rows[40].ts, rows[50].ts)
  render({ selected: selection })
  assert.deepEqual(
    selection,
    rows.slice(40, 51).map((row) => row.key)
  )
  assert.deepEqual(extents(chart)[0], [rows[39].ts, rows[51].ts])

  // Move beyond the right edge, then wholly past the old left edge.
  for (const [start, end] of [
    [48, 58],
    [32, 42],
  ]) {
    const previousWindow = extents(chart)[0]
    assert.ok(
      rows[start].ts < previousWindow[0] || rows[end].ts > previousWindow[1]
    )
    dragBrush(chart, rows[start].ts, rows[end].ts)
    assert.deepEqual(
      selection,
      rows.slice(start, end + 1).map((row) => row.key)
    )
    render({ selected: selection })
    assert.deepEqual(
      series('qc-selected').option.data.map((point) => point[2]),
      selection
    )
    assert.deepEqual(extents(chart)[0], [rows[start - 1].ts, rows[end + 1].ts])
    assert.deepEqual(extents(chart)[0], extents(chart)[1])
    const area = chart.getModel().getComponent('brush').areas[0]
    assert.deepEqual(area.coordRange, [rows[start].ts, rows[end].ts])
    assert.deepEqual(
      area.range,
      [rows[start].ts, rows[end].ts].map((time) =>
        chart.convertToPixel({ xAxisIndex: 0 }, time)
      )
    )
  }
})

test('a brush containing one point remains draggable after zooming and table selection clears it', (t) => {
  let selection = []
  const { chart, render } = mount(t, {
    onSelect(keys) {
      selection = keys
    },
  })
  for (const index of [50, 55]) {
    dragBrush(chart, rows[index].ts - 1000, rows[index].ts + 1000)
    assert.deepEqual(selection, [String(index)])
    render({ selected: selection })
    assert.equal(chart.getModel().getComponent('brush').areas.length, 1)
    assert.deepEqual(
      chart.getModel().getComponent('brush').areas[0].coordRange,
      [rows[index].ts - 1000, rows[index].ts + 1000]
    )
  }
  render({ selected: ['10'] })
  assert.deepEqual(chart.getModel().getComponent('brush').areas, [])
  chart.dispatchAction({ type: 'brush', command: 'clear', areas: [] })
  assert.deepEqual(selection, [])
})

test('zoom retains spanning quality runs and aligns their pixels with observation times', (t) => {
  const { chart, series } = mount(t)
  for (const [start, end] of [
    [0, 100],
    [40, 60],
    [49, 51],
    [70, 80],
  ]) {
    chart.dispatchAction({
      type: 'dataZoom',
      dataZoomId: 'qc-zoom-inside',
      start,
      end,
    })
    const [plot, quality] = extents(chart)
    assert.deepEqual(quality, plot)
    assert.equal(series('qc-quality').getData().count(), 2)
    const instant = (plot[0] + plot[1]) / 2
    assert.equal(
      chart.convertToPixel({ xAxisIndex: 0 }, instant),
      chart.convertToPixel({ xAxisIndex: 1 }, instant)
    )
    assert.ok(chart.renderToSVGString().includes('<svg'))
  }
})

test('edits update existing curves once and preserve zoom without accumulating series', (t) => {
  const { chart, render, series } = mount(t)
  const originalModels = chart
    .getModel()
    .getSeries()
    .map((model) => model.uid)
  chart.dispatchAction({
    type: 'dataZoom',
    startValue: rows[40].ts,
    endValue: rows[60].ts,
  })
  const range = extents(chart)
  const updates = t.mock.method(chart, 'setOption')
  for (let index = 0; index < 12; index++) {
    render({
      rows: [...rows],
      drafts: {
        50: { result: 70 + index, resultQuality: 251, staleSlots: [] },
      },
    })
    assert.deepEqual(extents(chart), range)
    assert.deepEqual(
      chart
        .getModel()
        .getSeries()
        .map((model) => model.uid),
      originalModels
    )
    assert.equal(series('qc-edited').getData().count(), 1)
    assert.equal(series('qc-change-connectors').getData().count(), 3)
    assert.ok(chart.renderToSVGString().includes('<svg'))
  }
  assert.equal(
    updates.mock.calls.filter((call) => call.arguments[0].series.length === 8)
      .length,
    12
  )
  render({ drafts: {}, preview: {} })
  assert.equal(series('qc-edited').getData().count(), 0)
  assert.equal(series('qc-change-connectors').getData().count(), 0)
  assert.deepEqual(extents(chart), range)
})

test('changing selection updates markers without resubmitting observation curves', (t) => {
  const { chart, render, series } = mount(t)
  const updates = t.mock.method(chart, 'setOption')
  const original = structuredClone(series('qc-original').option.data)
  const draft = structuredClone(series('qc-draft').option.data)
  for (const selected of [
    ['50'],
    ['10', '50', '90'],
    rows.slice(20, 60).map((row) => row.key),
    rows.map((row) => row.key),
    [],
  ]) {
    render({ selected })
    assert.equal(series('qc-selected').getData().count(), selected.length)
    assert.deepEqual(series('qc-original').option.data, original)
    assert.deepEqual(series('qc-draft').option.data, draft)
  }
  assert.equal(updates.mock.calls.length, 5)
  for (const call of updates.mock.calls) {
    assert.deepEqual(
      call.arguments[0].series.map((item) => item.id),
      ['qc-selected', 'qc-draft']
    )
    assert.equal(Object.hasOwn(call.arguments[0].series[1], 'data'), false)
  }
})

test('large selection changes keep marker rendering on the same canvas layer', (t) => {
  const largeRows = Array.from({ length: 5000 }, (_, index) => ({
    ...rows[0],
    key: String(index),
    ts: rows[0].ts + index * 60000,
    result: 50 + Math.sin(index / 17),
  }))
  const { chart, render, series } = mount(t, { rows: largeRows })
  assert.equal(chart.getModel().get('hoverLayerThreshold'), Infinity)
  const models = chart
    .getModel()
    .getSeries()
    .map((model) => model.uid)
  for (const selected of [
    largeRows.map((row) => row.key),
    [largeRows[2500].key],
    largeRows.slice(200, 4500).map((row) => row.key),
    [],
  ]) {
    render({ selected })
    for (const id of ['qc-selection-targets', 'qc-selected', 'qc-edited']) {
      assert.equal(series(id).getProgressive(), 0)
      assert.equal(series(id).getZLevelKey(), '')
    }
    assert.deepEqual(
      chart
        .getModel()
        .getSeries()
        .map((model) => model.uid),
      models
    )
    assert.deepEqual(extents(chart)[0], extents(chart)[1])
  }
})

test('equivalent table selections retain manual zoom, including after reset', (t) => {
  const { chart, render, reset } = mount(t, { selected: ['49', '50'] })
  chart.dispatchAction({ type: 'dataZoom', start: 30, end: 70 })
  const range = extents(chart)
  render({ selected: ['50', '49'] })
  assert.deepEqual(extents(chart), range)
  reset()
  const full = extents(chart)
  render({ selected: ['49', '50'] })
  assert.deepEqual(extents(chart), full)
  assert.deepEqual(full[0], [rows[0].ts - 30000, rows.at(-1).ts + 30000])
})

test('box zoom, selection focus, and reset synchronize all zoom controllers', (t) => {
  const { chart, render, reset } = mount(t)
  const controllers = chart.getModel().findComponents({ mainType: 'dataZoom' })
  const boxZoom = controllers.find((model) => model.subType === 'select')
  assert.ok(boxZoom, 'exercise the actual controller injected by the toolbox')
  chart.dispatchAction({
    type: 'dataZoom',
    dataZoomId: boxZoom.id,
    startValue: rows[35].ts,
    endValue: rows[65].ts,
  })
  render({ drafts: { 50: { result: 80, resultQuality: 255, staleSlots: [] } } })
  assert.deepEqual(extents(chart), [
    [rows[35].ts, rows[65].ts],
    [rows[35].ts, rows[65].ts],
  ])
  render({ selected: ['50'] })
  assert.deepEqual(extents(chart), [
    [rows[48].ts, rows[52].ts],
    [rows[48].ts, rows[52].ts],
  ])
  reset()
  for (const controller of controllers) {
    assert.equal(controller.get('start'), 0)
    assert.equal(controller.get('end'), 100)
  }
})

test('selection markers and preview curves clear when their inputs are removed', (t) => {
  const { chart, render, series } = mount(t, {
    selected: ['50'],
    preview: { 50: 65 },
  })
  assert.equal(series('qc-selected').getData().count(), 1)
  assert.equal(series('qc-draft').get('markLine').data.length, 1)
  render({ selected: [], preview: undefined, encoded: false })
  assert.equal(series('qc-selected').getData().count(), 0)
  assert.equal(series('qc-draft').get('markLine').data.length, 0)
  assert.equal(series('qc-quality').getData().count(), 0)
  const proposed = series('qc-proposed').getData()
  for (let index = 0; index < proposed.count(); index++)
    assert.ok(Number.isNaN(proposed.get(proposed.mapDimension('y'), index)))
  assert.deepEqual(extents(chart)[0], extents(chart)[1])
})

test('empty and duplicate-time data keep a valid time window', (t) => {
  const { chart, render, reset } = mount(t, { rows: [] })
  for (const sample of [
    [rows[0]],
    [rows[0], { ...rows[0], key: 'duplicate' }],
  ]) {
    render({ rows: sample, selected: [sample[0].key] })
    reset()
    const [plot, quality] = extents(chart)
    assert.ok(Number.isFinite(plot[0]) && plot[1] > plot[0])
    assert.deepEqual(quality, plot)
  }
})

function pointTooltip(chart, row, draftValue = row.result) {
  return chart.getOption().tooltip[0].formatter([
    { seriesName: 'qc.original', value: [row.ts, row.result, row.key] },
    { seriesName: 'qc.draft', value: [row.ts, draftValue, row.key] },
    { seriesName: 'qc.workflow.proposed', value: [row.ts, 65] },
  ])
}

function tooltipTable(html) {
  return [...html.matchAll(/<tr>(.*?)<\/tr>/gs)].map((row) =>
    [...row[1].matchAll(/<t[hd]\b[^>]*>(.*?)<\/t[hd]>/gs)].map(
      (cell) => cell[1]
    )
  )
}

test('inspect tooltip hides proposed values and decodes recorded quality', (t) => {
  const { chart } = mount(t, {
    constraints: [
      { type: 'flagRange' },
      { type: 'flagConstants' },
      { type: 'flagZScore' },
    ],
  })
  const text = pointTooltip(chart, rows[50])
  assert.ok(!text.includes('qc.workflow.proposed'))
  assert.equal(chart.getOption().tooltip[0].renderMode, 'html')
  assert.deepEqual(tooltipTable(text), [
    ['', 'qc.original', 'qc.draft'],
    ['qc.value', String(rows[50].result), String(rows[50].result)],
    ['qc.workflow.tests.flagRange', 'qc.passed', 'qc.passed'],
    ['qc.workflow.tests.flagConstants', 'qc.passed', 'qc.passed'],
    ['qc.workflow.tests.flagZScore', 'qc.passed', 'qc.passed'],
    ['qc.data_state_label', 'qc.data_state.raw', 'qc.data_state.raw'],
    ['qc.human_review', 'qc.not_reviewed', 'qc.not_reviewed'],
    ['qc.quality', 'qc.verdict.pass (255)', 'qc.verdict.pass (255)'],
  ])
})

test('tooltip includes proposals only for previewed points and clears them afterward', (t) => {
  const { chart, render } = mount(t, { preview: { 50: 65 } })
  assert.deepEqual(tooltipTable(pointTooltip(chart, rows[50])).at(-1), [
    'qc.workflow.proposed',
    '—',
    '65',
  ])
  assert.ok(!pointTooltip(chart, rows[49]).includes('qc.workflow.proposed'))
  render({ preview: undefined })
  assert.ok(!pointTooltip(chart, rows[50]).includes('qc.workflow.proposed'))
})

test('a preview replacing a missing observation still has a tooltip', (t) => {
  const row = { ...rows[50], result: null }
  const { chart, series } = mount(t, {
    rows: [row],
    preview: { 50: 65 },
  })
  const point = series('qc-proposed').option.data[0]
  const text = chart
    .getOption()
    .tooltip[0].formatter([
      { seriesName: 'qc.workflow.proposed', value: point },
    ])
  assert.deepEqual(tooltipTable(text).at(-1), [
    'qc.workflow.proposed',
    '—',
    '65',
  ])
})

test('tooltip distinguishes failed and stale draft checks from original quality', (t) => {
  const { chart } = mount(t, {
    drafts: { 50: { result: 80, resultQuality: 251, staleSlots: [2] } },
  })
  const table = tooltipTable(pointTooltip(chart, rows[50], 80))
  assert.deepEqual(
    table.find((row) => row[0] === 'qc.value'),
    ['qc.value', String(rows[50].result), '80']
  )
  assert.deepEqual(
    table.find((row) => row[0] === 'qc.quality'),
    ['qc.quality', 'qc.verdict.pass (255)', 'qc.verdict.stale (251)']
  )
  assert.deepEqual(
    table.find((row) => row[0] === 'qc.check 1'),
    ['qc.check 1', 'qc.passed', 'qc.failed']
  )
  assert.deepEqual(
    table.find((row) => row[0] === 'qc.check 2'),
    ['qc.check 2', 'qc.passed', 'qc.needs_check']
  )
})

test('tooltip describes service codes and avoids decoding unconfirmed quality', (t) => {
  const row = { ...rows[50], resultQuality: 310 }
  const { chart, render } = mount(t, {
    rows: [row],
    encoded: false,
    originalEncoded: false,
    serviceMode: true,
  })
  let text = pointTooltip(chart, row)
  assert.deepEqual(tooltipTable(text).at(-1), [
    'qc.quality',
    'qc.workflow.flags.310 (310)',
    'qc.workflow.flags.310 (310)',
  ])
  assert.ok(!text.includes('qc.data_state_label'))
  render({ serviceMode: false, rows: [{ ...row, resultQuality: 255 }] })
  text = pointTooltip(chart, row)
  assert.deepEqual(tooltipTable(text).at(-1), [
    'qc.quality',
    'qc.verdict.unknown (255)',
    'qc.verdict.unknown (255)',
  ])
  assert.ok(!text.includes('qc.data_state_label'))
  render({ rows: [{ ...row, resultQuality: null }] })
  assert.ok(pointTooltip(chart, row).includes('qc.explain.no_quality'))
})

test('HTML tooltip escapes check names, quality values, and units', (t) => {
  const row = { ...rows[50], resultQuality: '<script>alert(1)</script>' }
  const { chart } = mount(t, {
    rows: [row],
    constraints: [{ type: '<img src=x onerror=alert(1)>' }],
    unit: '<b>°C</b>',
  })
  const html = pointTooltip(chart, row)
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('<b>'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(html.includes('&lt;b&gt;°C&lt;/b&gt;'))
})
