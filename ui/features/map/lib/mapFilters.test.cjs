/* eslint-disable @typescript-eslint/no-require-imports -- Exercise map filtering and the property picker without a browser dependency. */
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(compile(fs.readFileSync(filename, 'utf8')), filename)

const { buildLayerControlSources } = require('./layersControlData.ts')
const {
  getThingKey,
  matchesMapFilterSearch,
} = require('./leafletMapHelpers.ts')
const { drawNetworkLayers } = require('./leafletDraw.ts')
const { createClusterGroup, setMarkerSelected } = require('./leafletCluster.ts')

function station(id, source, property = 'Temperature', result = 12) {
  return {
    '@iot.id': id,
    name: `${source} station ${id}`,
    __sourceId: source,
    __sourceName: `Source ${source}`,
    Locations: [{ location: { type: 'Point', coordinates: [8.9, 46.2] } }],
    Datastreams: [
      {
        '@iot.id': id,
        ObservedProperty: { name: property },
        unitOfMeasurement: { symbol: '°C' },
        Observations: [{ result, resultTime: '2026-10-27T12:00:00Z' }],
      },
    ],
  }
}

function sources(things, visibility = {}, properties = []) {
  return buildLayerControlSources({
    things,
    thingEnabled: visibility,
    observedPropsMeta: properties,
    resolvedSourceColorByKey: new Map([
      ['A', '#008374'],
      ['B', '#2563eb'],
    ]),
    unspecifiedNetworkLabel: 'Unspecified',
  })
}

function drawReadings(
  things,
  propertyKeys,
  visible = () => true,
  settings = {}
) {
  const markers = []
  drawNetworkLayers({
    L: {
      marker(position, options) {
        const events = new Map()
        return {
          position,
          options,
          events,
          on(event, handler) {
            events.set(event, handler)
          },
          bindTooltip(content) {
            this.tooltip = content
          },
        }
      },
      divIcon: (options) => options,
    },
    proj4: (_source, _target, point) => point,
    map: {},
    things,
    isThingVisible: visible,
    networkLayers: new Map(),
    overlayWrappersRef: { current: new Map() },
    enabledRef: { current: new Map() },
    didInitVisibilityRef: { current: false },
    observedCluster: {
      clearLayers() {},
      addLayer(marker) {
        markers.push(marker)
      },
    },
    observedPropertyFilter: new Set(propertyKeys),
    ...settings,
  })
  return markers
}

test('filter search matches all terms regardless of case and accents', () => {
  for (const query of ['', '  ', 'LUGANO', 'alpine lugano', '0'])
    assert.equal(
      matchesMapFilterSearch('Lago di Lugáno Alpine Water 0', query),
      true
    )
  assert.equal(
    matchesMapFilterSearch('Lago di Lugáno Alpine Water 0', 'another station'),
    false
  )
})

test('property selections do not enable hidden sources and partially visible sources remain available', () => {
  const things = [station(1, 'A'), station(2, 'A'), station(1, 'B')]
  const visibility = { 'A::1': false, 'A::2': true, 'B::1': false }
  const original = { ...visibility }
  const layers = sources(things, visibility, [
    { key: 'A||Temperature', enabled: true },
    { key: 'B||Temperature', enabled: true },
  ])
  assert.equal(layers.find((source) => source.key === 'A').enabled, true)
  assert.equal(layers.find((source) => source.key === 'B').enabled, false)
  assert.deepEqual(visibility, original)
  assert.deepEqual(
    layers.map((source) => source.observedProperties[0].key),
    ['A||Temperature', 'B||Temperature']
  )
})

test('selecting a property displays its latest values immediately and respects hidden stations and sources', () => {
  const things = [station(1, 'A'), station(2, 'A'), station(1, 'B')]
  const markers = drawReadings(
    things,
    ['A||Temperature', 'B||Temperature'],
    (thing) => thing.__sourceId === 'A' && thing['@iot.id'] === 2
  )
  assert.equal(markers.length, 1)
  assert.ok(markers[0].options.icon.html.includes('12 °C'))
})

test('properties remain source-specific and missing readings retain their station anchor', () => {
  const things = [
    station(1, 'A'),
    station(1, 'B'),
    station(2, 'A', 'Temperature', null),
  ]
  assert.equal(drawReadings(things, ['A||Temperature']).length, 2)
  assert.equal(
    drawReadings(things, ['A||Temperature', 'B||Temperature']).length,
    3
  )
  things[0].Datastreams[0].Observations.unshift({
    result: 20,
    resultTime: '2026-10-27T13:00:00Z',
  })
  assert.ok(
    drawReadings(things, ['A||Temperature'])[0].options.icon.html.includes(
      '20 °C'
    )
  )
})

