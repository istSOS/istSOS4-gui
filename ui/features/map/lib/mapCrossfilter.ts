import type { Datastream, Thing } from '@/types/domain'

import {
  buildObservedPropertyKey,
  getThingKey,
  getThingSourceKey,
  getThingSourceLabel,
} from './leafletMapHelpers'

export const MAP_FACETS = ['things', 'properties', 'datastreams'] as const
export type MapFacet = (typeof MAP_FACETS)[number]

// In All mode keys are exclusions; otherwise they are explicit inclusions.
// This keeps All dynamic when another facet widens or a snapshot adds data.
export type MapFacetSelection = { all: boolean; keys: string[] }
export type MapFilterSelection = Record<MapFacet, MapFacetSelection>
export type MapFacetOption = {
  key: string
  label: string
  sourceKey: string
  sourceLabel: string
  searchText: string
  selected: boolean
  available: boolean
}

export function allMapFilters(): MapFilterSelection {
  return {
    things: { all: true, keys: [] },
    properties: { all: true, keys: [] },
    datastreams: { all: true, keys: [] },
  }
}

export function isFacetSelected(selection: MapFacetSelection, key: string) {
  return selection.all !== selection.keys.includes(key)
}

export function toggleFacetOption(
  selection: MapFacetSelection,
  key: string,
  selected: boolean
): MapFacetSelection {
  return toggleFacetOptions(selection, [key], selected)
}

export function toggleFacetOptions(
  selection: MapFacetSelection,
  optionKeys: string[],
  selected: boolean
): MapFacetSelection {
  const keys = new Set(selection.keys)
  for (const key of optionKeys) {
    if (selected === selection.all) keys.delete(key)
    else keys.add(key)
  }
  return { all: selection.all, keys: [...keys] }
}

export function getMapDatastreamKey(
  thing: Thing,
  ds: Datastream,
  index: number
) {
  const id = ds['@iot.id'] ?? ds.id
  return JSON.stringify([
    getThingSourceKey(thing),
    'datastream',
    ...(id == null ? [getThingKey(thing), index] : [String(id)]),
  ])
}

export function buildMapCrossfilter(
  things: Thing[],
  selection: MapFilterSelection,
  layerVisibility: Record<string, boolean> = {}
) {
  const options: Record<MapFacet, Map<string, MapFacetOption>> = {
    things: new Map(),
    properties: new Map(),
    datastreams: new Map(),
  }
  const rows: Array<Record<MapFacet, string | null> & { visible: boolean }> = []
  const selectedSets = Object.fromEntries(
    MAP_FACETS.map((facet) => [facet, new Set(selection[facet].keys)])
  ) as Record<MapFacet, Set<string>>

  for (const thing of things) {
    const thingKey = getThingKey(thing)
    const sourceKey = getThingSourceKey(thing)
    const sourceLabel = getThingSourceLabel(thing)
    const thingLabel = String(
      thing.name?.trim() || (thing['@iot.id'] ?? thing.id ?? thingKey)
    )
    const addOption = (
      facet: MapFacet,
      key: string,
      label: string,
      extra = ''
    ) => {
      options[facet].set(key, {
        key,
        label,
        sourceKey,
        sourceLabel,
        searchText: `${label} ${sourceLabel} ${extra}`,
        selected: selection[facet].all !== selectedSets[facet].has(key),
        available: false,
      })
    }
    addOption(
      'things',
      thingKey,
      thingLabel,
      String(thing['@iot.id'] ?? thing.id ?? '')
    )
    const datastreams = thing.Datastreams ?? []
    for (const [index, ds] of datastreams.entries()) {
      const name = ds.ObservedProperty?.name?.trim()
      const propertyKey = name
        ? buildObservedPropertyKey(sourceKey, name)
        : null
      const datastreamKey = getMapDatastreamKey(thing, ds, index)
      if (propertyKey && name) addOption('properties', propertyKey, name)
      const id = ds['@iot.id'] ?? ds.id
      const streamLabel = String(ds.name?.trim() || (id ?? name ?? index + 1))
      // Include Thing and ID in the label to distinguish similarly named sensors.
      addOption(
        'datastreams',
        datastreamKey,
        `${streamLabel}${id != null && streamLabel !== String(id) ? ` (#${id})` : ''} · ${thingLabel}`,
        `${name ?? ''} ${ds.Sensor?.name ?? ''}`
      )
      rows.push({
        things: thingKey,
        properties: propertyKey,
        datastreams: datastreamKey,
        visible: layerVisibility[thingKey] !== false,
      })
    }
    // Things without streams still belong in the Thing checklist.
    if (!datastreams.length)
      rows.push({
        things: thingKey,
        properties: null,
        datastreams: null,
        visible: layerVisibility[thingKey] !== false,
      })
  }

  const matches = (facet: MapFacet, key: string | null) =>
    key === null
      ? selection[facet].all && selectedSets[facet].size === 0
      : selection[facet].all !== selectedSets[facet].has(key)

  const matchingThingKeys = new Set<string>()
  const matchingDatastreamKeys = new Set<string>()
  for (const row of rows) {
    if (!row.visible) continue
    const selected = MAP_FACETS.map((facet) => matches(facet, row[facet]))
    MAP_FACETS.forEach((facet, index) => {
      if (selected.every((value, other) => other === index || value)) {
        const key = row[facet]
        if (key !== null) options[facet].get(key)!.available = true
      }
    })
    if (selected.every(Boolean)) {
      matchingThingKeys.add(row.things!)
      if (row.datastreams !== null) matchingDatastreamKeys.add(row.datastreams)
    }
  }

  const facets = Object.fromEntries(
    MAP_FACETS.map((facet) => [
      facet,
      [...options[facet].values()]
        // Keep explicit incompatible selections removable, without filling All
        // lists with implicitly selected options excluded by the other filters.
        .filter(
          (option) =>
            option.available || (!selection[facet].all && option.selected)
        )
        .sort(
          (a, b) =>
            a.sourceLabel.localeCompare(b.sourceLabel) ||
            a.label.localeCompare(b.label)
        ),
    ])
  ) as Record<MapFacet, MapFacetOption[]>

  return { facets, matchingThingKeys, matchingDatastreamKeys }
}
