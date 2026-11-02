'use client'

import type { Thing } from '@/types/domain'
import { useMemo, useState } from 'react'

import { allMapFilters, buildMapCrossfilter } from '../lib/mapCrossfilter'

export function useMapFilters(things: Thing[]) {
  const [filterSelection, setFilterSelection] = useState(allMapFilters)
  const [thingEnabled, setThingEnabled] = useState<Record<string, boolean>>({})
  const crossfilter = useMemo(
    () => buildMapCrossfilter(things, filterSelection, thingEnabled),
    [things, filterSelection, thingEnabled]
  )
  return {
    filterSelection,
    setFilterSelection,
    thingEnabled,
    setThingEnabled,
    crossfilter,
  }
}
export type MapFilters = ReturnType<typeof useMapFilters>