test('multiple matching streams use one anchored dot and a compact hover preview', () => {
  const thing = station(1, 'A')
  const second = station(2, 'A', 'Chlorophyll-a', 0).Datastreams[0]
  thing.Datastreams[0].name = 'WT_SASSALTO'
  second.name = 'CHLA_SASSALTO'
  second['@iot.id'] = 0
  second.unitOfMeasurement.symbol = 'µg/L'
  thing.Datastreams.push(second)
  const selections = []
  const [marker] = drawReadings(
    [thing],
    ['A||Temperature', 'A||Chlorophyll-a'],
    undefined,
    {
      onThingSelect: (...args) => selections.push(args),
    }
  )
  assert.match(marker.options.icon.html, /map-station-dot/)
  assert.doesNotMatch(
    marker.options.icon.html,
    /map-station-value|map-reading-card/
  )
  assert.deepEqual(marker.position, [46.2, 8.9])
  assert.deepEqual(marker.options.icon.iconAnchor, [12, 12])
  assert.match(marker.tooltip, /WT_SASSALTO/)
  assert.match(marker.tooltip, /CHLA_SASSALTO/)
  assert.doesNotMatch(
    marker.tooltip,
    /thing-tooltip-name|A station 1|Source A|Temperature|Chlorophyll-a/
  )
  assert.match(marker.tooltip, /0 µg\/L/)
  marker.events.get('click')({})
  assert.equal(selections[0][0], thing)
  assert.equal(selections[0][1], undefined)
  const [filtered] = drawReadings([thing], ['A||Chlorophyll-a'], undefined, {
    onThingSelect: (...args) => selections.push(args),
  })
  assert.match(filtered.options.icon.html, /map-station-value/)
  assert.match(filtered.options.icon.html, /0 µg\/L/)
  filtered.events.get('click')({
    originalEvent: { target: { closest: () => ({}) } },
  })
  assert.deepEqual(selections[1][1], {
    observedPropertyName: 'Chlorophyll-a',
    datastreamId: '0',
  })
})

test('stream counts include missing readings and hover previews are limited to three streams', () => {
  const thing = station(1, 'A')
  const missing = station(2, 'A', 'Conductivity', null).Datastreams[0]
  thing.Datastreams.push(missing)
  const [multi] = drawReadings([thing], ['A||Temperature', 'A||Conductivity'])
  assert.doesNotMatch(multi.options.icon.html, /map-station-value/)
  assert.match(multi.tooltip, /No reading available/)
  assert.match(multi.tooltip, />—<\/strong>/)
  const [single] = drawReadings([thing], ['A||Conductivity'])
  assert.match(single.options.icon.html, /map-station-dot/)
  assert.doesNotMatch(single.options.icon.html, /map-station-value/)
  assert.match(single.tooltip, /No reading available/)
  thing.Datastreams.push(
    ...Array.from({ length: 5 }, (_, index) => ({
      ...missing,
      '@iot.id': index + 3,
    }))
  )
  const [many] = drawReadings([thing], ['A||Temperature', 'A||Conductivity'])
  assert.equal((many.tooltip.match(/map-preview-reading/g) ?? []).length, 3)
  assert.match(many.tooltip, /\+4 more/)
})

test('snapshot markers retain approximate placement and judge delayed readings at the snapshot instant', () => {
  const thing = station(1, 'A')
  thing.__asOfLocationSource = 'link'
  thing.Datastreams[0].properties = { acquisitionFrequency: 'PT10M' }
  thing.Datastreams[0].phenomenonTime = '2027-01-01/2027-01-02'
  const options = {
    asOfLabel: 'Oct 27 · 12:15 UTC',
    referenceTime: '2026-10-27T12:15:00Z',
  }
  const [fresh] = drawReadings([thing], ['A||Temperature'], undefined, options)
  assert.equal(fresh.options.opacity, 0.5)
  assert.match(fresh.options.icon.html, /≈ Oct 27/)
  assert.doesNotMatch(fresh.options.icon.html, /map-marker-warning/)
  const [late] = drawReadings([thing], ['A||Temperature'], undefined, {
    ...options,
    referenceTime: '2026-10-27T12:30:00Z',
  })
  assert.equal(late.__freshnessStatus, 'stale')
  assert.match(late.options.icon.html, /map-marker-warning/)
})

test('value labels and previews escape names and values supplied by data sources', () => {
  const thing = station(1, 'A', '<img src=x>', '<script>alert(1)</script>')
  thing.name = '<img src=station>'
  thing.Datastreams[0].name = '<img src=datastream>'
  const [marker] = drawReadings([thing], ['A||<img src=x>'])
  assert.doesNotMatch(marker.options.icon.html, /<script>|<img/)
  assert.match(marker.options.icon.html, /&lt;script&gt;/)
  assert.match(marker.tooltip, /&lt;img src=datastream&gt;/)
  assert.doesNotMatch(marker.tooltip, /<img|<script>|src=station/)
})

test('compact previews show warning icons only beside delayed datastream readings', () => {
  const thing = station(1, 'A')
  const delayed = thing.Datastreams[0]
  delayed.properties = { acquisitionFrequency: 'PT10M' }
  const fresh = station(2, 'A', 'Conductivity', 22).Datastreams[0]
  fresh.properties = { acquisitionFrequency: 'PT10M' }
  fresh.Observations[0].resultTime = '2026-10-27T12:29:00Z'
  thing.Datastreams.push(fresh)
  const [marker] = drawReadings(
    [thing],
    ['A||Temperature', 'A||Conductivity'],
    undefined,
    {
      referenceTime: '2026-10-27T12:30:00Z',
    }
  )
  assert.equal((marker.tooltip.match(/map-preview-warning/g) ?? []).length, 1)
  assert.match(marker.tooltip, /12 °C<span class="map-preview-warning"/)
  assert.doesNotMatch(marker.tooltip, /map-tooltip-warning|thing-tooltip-name/)
})

