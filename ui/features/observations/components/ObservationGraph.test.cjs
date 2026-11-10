/* eslint-disable @typescript-eslint/no-require-imports -- Exercise production graph effects with real ECharts and a minimal React hook runner. */
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
      esModuleInterop: true,
    },
  }).outputText
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
global.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
}
global.document ??= {
  addEventListener() {},
  removeEventListener() {},
  createElement() {
    return {
      getContext() {
        return null
      },
    }
  },
}
const stream = {
  '@iot.id': 1,
  name: 'Temperature',
  properties: { constraints: [{ type: 'flagRange', min: 0, max: 100 }] },
  unitOfMeasurement: { symbol: '°C' },
}
const observations = Array.from({ length: 100 }, (_, i) => ({
  '@iot.id': i + 1,
  phenomenonTime: new Date(1700000000000 + i * 60000).toISOString(),
  result: 20 + Math.sin(i / 4),
  resultQuality: 15,
}))
const t = (key) => key
const equalDeps = (a, b) =>
  a &&
  b &&
  a.length === b.length &&
  a.every((value, i) => Object.is(value, b[i]))
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === type) return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const result = find(child, type)
    if (result) return result
  }
  return null
}
function buttons(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [
    ...(tree.type === 'button' ? [tree] : []),
    ...[tree.props?.children].flat(Infinity).flatMap(buttons),
  ]
}
function mount(context, initial = {}) {
  const slots = [],
    effects = []
  let index, effectIndex, dirty, chart, tree, pending
  const hooks = {
    useSyncExternalStore(_subscribe, getSnapshot) {
      return getSnapshot()
    },
    useRef(value) {
      const i = index++
      return (slots[i] ??= { current: i === 0 ? {} : value })
    },
    useState(value) {
      const i = index++
      if (!(i in slots))
        slots[i] = typeof value === 'function' ? value() : value
      return [
        slots[i],
        (next) => {
          const result = typeof next === 'function' ? next(slots[i]) : next
          if (!Object.is(result, slots[i])) {
            slots[i] = result
            dirty = true
          }
        },
      ]
    },
    useMemo(callback, deps) {
      const i = index++
      if (!slots[i] || !equalDeps(slots[i].deps, deps))
        slots[i] = { deps, value: callback() }
      return slots[i].value
    },
    useCallback(callback, deps) {
      return hooks.useMemo(() => callback, deps)
    },
    useEffect(callback, deps) {
      const i = effectIndex++,
        previous = effects[i]
      if (!previous || !equalDeps(previous.deps, deps))
        pending.push(() => {
          previous?.cleanup?.()
          effects[i] = { deps, cleanup: callback() }
        })
    },
  }
  const filename = path.join(__dirname, 'ObservationGraph.tsx'),
    component = new Module(filename, module)
  component.filename = filename
  component.paths = module.paths
  component.require = (name) => {
    if (name === 'react') return hooks
    if (name === 'react-i18next') return { useTranslation: () => ({ t }) }
    if (name === 'echarts')
      return {
        ...echarts,
        init: () => {
          chart = echarts.init(null, null, {
            renderer: 'svg',
            ssr: true,
            width: 1000,
            height: 450,
          })
          const resize = chart.resize.bind(chart)
          chart.resize = () => resize({ width: 1000, height: 450 })
          return chart
        },
      }
    if (name === './ObservationTable') return { PAGE_SIZE: 25 }
    if (name === './CompactObservationTooltip')
      return { __esModule: true, default: 'CompactTooltip' }
    if (name === './ObservationDataTable')
      return { __esModule: true, default: 'DataTable' }
    if (name === './ReadingDetailsRail')
      return { __esModule: true, default: 'Details' }
    if (name === './QualityLegend')
      return { __esModule: true, default: 'QualityLegend' }
    return Module.prototype.require.call(component, name)
  }
  component._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
  let props = {
    datastream: stream,
    observations,
    activeDatastreamIds: ['1'],
    ...initial,
  }
  function render(update = {}) {
    props = { ...props, ...update }
    let count = 0
    do {
      if (++count > 20) throw new Error('Render loop')
      dirty = false
      index = effectIndex = 0
      pending = []
      tree = component.exports.default(props)
      if (!dirty) pending.forEach((callback) => callback())
    } while (dirty)
  }
  context.after(() => {
    effects.forEach((effect) => effect.cleanup?.())
    if (chart && !chart.isDisposed()) chart.dispose()
  })
  render()
  return {
    chart,
    render,
    table: () => find(tree, 'DataTable').props,
    details: () => find(tree, 'Details')?.props,
    series: (id) =>
      chart
        .getModel()
        .getSeries()
        .find((entry) => entry.id === id),
    press(label) {
      const button = buttons(tree).find(
        (button) => button.props.children === label
      )
      if (button) button.props.onClick()
      else {
        const feature = Object.values(
          chart.getOption().toolbox[0].feature
        ).find((feature) => feature.title === label)
        assert.ok(feature, `Missing plot control: ${label}`)
        feature.onclick()
      }
      render()
    },
    click(x, y = 20) {
      chart.getZr().trigger('click', {
        offsetX: chart.convertToPixel({ xAxisIndex: 0 }, x),
        offsetY: chart.convertToPixel({ yAxisIndex: 0 }, y),
      })
      render()
    },
  }
}
const extent = (chart) =>
  chart.getModel().getComponent('xAxis', 0).axis.scale.getExtent()

