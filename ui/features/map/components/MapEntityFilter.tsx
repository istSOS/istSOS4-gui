'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import MapChecklistFilter, {
  type MapChecklistGroup,
} from './MapChecklistFilter'

import { matchesMapFilterSearch } from '../lib/leafletMapHelpers'
import type { MapFacet, MapFacetOption } from '../lib/mapCrossfilter'

const labels = {
  things: [
    'things',
    'all_things',
    'no_things_selected',
    'thing_search',
    'thing_no_results',
  ],
  properties: [
    'observed_properties',
    'all_properties',
    'no_properties_selected',
    'property_search',
    'property_no_results',
  ],
  datastreams: [
    'datastreams',
    'all_datastreams',
    'no_datastreams_selected',
    'datastream_search',
    'datastream_no_results',
  ],
} as const

export default function MapEntityFilter({
  facet,
  options,
  all,
  sourceColors,
  onToggle,
  onToggleAll,
  onToggleResults,
  onItemSelect,
  activeKey,
}: {
  facet: MapFacet
  options: MapFacetOption[]
  all: boolean
  sourceColors: Map<string, string>
  onToggle: (key: string, selected: boolean) => void
  onToggleAll: (selected: boolean) => void
  onToggleResults: (keys: string[], selected: boolean) => void
  onItemSelect: (key: string) => void
  activeKey?: string
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const groups = new Map<string, MapChecklistGroup>()
  for (const option of options) {
    if (!matchesMapFilterSearch(option.searchText, search)) continue
    const group = groups.get(option.sourceKey) ?? {
      key: option.sourceKey,
      label: option.sourceLabel,
      color: sourceColors.get(option.sourceKey),
      items: [],
    }
    group.items.push({
      key: option.key,
      label: option.label,
      selected: option.selected,
      unavailable: !option.available,
    })
    groups.set(option.sourceKey, group)
  }
  const [name, allLabel, noneLabel, searchLabel, emptyLabel] = labels[facet]
  return (
    <MapChecklistFilter
      groups={[...groups.values()]}
      search={search}
      onSearchChange={setSearch}
      name={t(`map.${name}`)}
      allLabel={t(`map.${allLabel}`)}
      noneLabel={t(`map.${noneLabel}`)}
      searchLabel={t(`map.${searchLabel}`)}
      emptyLabel={t(`map.${emptyLabel}`)}
      selectedCount={options.filter((option) => option.selected).length}
      total={options.length}
      allSelected={all}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onToggleResults={onToggleResults}
      onItemSelect={onItemSelect}
      activeKey={activeKey}
    />
  )
}