test('selection remains source-specific and cluster badges reflect the stations they contain', () => {
  const markers = drawReadings(
    [station(1, 'A'), station(1, 'B')],
    ['A||Temperature', 'B||Temperature'],
    undefined,
    {
      selectedThingKey: 'A::1',
    }
  )
  assert.equal(markers[0].__selected, true)
  assert.equal(markers[1].__selected, false)
  let clusterOptions
  createClusterGroup({
    L: {
      markerClusterGroup(options) {
        clusterOptions = options
        return {}
      },
      divIcon: (options) => options,
      point: (x, y) => [x, y],
    },
  })
  markers[1].__freshnessStatus = 'stale'
  const icon = clusterOptions.iconCreateFunction({
    getChildCount: () => markers.length,
    getAllChildMarkers: () => markers,
  })
  assert.match(icon.html, />2<\/span>/)
  assert.match(icon.html, /map-marker-warning/)
  assert.match(icon.className, /map-marker-selected/)
  const changes = []
  const layer = {
    options: { icon: { options: { className: 'map-station-icon' } } },
    getElement: () => ({
      classList: { toggle: (...args) => changes.push(args) },
    }),
  }
  setMarkerSelected(layer, true)
  assert.match(layer.options.icon.options.className, /map-marker-selected/)
  setMarkerSelected(layer, false)
  assert.equal(layer.options.icon.options.className, 'map-station-icon')
  assert.deepEqual(changes, [
    ['map-marker-selected', true],
    ['map-marker-selected', false],
  ])
})

function picker(initial, componentName = 'MapEntityFilter') {
  const states = []
  let index = 0,
    tree,
    props = initial
  const filename = path.join(__dirname, `../components/${componentName}.tsx`)
  const component = new Module(filename, module)
  component.filename = filename
  component.paths = module.paths
  component.require = (name) => {
    if (name === 'react')
      return {
        useState(value) {
          const slot = index++
          if (!(slot in states)) states[slot] = value
          return [
            states[slot],
            (next) => {
              states[slot] = next
            },
          ]
        },
      }
    if (name === 'react-i18next')
      return { useTranslation: () => ({ t: (key) => key }) }
    if (name === './MapChecklistFilter') {
      const sharedFile = path.join(
        __dirname,
        '../components/MapChecklistFilter.tsx'
      )
      const shared = new Module(sharedFile, component)
      shared.filename = sharedFile
      shared.paths = module.paths
      shared.require = component.require
      shared._compile(compile(fs.readFileSync(sharedFile, 'utf8')), sharedFile)
      return shared.exports
    }
    if (name === '@heroui/button') return { Button: 'Button' }
    if (name === '@heroui/input') return { Input: 'Input' }
    if (name === '@heroui/checkbox') return { Checkbox: 'Checkbox' }
    if (name === '@heroui/popover')
      return {
        Popover: 'Popover',
        PopoverTrigger: 'PopoverTrigger',
        PopoverContent: 'PopoverContent',
      }
    if (name === '@/components/icons')
      return { SearchIcon: 'SearchIcon', ChevronDownIcon: 'ChevronDownIcon' }
    return Module.prototype.require.call(component, name)
  }
  component._compile(compile(fs.readFileSync(filename, 'utf8')), filename)
  function render(update = {}) {
    props = { ...props, ...update }
    index = 0
    tree = component.exports.default(props)
  }
  function nodes(type, node) {
    if (arguments.length === 1) node = tree
    if (!node || typeof node !== 'object') return []
    if (typeof node.type === 'function')
      return nodes(type, node.type(node.props))
    if (Array.isArray(node)) return node.flatMap((child) => nodes(type, child))
    return [
      ...(node.type === type ? [node] : []),
      ...nodes(type, node.props?.children),
    ]
  }
  render()
  return { render, nodes }
}

const {
  allMapFilters,
  buildMapCrossfilter,
  getMapDatastreamKey,
  isFacetSelected,
  toggleFacetOption,
  toggleFacetOptions,
} = require('./mapCrossfilter.ts')

function crossfilterFixture() {
  const north = station(1, 'A')
  north.Datastreams[0].name = 'Temperature sensor'
  const conductivity = station(2, 'A', 'Conductivity', 4).Datastreams[0]
  conductivity.name = 'Conductivity sensor'
  north.Datastreams.push(conductivity)
  const south = station(2, 'A')
  south.Datastreams[0]['@iot.id'] = 3
  const other = station(1, 'B', 'Conductivity', 7)
  return [north, south, other]
}
const include = (...keys) => ({ all: false, keys })
const keysOf = (model, facet) =>
  model.facets[facet].map((option) => option.key).sort()

test('crossfilter starts with all entities and combines OR within facets and AND across them', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  let model = buildMapCrossfilter(things, selection)
  assert.equal(model.matchingThingKeys.size, 3)
  assert.equal(model.matchingDatastreamKeys.size, 4)
  assert.deepEqual(keysOf(model, 'properties'), [
    'A||Conductivity',
    'A||Temperature',
    'B||Conductivity',
  ])
  selection.things = include('A::1', 'A::2')
  selection.properties = include('A||Temperature')
  model = buildMapCrossfilter(things, selection)
  assert.deepEqual([...model.matchingThingKeys].sort(), ['A::1', 'A::2'])
  assert.equal(model.matchingDatastreamKeys.size, 2)
  selection.datastreams = include(
    getMapDatastreamKey(things[0], things[0].Datastreams[0], 0)
  )
  model = buildMapCrossfilter(things, selection)
  assert.deepEqual([...model.matchingThingKeys], ['A::1'])
  assert.equal(model.matchingDatastreamKeys.size, 1)
})