test('hover can be disabled and remembered without changing zoom or selection', (context) => {
  const {
    plotTooltipPreference,
  } = require('../../../lib/plotTooltipPreference.ts')
  context.after(() => plotTooltipPreference.set(true))
  const app = mount(context)
  assert.equal(app.chart.getOption().tooltip[0].triggerOn, 'mousemove|click')
  app.click(app.table().rows[40].x, app.table().rows[40].row.value)
  app.chart.dispatchAction({ type: 'dataZoom', start: 20, end: 70 })
  const zoom = extent(app.chart)
  const selected = app.table().selected
  app.press('observations.show_on_hover')
  assert.equal(app.chart.getOption().tooltip[0].triggerOn, 'click')
  assert.deepEqual(extent(app.chart), zoom)
  assert.deepEqual(app.table().selected, selected)
  const reopened = mount(context)
  assert.equal(reopened.chart.getOption().tooltip[0].triggerOn, 'click')
  app.press('observations.show_on_hover')
  assert.equal(app.chart.getOption().tooltip[0].triggerOn, 'mousemove|click')
})
function brush(chart, from, to) {
  const model = chart.getModel(),
    grid = model.getComponent('grid', 0)
  const controller = chart.getViewOfComponentModel(
    model.getComponent('brush')
  )._brushController
  controller.trigger('brush', {
    areas: [
      {
        brushType: 'lineX',
        panelId: `grid--${grid.id}`,
        range: [from, to].map((x) =>
          chart.convertToPixel({ xAxisIndex: 0 }, x)
        ),
      },
    ],
    isEnd: true,
  })
}

test('a graph click selects the matching row and navigates to its table page without resetting manual zoom', (context) => {
  const app = mount(context),
    target = app.table().rows[70]
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: app.table().rows[60].x,
    endValue: app.table().rows[80].x,
  })
  const before = extent(app.chart)
  app.click(target.x, target.row.value)
  assert.deepEqual(app.table().selected, [target.key])
  assert.equal(app.table().page, 2)
  assert.equal(app.table().focusKey, target.key)
  assert.deepEqual(extent(app.chart), before)
  assert.equal(app.series('__selected__1').getData().count(), 1)
})