test('each facet ignores its own selection so its alternatives remain selectable', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  selection.properties = include('A||Temperature')
  let model = buildMapCrossfilter(things, selection)
  assert.deepEqual(keysOf(model, 'things'), ['A::1', 'A::2'])
  assert.equal(model.facets.datastreams.length, 2)
  assert.equal(model.facets.properties.length, 3)
  selection.things = include('A::1')
  model = buildMapCrossfilter(things, selection)
  assert.deepEqual(keysOf(model, 'properties'), [
    'A||Conductivity',
    'A||Temperature',
  ])
  assert.deepEqual(keysOf(model, 'things'), ['A::1', 'A::2'])
  // A stream selection narrows both other facets, keeping other streams in its list.
  selection.datastreams = include(
    getMapDatastreamKey(things[0], things[0].Datastreams[0], 0)
  )
  model = buildMapCrossfilter(things, selection)
  assert.deepEqual(keysOf(model, 'things'), ['A::1'])
  assert.deepEqual(keysOf(model, 'properties'), ['A||Temperature'])
  assert.equal(model.facets.datastreams.length, 1)
})

test('All expands dynamically and explicit subsets survive narrowing and snapshot removal', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  selection.things = include('A::1')
  assert.equal(
    buildMapCrossfilter(things, selection).facets.datastreams.length,
    2
  )
  selection.things = { all: true, keys: [] }
  assert.equal(
    buildMapCrossfilter(things, selection).matchingDatastreamKeys.size,
    4
  )
  const key = getMapDatastreamKey(things[2], things[2].Datastreams[0], 0)
  selection.datastreams = include(key)
  assert.equal(
    buildMapCrossfilter(things.slice(0, 2), selection).matchingDatastreamKeys
      .size,
    0
  )
  assert.deepEqual(
    [...buildMapCrossfilter(things, selection).matchingDatastreamKeys],
    [key]
  )
  const excluded = toggleFacetOption({ all: true, keys: [] }, key, false)
  assert.equal(isFacetSelected(excluded, key), false)
  assert.equal(isFacetSelected(excluded, 'new snapshot stream'), true)
  assert.deepEqual(toggleFacetOption(excluded, key, true), {
    all: true,
    keys: [],
  })
})

test('incompatible explicit selections remain visible and removable without silently changing state', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  selection.things = include('A::2')
  selection.properties = include('A||Conductivity')
  const before = structuredClone(selection)
  const model = buildMapCrossfilter(things, selection)
  assert.equal(model.matchingThingKeys.size, 0)
  assert.equal(
    model.facets.things.find((option) => option.key === 'A::2').available,
    false
  )
  assert.equal(
    model.facets.properties.find((option) => option.key === 'A||Conductivity')
      .available,
    false
  )
  assert.ok(
    model.facets.properties.some(
      (option) => option.key === 'A||Temperature' && option.available
    )
  )
  assert.deepEqual(selection, before)
  assert.equal(
    buildMapCrossfilter(things, allMapFilters()).matchingThingKeys.size,
    3
  )
})

test('source-qualified IDs including zero stay distinct and filters never enable hidden sources', () => {
  const things = [station(0, 'A'), station(0, 'B')]
  const selection = allMapFilters()
  const hidden = { 'B::0': false }
  const a = getMapDatastreamKey(things[0], things[0].Datastreams[0], 0)
  const b = getMapDatastreamKey(things[1], things[1].Datastreams[0], 0)
  assert.notEqual(a, b)
  selection.datastreams = include(b)
  let model = buildMapCrossfilter(things, selection, hidden)
  assert.equal(model.matchingThingKeys.size, 0)
  assert.equal(
    model.facets.datastreams.find((option) => option.key === b).available,
    false
  )
  model = buildMapCrossfilter(things, allMapFilters(), hidden)
  assert.deepEqual([...model.matchingThingKeys], ['A::0'])
  assert.deepEqual(hidden, { 'B::0': false })
  assert.equal(
    buildMapCrossfilter(things, selection, {}).matchingThingKeys.size,
    1
  )
})

test('clearing any facet gives an empty intersection and does not fall back to station markers', () => {
  const things = crossfilterFixture()
  for (const facet of ['things', 'properties', 'datastreams']) {
    const selection = allMapFilters()
    selection[facet] = include()
    const model = buildMapCrossfilter(things, selection)
    assert.equal(model.matchingThingKeys.size, 0)
    assert.equal(model.matchingDatastreamKeys.size, 0)
    assert.equal(
      drawReadings(things, [], () => true, { observedMode: true }).length,
      0
    )
  }
})

test('datastream crossfilter renders only matching rows and keeps the original Thing callback', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  const key = getMapDatastreamKey(things[0], things[0].Datastreams[1], 1)
  selection.datastreams = include(key)
  const model = buildMapCrossfilter(things, selection)
  const clicked = []
  const markers = drawReadings(
    things,
    ['A||Temperature', 'A||Conductivity', 'B||Conductivity'],
    (thing) => model.matchingThingKeys.has(getThingKey(thing)),
    {
      isDatastreamVisible: (thing, ds, index) =>
        model.matchingDatastreamKeys.has(getMapDatastreamKey(thing, ds, index)),
      onThingSelect: (...args) => clicked.push(args),
    }
  )
  assert.equal(markers.length, 1)
  assert.match(markers[0].options.icon.html, /4 °C/)
  assert.doesNotMatch(markers[0].options.icon.html, /12 °C/)
  markers[0].events.get('click')({
    originalEvent: { target: { closest: () => ({}) } },
  })
  assert.equal(clicked[0][0], things[0])
  assert.equal(clicked[0][1].datastreamId, '2')
})

test('all three checklist filters search without changing the crossfilter and expose bulk reset', () => {
  const things = crossfilterFixture()
  const model = buildMapCrossfilter(things, allMapFilters())
  for (const facet of ['things', 'properties', 'datastreams']) {
    const calls = [],
      bulk = []
    const control = picker({
      facet,
      options: model.facets[facet],
      all: true,
      sourceColors: new Map(),
      onToggle: (...args) => calls.push(args),
      onToggleAll: (value) => bulk.push(value),
    })
    assert.equal(
      control.nodes('Checkbox').length,
      model.facets[facet].length + 1
    )
    assert.ok(control.nodes('Checkbox').every((node) => node.props.isSelected))
    control.nodes('Input')[0].props.onValueChange('Source B')
    control.render()
    assert.equal(control.nodes('Checkbox').length, 2)
    assert.deepEqual(calls, [])
    control.nodes('Checkbox')[1].props.onValueChange(false)
    assert.deepEqual(calls, [
      [
        model.facets[facet].find((option) => option.sourceKey === 'B').key,
        false,
      ],
    ])
    control.nodes('Checkbox')[0].props.onValueChange(false)
    control.nodes('Checkbox')[0].props.onValueChange(true)
    assert.deepEqual(bulk, [false, true])
    control.nodes('Input')[0].props.onClear()
    control.render()
    assert.equal(
      control.nodes('Checkbox').length,
      model.facets[facet].length + 1
    )
  }
})

test('an empty facet can still select All and incompatible selections have an explanation', () => {
  const calls = []
  const control = picker({
    facet: 'datastreams',
    options: [],
    all: false,
    sourceColors: new Map(),
    onToggle() {},
    onToggleAll: (value) => calls.push(value),
  })
  assert.notEqual(control.nodes('Checkbox')[0].props.isDisabled, true)
  control.nodes('Checkbox')[0].props.onValueChange(true)
  assert.deepEqual(calls, [true])
  const selection = allMapFilters()
  selection.things = include('A::2')
  selection.properties = include('A||Conductivity')
  control.render({
    facet: 'properties',
    options: buildMapCrossfilter(crossfilterFixture(), selection).facets
      .properties,
  })
  assert.ok(
    control
      .nodes('Checkbox')
      .some((node) => node.props.title?.includes('map.filter_unavailable'))
  )
})

test('metadata-only streams and Things remain selectable without inventing property names', () => {
  const noStreams = station(4, 'A')
  noStreams.Datastreams = []
  const noProperty = station(0, 'A')
  delete noProperty.Datastreams[0].ObservedProperty
  const things = [noStreams, noProperty]
  const selection = allMapFilters()
  let model = buildMapCrossfilter(things, selection)
  assert.equal(model.matchingThingKeys.size, 2)
  assert.equal(model.facets.properties.length, 0)
  assert.equal(model.facets.datastreams.length, 1)
  assert.equal(model.facets.datastreams[0].label, '0 · A station 0')
  selection.properties = include('A||Temperature')
  model = buildMapCrossfilter(things, selection)
  assert.equal(model.matchingThingKeys.size, 0)
})

test('search bulk actions affect only matching results in each facet and preserve selections outside the search', () => {
  const things = crossfilterFixture()
  for (const facet of ['things', 'properties', 'datastreams']) {
    const selection = allMapFilters()
    // Keep an unrelated choice excluded before applying the search actions.
    let model = buildMapCrossfilter(things, selection)
    const excluded = model.facets[facet].find(
      (option) => option.sourceKey === 'A'
    ).key
    selection[facet] = toggleFacetOption(selection[facet], excluded, false)
    model = buildMapCrossfilter(things, selection)
    const control = picker({
      facet,
      options: model.facets[facet],
      all: false,
      sourceColors: new Map(),
      onToggle() {},
      onToggleAll() {
        throw new Error('Search actions must not toggle the whole facet')
      },
      onToggleResults(keys, selected) {
        selection[facet] = toggleFacetOptions(selection[facet], keys, selected)
      },
    })
    const resultButton = (action) =>
      control
        .nodes('Button')
        .find((node) => node.props.children === `map.${action}_results`)
    assert.equal(resultButton('select'), undefined)
    control.nodes('Input')[0].props.onValueChange('Source B')
    control.render()
    assert.equal(resultButton('select').props.isDisabled, true)
    assert.equal(resultButton('deselect').props.isDisabled, false)
    const before = new Map(
      model.facets[facet].map((option) => [
        option.key,
        isFacetSelected(selection[facet], option.key),
      ])
    )
    resultButton('deselect').props.onPress()
    for (const option of model.facets[facet]) {
      assert.equal(
        isFacetSelected(selection[facet], option.key),
        option.sourceKey === 'B' ? false : before.get(option.key)
      )
    }
    control.render({
      options: buildMapCrossfilter(things, selection).facets[facet],
    })
    assert.equal(resultButton('select').props.isDisabled, false)
    assert.equal(resultButton('deselect').props.isDisabled, true)
    resultButton('select').props.onPress()
    assert.equal(isFacetSelected(selection[facet], excluded), false)
    for (const option of model.facets[facet].filter(
      (option) => option.sourceKey === 'B'
    )) {
      assert.equal(isFacetSelected(selection[facet], option.key), true)
    }
    control.nodes('Input')[0].props.onValueChange('no matching results')
    control.render()
    assert.equal(resultButton('select').props.isDisabled, true)
    assert.equal(resultButton('deselect').props.isDisabled, true)
    control.nodes('Input')[0].props.onClear()
    control.render()
    assert.equal(resultButton('select'), undefined)
  }
})