test('table selections and clearing preserve manual zoom until Zoom to selection or Reset zoom is pressed', (context) => {
  const app = mount(context),
    rows = app.table().rows
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: rows[10].x,
    endValue: rows[90].x,
  })
  const before = extent(app.chart)
  app.table().onSelect([rows[70].key, rows[72].key])
  app.render()
  assert.equal(app.series('__selected__1').getData().count(), 2)
  assert.deepEqual(extent(app.chart), before)
  app.press('observations.zoom_selection')
  const focused = extent(app.chart)
  assert.ok(focused[0] > before[0] && focused[1] < before[1])
  app.table().onSelect([])
  app.render()
  assert.equal(app.series('__selected__1').getData().count(), 0)
  assert.deepEqual(extent(app.chart), focused)
  app.press('observations.reset_zoom')
  assert.ok(extent(app.chart)[0] <= rows[0].x)
  assert.ok(extent(app.chart)[1] >= rows.at(-1).x)
})

test('a graph brush selects all rows across pages, and a table selection clears its cover', (context) => {
  const app = mount(context),
    rows = app.table().rows
  brush(app.chart, rows[30].x, rows[65].x)
  app.render()
  assert.equal(app.table().selected.length, 36)
  assert.equal(app.table().page, 1)
  assert.equal(app.series('__selected__1').getData().count(), 36)
  app.table().onSelect([rows[10].key])
  app.render()
  assert.equal(app.chart.getModel().getComponent('brush').areas.length, 0)
})

test('aligned snapshots keep identical observation IDs separate and select each snapshot at the plotted offset', (context) => {
  const day = 86400000,
    asOf = observations.at(-1).phenomenonTime
  const earlier = new Date(Date.parse(asOf) - day).toISOString()
  const app = mount(context, {
    allSeries: [
      { datastream: stream, observations, asOf },
      {
        datastream: stream,
        observations: observations.map((obs) => ({
          ...obs,
          phenomenonTime: new Date(
            Date.parse(obs.phenomenonTime) - day
          ).toISOString(),
        })),
        asOf: earlier,
      },
    ],
    activeDatastreamIds: [`1@${asOf}`, `1@${earlier}`],
    alignedAxis: true,
    isCompare: true,
  })
  const rows = app.table().rows,
    x = rows[60].x
  app.click(x, rows[60].row.value)
  assert.equal(app.table().selected.length, 2)
  assert.equal(new Set(app.table().selected).size, 2)
  assert.equal(app.details(), undefined)
  const second = rows.find((row) => row.entry.asOf === earlier && row.x === x)
  app.table().onSelect([second.key])
  app.render()
  assert.equal(app.series(`__selected__1@${earlier}`).getData().count(), 1)
  assert.equal(app.series(`__selected__1@${asOf}`).getData().count(), 0)
})

test('changing data clears old selections and missing readings remain selectable', (context) => {
  const app = mount(context)
  app.table().onSelect([app.table().rows[5].key])
  app.render()
  app.render({ observations: [{ ...observations[0], result: null }] })
  assert.equal(app.table().selected.length, 0)
  assert.equal(app.table().rows.length, 1)
  app.table().onSelect([app.table().rows[0].key])
  app.render()
  assert.equal(app.table().selected.length, 1)
  assert.equal(app.table().rows[0].row.value, null)
  assert.equal(app.details(), undefined)
})

test('service catalog codes remain visible without being assigned bitmask severity lanes', (context) => {
  const app = mount(context, {
    datastream: { ...stream, properties: {} },
    observations: [{ ...observations[0], resultQuality: 310 }],
  })
  assert.equal(app.table().rows[0].row.rawQuality, 310)
  assert.equal(app.table().rows[0].entry.qualityMode, 'service')
  assert.equal(app.series('__quality_lane__'), undefined)
})

test('the brush tool keeps its selection when mouse-up also emits a click', (context) => {
  const app = mount(context),
    rows = app.table().rows
  app.chart.dispatchAction({
    type: 'takeGlobalCursor',
    key: 'brush',
    brushOption: { brushType: 'lineX' },
  })
  brush(app.chart, rows[30].x, rows[45].x)
  app.render()
  app.click(rows[45].x, rows[45].row.value)
  assert.equal(app.table().selected.length, 16)
})