test('WT_ search selects multiple matching streams from an empty selection in one update', () => {
  const things = crossfilterFixture()
  things[0].Datastreams[0].name = 'WT_North'
  things[1].Datastreams[0].name = 'WT_South'
  const selection = allMapFilters()
  selection.datastreams = include()
  const calls = []
  const control = picker({
    facet: 'datastreams',
    options: buildMapCrossfilter(things, selection).facets.datastreams,
    all: false,
    sourceColors: new Map(),
    onToggle() {},
    onToggleAll() {},
    onToggleResults(keys, selected) {
      calls.push(keys)
      selection.datastreams = toggleFacetOptions(
        selection.datastreams,
        keys,
        selected
      )
    },
  })
  control.nodes('Input')[0].props.onValueChange('WT_')
  control.render()
  control
    .nodes('Button')
    .find((node) => node.props.children === 'map.select_results')
    .props.onPress()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].length, 2)
  assert.deepEqual(
    [...buildMapCrossfilter(things, selection).matchingThingKeys].sort(),
    ['A::1', 'A::2']
  )
  assert.equal(
    buildMapCrossfilter(things, selection).matchingDatastreamKeys.size,
    2
  )
})

const {
  buildMapDatastreamRows,
} = require('../../datastreams/lib/mapDatastreamRows.ts')

test('the table uses the same matched streams as the map and retains each row owner and source', () => {
  const things = crossfilterFixture()
  things[0].__sourceEndpoint = 'https://alpha.example/v1.1'
  things[2].__sourceEndpoint = 'https://beta.example/v1.1'
  const selection = allMapFilters()
  selection.properties = include('A||Conductivity', 'B||Conductivity')
  const model = buildMapCrossfilter(things, selection)
  const rows = buildMapDatastreamRows(things, model.matchingDatastreamKeys)
  assert.equal(rows.length, 2)
  assert.deepEqual(
    new Set(rows.map((row) => row.__mapKey)),
    model.matchingDatastreamKeys
  )
  assert.equal(rows[0].__thing, things[0])
  assert.equal(rows[1].__thing, things[2])
  assert.equal(rows[0].__sourceEndpoint, 'https://alpha.example/v1.1')
  assert.equal(rows[1].__sourceEndpoint, 'https://beta.example/v1.1')
  assert.notEqual(rows[0].__mapKey, rows[1].__mapKey)
  assert.deepEqual(buildMapDatastreamRows(things, new Set()), [])
})

const { layoutMapValueLabels } = require('./mapLabelLayout.ts')
test('overlapping labels are hidden in favor of selected stations while anchors remain untouched', () => {
  const rect = (left, top, right, bottom) => ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  })
  const changes = []
  const label = (key, bounds, selected = false) => ({
    getBoundingClientRect: () => bounds,
    closest: () => (selected ? {} : null),
    classList: { toggle: (_className, hidden) => changes.push([key, hidden]) },
  })
  const labels = [
    label('ordinary', rect(50, 30, 110, 54)),
    label('selected', rect(55, 32, 115, 56), true),
    label('over-dot', rect(180, 30, 220, 54)),
    label('outside', rect(290, 60, 350, 84)),
  ]
  const dot = { getBoundingClientRect: () => rect(190, 32, 208, 50) }
  const root = {
    getBoundingClientRect: () => rect(0, 0, 300, 200),
    querySelectorAll: (query) =>
      query === '.map-station-value' ? labels : [dot],
  }
  layoutMapValueLabels(root)
  assert.deepEqual(changes, [
    ['selected', false],
    ['ordinary', true],
    ['over-dot', true],
    ['outside', true],
  ])
  labels[0].getBoundingClientRect = () => rect(40, 100, 100, 124)
  changes.length = 0
  layoutMapValueLabels(root)
  assert.deepEqual(
    changes.find(([key]) => key === 'ordinary'),
    ['ordinary', false]
  )
})

const {
  orderTableItems,
} = require('../../../components/table/tableOrdering.ts')

test('a selected datastream is first while every other row follows the chosen sort', () => {
  const things = crossfilterFixture()
  const model = buildMapCrossfilter(things, allMapFilters())
  const rows = buildMapDatastreamRows(things, model.matchingDatastreamKeys)
  rows.forEach((row, index) => {
    row.name = ['Zulu', 'Alpha', 'Mike', 'Bravo'][index]
  })
  const key = (row) => row.__mapKey
  const value = (row, column) => row[column]
  const pinned = new Set([rows[2].__mapKey])
  const ascending = orderTableItems(
    rows,
    { column: 'name', direction: 'ascending' },
    value,
    key,
    pinned
  )
  assert.deepEqual(
    ascending.map((row) => row.name),
    ['Mike', 'Alpha', 'Bravo', 'Zulu']
  )
  const descending = orderTableItems(
    rows,
    { column: 'name', direction: 'descending' },
    value,
    key,
    pinned
  )
  assert.deepEqual(
    descending.map((row) => row.name),
    ['Mike', 'Zulu', 'Bravo', 'Alpha']
  )
  assert.equal(descending.length, rows.length)
  assert.equal(new Set(descending.map(key)).size, rows.length)
  const cleared = orderTableItems(
    rows,
    { column: 'name', direction: 'descending' },
    value,
    key,
    new Set()
  )
  assert.deepEqual(
    cleared.map((row) => row.name),
    ['Zulu', 'Mike', 'Bravo', 'Alpha']
  )
  assert.deepEqual(
    rows.map((row) => row.name),
    ['Zulu', 'Alpha', 'Mike', 'Bravo'],
    'Input rows remain unchanged'
  )
})

test('station selection promotes its source-specific streams without dropping other rows or changing filters', () => {
  const things = crossfilterFixture()
  const selection = allMapFilters()
  const before = structuredClone(selection)
  const model = buildMapCrossfilter(things, selection)
  const rows = buildMapDatastreamRows(things, model.matchingDatastreamKeys)
  rows.forEach((row, index) => {
    row.name = ['Zulu', 'Alpha', 'Mike', 'Bravo'][index]
  })
  const pinned = new Set(
    rows
      .filter((row) => getThingKey(row.__thing) === 'A::1')
      .map((row) => row.__mapKey)
  )
  const ordered = orderTableItems(
    rows,
    { column: 'name', direction: 'ascending' },
    (row) => row.name,
    (row) => row.__mapKey,
    pinned
  )
  assert.deepEqual(
    ordered.map((row) => row.name),
    ['Alpha', 'Zulu', 'Bravo', 'Mike']
  )
  assert.equal(ordered.length, 4)
  assert.deepEqual(selection, before)
  assert.deepEqual(
    orderTableItems(
      rows,
      { column: 'name', direction: 'ascending' },
      (row) => row.name,
      (row) => row.__mapKey,
      new Set()
    ).map((row) => row.name),
    ['Alpha', 'Bravo', 'Mike', 'Zulu']
  )
})

const { focusThingOnMap } = require('./focusThingOnMap.ts')

test('row map focus uses the source-qualified rendered station and reveals its cluster', () => {
  const calls = []
  const selected = {
    __thingKey: 'B::1',
    getLatLng: () => ({ lat: 46.1, lng: 8.9 }),
  }
  const map = {
    getZoom: () => 10,
    getMaxZoom: () => 19,
    stop: () => calls.push('stop'),
    setView: (...args) => calls.push(args),
    fitBounds() {
      throw Error('Not a geometry')
    },
  }
  const group = {
    eachLayer(callback) {
      callback({ __thingKey: 'A::1', getLatLng: () => ({ lat: 0, lng: 0 }) })
      callback(selected)
    },
    zoomToShowLayer(layer, callback) {
      assert.equal(layer, selected)
      calls.push('reveal')
      callback()
    },
  }
  assert.equal(focusThingOnMap(map, [group], 'B::1'), true)
  assert.deepEqual(calls, [
    'stop',
    [[46.1, 8.9], 15, { animate: true }],
    'reveal',
  ])
  calls.length = 0
  assert.equal(focusThingOnMap(map, [group], 'missing'), false)
  assert.deepEqual(calls, [])
  focusThingOnMap({ ...map, getZoom: () => 18 }, [group], 'B::1')
  assert.equal(calls[1][1], 18, 'Selecting a row preserves a closer zoom')
})

test('row map focus respects basemap limits and fits rendered line/polygon bounds', () => {
  const calls = []
  const bounds = { isValid: () => true, getCenter: () => ({ lat: 46, lng: 9 }) }
  const map = {
    getZoom: () => 10,
    getMaxZoom: () => 12,
    stop() {},
    setView: (...args) => calls.push(args),
    fitBounds: (...args) => calls.push(args),
  }
  focusThingOnMap(
    map,
    [
      {
        eachLayer: (callback) =>
          callback({
            __thingKey: 'A::1',
            getLatLng: () => ({ lat: 46, lng: 9 }),
          }),
      },
    ],
    'A::1'
  )
  assert.equal(calls[0][1], 12)
  calls.length = 0
  focusThingOnMap(
    map,
    [
      {
        eachLayer: (callback) =>
          callback({ __thingKey: 'A::1', getBounds: () => bounds }),
      },
    ],
    'A::1'
  )
  assert.deepEqual(calls, [
    [bounds, { padding: [32, 32], maxZoom: 12, animate: true }],
  ])
})

const { fitThingsOnMap } = require('./focusThingOnMap.ts')
const { resolveMapSelection } = require('./mapSelection.ts')

test('checklist labels focus items independently from checkbox filtering in every facet', () => {
  const model = buildMapCrossfilter(crossfilterFixture(), allMapFilters())
  for (const facet of ['things', 'properties', 'datastreams']) {
    const selected = [],
      toggled = []
    const option = model.facets[facet][0]
    const control = picker({
      facet,
      options: model.facets[facet],
      all: true,
      activeKey: option.key,
      sourceColors: new Map(),
      onItemSelect: (key) => selected.push(key),
      onToggle: (...args) => toggled.push(args),
    })
    const label = control.nodes('button')[0]
    assert.equal(label.props.type, 'button')
    assert.equal(label.props['aria-pressed'], true)
    label.props.onClick()
    label.props.onClick()
    assert.deepEqual(selected, [option.key, option.key])
    assert.deepEqual(toggled, [])
    assert.equal(control.nodes('Checkbox')[1].props.isSelected, true)
    control.nodes('Checkbox')[1].props.onValueChange(false)
    assert.deepEqual(toggled, [[option.key, false]])
    assert.equal(selected.length, 2)
  }
})

test('Thing, datastream and property focus promote the matching rows without changing filters', () => {
  const things = crossfilterFixture()
  const filters = allMapFilters()
  const before = JSON.stringify(filters)
  const model = buildMapCrossfilter(things, filters)
  const rows = buildMapDatastreamRows(things, model.matchingDatastreamKeys)
  const dsKey = getMapDatastreamKey(things[0], things[0].Datastreams[1], 1)
  for (const [focus, expectedThings, expectedStreams] of [
    [{ facet: 'things', key: 'A::1' }, ['A::1'], 2],
    [{ facet: 'datastreams', key: dsKey }, ['A::1'], 1],
    [{ facet: 'properties', key: 'A||Temperature' }, ['A::1', 'A::2'], 2],
  ]) {
    const selected = resolveMapSelection(things, focus, model)
    assert.deepEqual([...selected.thingKeys], expectedThings)
    assert.equal(selected.datastreamKeys.size, expectedStreams)
    const ordered = orderTableItems(
      rows,
      { column: 'name', direction: 'descending' },
      (row) => row.name ?? '',
      (row) => row.__mapKey,
      selected.datastreamKeys
    )
    assert.ok(
      ordered
        .slice(0, expectedStreams)
        .every((row) => selected.datastreamKeys.has(row.__mapKey))
    )
    assert.ok(
      ordered
        .slice(expectedStreams)
        .every((row) => !selected.datastreamKeys.has(row.__mapKey))
    )
    assert.equal(ordered.length, rows.length)
  }
  assert.equal(JSON.stringify(filters), before)
  assert.equal(resolveMapSelection(things, null, model).thingKeys.size, 0)
})