test('style changes update existing series without resetting zoom or selection and never recolour quality', (context) => {
  const app = mount(context),
    rows = app.table().rows
  app.table().onSelect([rows[40].key])
  app.render()
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: rows[20].x,
    endValue: rows[70].x,
  })
  const before = extent(app.chart),
    quality = app.series('__quality_lane__').option.data
  app.render({
    seriesStyles: { 1: { color: '#7c3aed', line: 'dotted', points: true } },
  })
  assert.deepEqual(extent(app.chart), before)
  assert.deepEqual(app.table().selected, [rows[40].key])
  assert.equal(app.series('1').option.lineStyle.color, '#7c3aed')
  assert.equal(app.series('1').option.lineStyle.type, 'dotted')
  assert.equal(app.series('1').option.showSymbol, true)
  assert.equal(app.series('__selected__1').option.itemStyle.color, '#d946ef')
  assert.equal(
    app.series('__selected__1').option.itemStyle.borderColor,
    '#ffffff'
  )
  assert.equal(app.series('__selected__1').option.symbolSize, 11)
  assert.deepEqual(app.series('__quality_lane__').option.data, quality)
  app.render({ seriesStyles: { 1: { line: 'none', points: true } } })
  assert.equal(app.series('1').option.lineStyle.opacity, 0)
  assert.equal(app.series('1').option.showSymbol, true)
  app.render({ seriesStyles: {} })
  assert.equal(app.series('1').option.lineStyle.opacity, 1)
  assert.equal(app.series('1').option.lineStyle.type, 'solid')
  assert.equal(app.series('1').option.showSymbol, false)
  assert.deepEqual(extent(app.chart), before)
})

test('Both/A/B filters preserve zoom and selection; graph selection reveals matching rows again', (context) => {
  const second = { ...stream, '@iot.id': 2, name: 'Second' }
  const app = mount(context, {
    allSeries: [
      { datastream: stream, observations },
      { datastream: second, observations },
    ],
    activeDatastreamIds: ['1', '2'],
  })
  assert.equal(app.table().rows.length, 200)
  app.chart.dispatchAction({ type: 'dataZoom', start: 20, end: 70 })
  const before = extent(app.chart)
  app.press('A')
  assert.equal(app.table().rows.length, 100)
  assert.ok(app.table().rows.every((row) => row.entry.id === '1'))
  app.table().onSelect([app.table().rows[40].key])
  app.render()
  app.press('B')
  assert.ok(app.table().rows.every((row) => row.entry.id === '2'))
  assert.equal(app.table().selected.length, 1)
  assert.deepEqual(extent(app.chart), before)
  app.click(app.table().rows[40].x, 20)
  assert.equal(app.table().rows.length, 200)
  assert.deepEqual(extent(app.chart), before)
})

test('Reset zoom restores the readings extent within a week, on both plot and quality axes', (context) => {
  // Under 7 days of readings the axis spans the readings, not the query window.
  const first = Date.parse(observations[0].phenomenonTime),
    last = Date.parse(observations.at(-1).phenomenonTime)
  const app = mount(context, {
    windowStart: first - 86400000,
    windowEnd: last + 86400000,
  })
  app.table().onSelect([app.table().rows[40].key])
  app.render()
  app.press('observations.zoom_selection')
  assert.ok(extent(app.chart)[0] > first)
  app.press('observations.reset_zoom')
  assert.deepEqual(extent(app.chart), [first, last])
  assert.deepEqual(
    app.chart.getModel().getComponent('xAxis', 1).axis.scale.getExtent(),
    [first, last]
  )
  assert.equal(app.table().selected.length, 1)
  assert.equal(app.chart.getOption().toolbox[0].feature.dataZoom, undefined)
})