test('focus respects hidden sources and checkbox exclusions, including metadata-only Things', () => {
  const things = crossfilterFixture()
  const filters = allMapFilters()
  filters.datastreams = {
    all: true,
    keys: [getMapDatastreamKey(things[0], things[0].Datastreams[0], 0)],
  }
  const model = buildMapCrossfilter(things, filters, { 'A::2': false })
  const selected = resolveMapSelection(
    things,
    { facet: 'properties', key: 'A||Temperature' },
    model
  )
  assert.equal(selected.thingKeys.size, 0)
  assert.equal(selected.datastreamKeys.size, 0)
  const empty = station(0, 'A')
  empty.Datastreams = []
  const emptySelection = resolveMapSelection(
    [empty],
    { facet: 'things', key: 'A::0' },
    buildMapCrossfilter([empty], allMapFilters())
  )
  assert.deepEqual([...emptySelection.thingKeys], ['A::0'])
  assert.equal(emptySelection.datastreamKeys.size, 0)
})

test('property focus highlights all matching station markers across redraws', () => {
  const things = crossfilterFixture()
  const selectedThingKeys = new Set(['A::1', 'A::2'])
  const markers = drawReadings(
    things,
    ['A||Temperature', 'B||Conductivity'],
    () => true,
    { selectedThingKeys }
  )
  assert.deepEqual(
    markers.map((marker) => marker.__selected),
    [true, true, false]
  )
})

test('selection extent fits only selected stations and leaves the camera alone when none are visible', () => {
  const calls = []
  const map = {
    stop() {},
    getMaxZoom: () => 19,
    fitBounds: (...args) => calls.push(args),
  }
  const groups = [
    {
      eachLayer: (callback) => {
        callback({ __thingKey: 'A::1', getLatLng: () => ({ lat: 46, lng: 9 }) })
        callback({
          __thingKey: 'A::2',
          getLatLng: () => ({ lat: 47, lng: 10 }),
        })
        callback({ __thingKey: 'B::1', getLatLng: () => ({ lat: 0, lng: 0 }) })
      },
    },
  ]
  assert.equal(
    fitThingsOnMap(map, groups, true, new Set(['A::1', 'A::2'])),
    true
  )
  assert.deepEqual(calls[0][0], [
    [46, 9],
    [47, 10],
  ])
  assert.equal(fitThingsOnMap(map, groups, true, new Set()), false)
  assert.equal(calls.length, 1)
})

test('Thing extent fits rendered clustered points and complete vector bounds with padding', () => {
  const calls = []
  const map = {
    stop: () => calls.push('stop'),
    getMaxZoom: () => 19,
    fitBounds: (...args) => calls.push(args),
  }
  const point = { __thingKey: 'A::1', getLatLng: () => ({ lat: 46, lng: 9 }) }
  const vector = {
    __thingKey: 'B::1',
    getBounds: () => ({
      isValid: () => true,
      getSouthWest: () => ({ lat: 45, lng: 8 }),
      getNorthEast: () => ({ lat: 47, lng: 10 }),
    }),
  }
  const groups = [
    { eachLayer: (callback) => [point, vector].forEach(callback) },
  ]
  assert.equal(fitThingsOnMap(map, groups, false), true)
  assert.deepEqual(calls, [
    'stop',
    [
      [
        [46, 9],
        [45, 8],
        [47, 10],
      ],
      { padding: [64, 64], maxZoom: 15, animate: false },
    ],
  ])
  calls.length = 0
  fitThingsOnMap({ ...map, getMaxZoom: () => 12 }, [groups[0]])
  assert.equal(calls[1][1].maxZoom, 12)
  assert.equal(calls[1][1].animate, true)
})

test('Thing extent ignores missing or invalid geometry and uses original spiderfied positions', () => {
  const calls = []
  const map = {
    stop() {},
    getMaxZoom: () => 19,
    fitBounds: (...args) => calls.push(args),
  }
  assert.equal(fitThingsOnMap(map, []), false)
  assert.equal(
    fitThingsOnMap(map, [
      {
        eachLayer: (callback) => {
          callback({
            __thingKey: 'A::1',
            getLatLng: () => ({ lat: NaN, lng: 9 }),
          })
          callback({
            __thingKey: 'A::2',
            getBounds: () => ({ isValid: () => false }),
          })
          callback({ getLatLng: () => ({ lat: 0, lng: 0 }) })
        },
      },
    ]),
    false
  )
  assert.deepEqual(calls, [])
  assert.equal(
    fitThingsOnMap(map, [
      {
        eachLayer: (callback) =>
          callback({
            __thingKey: 'A::3',
            _preSpiderfyLatlng: { lat: 46, lng: 9 },
            getLatLng: () => ({ lat: 46.01, lng: 9.01 }),
          }),
      },
    ]),
    true
  )
  assert.deepEqual(calls[0][0], [[46, 9]])
})