test('equal units share a value axis while different units retain independent axes', (context) => {
  const second = { ...stream, '@iot.id': 2, name: 'Second' }
  const app = mount(context, {
    allSeries: [
      { datastream: stream, observations },
      { datastream: second, observations },
    ],
    activeDatastreamIds: ['1', '2'],
  })
  assert.equal(app.series('2').option.yAxisIndex, 0)
  assert.equal(app.chart.getOption().yAxis[1].show, false)
  app.render({
    allSeries: [
      { datastream: stream, observations },
      {
        datastream: { ...second, unitOfMeasurement: { symbol: '%' } },
        observations,
      },
    ],
  })
  assert.equal(app.series('2').option.yAxisIndex, 1)
  assert.equal(app.chart.getOption().yAxis[1].show, true)
})

test('bars preserve recorded readings, zero baseline, selected points and zoom when switching back to lines', (context) => {
  const app = mount(context, {
      windowStart: Date.parse(observations[0].phenomenonTime),
      windowEnd: Date.parse(observations.at(-1).phenomenonTime),
    }),
    rows = app.table().rows
  app.chart.dispatchAction({ type: 'dataZoom', start: 15, end: 80 })
  const before = extent(app.chart)
  app.table().onSelect([rows[40].key])
  app.render()
  app.render({ seriesStyles: { 1: { type: 'bar', color: '#2563eb' } } })
  assert.equal(app.series('1').subType, 'bar')
  assert.equal(app.series('1').getRawData().count(), 100)
  assert.equal(app.series('1').option.sampling, 'none')
  assert.equal(app.chart.getOption().yAxis[0].scale, false)
  assert.deepEqual(extent(app.chart), before)
  assert.deepEqual(app.table().selected, [rows[40].key])
  assert.equal(app.series('__selected__1').getData().count(), 1)
  app.press('observations.zoom_selection')
  app.press('observations.reset_zoom')
  app.render({
    seriesStyles: { 1: { type: 'line', line: 'dashed', points: true } },
  })
  assert.equal(app.series('1').subType, 'line')
  assert.equal(app.series('1').getRawData().count(), 100)
  assert.equal(app.series('1').option.lineStyle.type, 'dashed')
  assert.equal(app.chart.getOption().yAxis[0].scale, true)
  assert.equal(
    app.chart
      .getModel()
      .getSeries()
      .filter((series) => series.id === '1').length,
    1
  )
})

test('toolbox zoom uses the current selection and the old HTML zoom buttons are absent', (context) => {
  const app = mount(context),
    rows = app.table().rows
  const feature = () => app.chart.getOption().toolbox[0].feature
  assert.ok(feature().myDownloadCsv)
  assert.equal(feature().myZoomToSelection.iconStyle.opacity, 0.35)
  app.table().onSelect([rows[20].key, rows[22].key])
  app.render()
  assert.equal(feature().myZoomToSelection.iconStyle.opacity, 1)
  app.press('observations.zoom_selection')
  const first = extent(app.chart)
  app.table().onSelect([rows[70].key, rows[72].key])
  app.render()
  app.press('observations.zoom_selection')
  assert.ok(extent(app.chart)[0] > first[1])
  app.table().onSelect([])
  app.render()
  const empty = extent(app.chart)
  app.press('observations.zoom_selection')
  assert.deepEqual(extent(app.chart), empty)
  assert.equal(feature().myZoomToSelection.iconStyle.opacity, 0.35)
})

test('changing display offset preserves zoom, selection and UTC coordinates while updating the table and axis labels', (context) => {
  const app = mount(context),
    row = app.table().rows[40]
  app.table().onSelect([row.key])
  app.render()
  app.chart.dispatchAction({ type: 'dataZoom', start: 15, end: 75 })
  const before = extent(app.chart)
  app.render({ utcOffset: 345 })
  assert.deepEqual(extent(app.chart), before)
  assert.deepEqual(app.table().selected, [row.key])
  assert.equal(app.table().utcOffset, 345)
  const formatter = app.chart.getOption().xAxis[1].axisLabel.formatter
  assert.equal(formatter(Date.parse('2026-10-30T23:30:00Z')), '05:15')
  assert.equal(app.table().rows[40].time, row.time)
})

test('date ticks stay sparse and horizontal, adapt to zoom, and keep only horizontal grid lines', (context) => {
  const start = Date.parse('2026-10-23T00:00:00Z'),
    day = 86400000
  const app = mount(context, {
    observations: Array.from({ length: 169 }, (_, i) => ({
      ...observations[0],
      '@iot.id': i + 1,
      phenomenonTime: new Date(start + i * 3600000).toISOString(),
    })),
    windowStart: start,
    windowEnd: start + 7 * day,
  })
  const axis = () => app.chart.getModel().getComponent('xAxis', 1).axis
  const option = app.chart.getOption()
  for (const x of option.xAxis) {
    assert.equal(x.splitLine.show, false)
    assert.equal(x.minorSplitLine.show, false)
    assert.equal(x.splitNumber, 7)
  }
  assert.notEqual(option.yAxis[0].splitLine.show, false)
  assert.equal(option.xAxis[1].axisLabel.rotate, 0)
  assert.ok(axis().scale.getTicks().length <= 10)
  const label = option.xAxis[1].axisLabel.formatter
  assert.match(label(start), /23/)
  assert.doesNotMatch(label(start), /:/)
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: start,
    endValue: start + 2 * day,
  })
  assert.match(label(start + 3600000), /01:00/)
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: start,
    endValue: start + 6 * 3600000,
  })
  assert.equal(label(start + 3600000), '01:00')
  assert.ok(axis().scale.getTicks().length <= 10)
  app.chart.dispatchAction({
    type: 'dataZoom',
    startValue: start,
    endValue: start + 30000,
  })
  assert.equal(label(start + 15000), '00:00:15')
})

test('Details selection tool changes colour and clearing a point exits brush mode so another point can be selected', (context) => {
  const app = mount(context)
  const tool = () =>
    app.chart.getViewOfComponentModel(
      app.chart.getModel().getComponent('toolbox')
    )._features.brush
  const clickTool = (name) => tool().model.iconPaths[name].trigger('click')
  assert.equal(tool().model.get(['iconStyle', 'borderColor']), '#9ca3af')
  assert.equal(
    tool().model.get(['emphasis', 'iconStyle', 'borderColor']),
    '#008374'
  )
  assert.equal(tool().model.get(['iconStatus', 'lineX']), 'normal')
  const row = app.table().rows[40]
  app.click(row.x, row.row.value)
  assert.equal(app.table().selected.length, 1)
  clickTool('lineX')
  assert.equal(tool().model.get(['iconStatus', 'lineX']), 'emphasis')
  clickTool('clear')
  app.render()
  assert.deepEqual(app.table().selected, [])
  assert.equal(app.series('__selected__1').getData().count(), 0)
  assert.equal(app.chart.getModel().getComponent('brush').brushType, false)
  assert.equal(tool().model.get(['iconStatus', 'lineX']), 'normal')
  app.click(row.x, row.row.value)
  assert.equal(app.table().selected.length, 1)
})

test('interval observations render at bucket ends and select the same table identities', (context) => {
  const interval = '2026-11-03T14:30:00Z/2026-11-03T14:40:00Z'
  const end = Date.parse('2026-11-03T14:40:00Z')
  const app = mount(context, {
    observations: [
      {
        '@iot.id': 47632903,
        phenomenonTime: interval,
        resultTime: '2026-11-03T14:43:00Z',
        result: 0,
        resultQuality: 210,
      },
    ],
    windowStart: end - 600000,
    windowEnd: end + 600000,
  })
  const point = app.series('1').option.data[0]
  assert.equal(point[0], end)
  assert.equal(point[1], 0)
  const row = app.table().rows[0]
  assert.equal(row.x, end)
  assert.equal(row.time, interval)
  app.table().onSelect([row.key])
  app.render()
  assert.equal(app.series('__selected__1').option.data[0][0], end)
  assert.deepEqual(app.table().selected, [row.key])
})
